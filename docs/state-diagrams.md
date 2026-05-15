# CodeAtlas State Diagrams

These diagrams reflect the current project flow in the web app, server, and VS Code extension.

## 1) Repository lifecycle

```mermaid
stateDiagram-v2
  [*] --> Unconfigured

  Unconfigured --> ServerStarting: open app / extension starts backend
  ServerStarting --> ServerReady: backend responds
  ServerStarting --> ServerError: missing env / spawn failure / timeout

  ServerReady --> RepositoryValidation: user selects a repo
  RepositoryValidation --> RepositoryRejected: path missing / unreadable / invalid
  RepositoryValidation --> IndexQueued: path valid

  IndexQueued --> IndexRunningFull: first index or explicit full rebuild
  IndexQueued --> IndexRunningIncremental: repo already indexed and mode=incremental

  IndexRunningFull --> IndexScanning
  IndexRunningIncremental --> IndexScanning

  IndexScanning --> IndexParsing: files classified
  IndexParsing --> IndexIRBuild: code/text facts extracted
  IndexIRBuild --> Neo4jIngest: graph IR assembled
  Neo4jIngest --> CleanupAndPrune: ingest complete
  CleanupAndPrune --> IndexStateSaved: index snapshot persisted
  IndexStateSaved --> RepoReady: repo usable in graph/history/chat

  RepoReady --> RepoReindexed: user triggers reindex
  RepoReady --> RepoDeleted: user deletes graph
  RepoReady --> RepositoryValidation: repository path changes

  RepoReindexed --> IndexQueued
  RepoDeleted --> Unconfigured

  ServerError --> ServerStarting: retry
  RepositoryRejected --> RepositoryValidation: fix path / ignore patterns
```

## 2) Indexing pipeline

```mermaid
stateDiagram-v2
  [*] --> ScanRepo

  ScanRepo --> LoadPrevState
  LoadPrevState --> DiffScan

  DiffScan --> ChooseMode
  ChooseMode --> FullRebuild: first run or mode=full
  ChooseMode --> IncrementalUpdate: existing repo and mode=incremental

  FullRebuild --> ParseAndExtract
  IncrementalUpdate --> FindDependents
  FindDependents --> ParseAndExtract

  ParseAndExtract --> BuildIR
  BuildIR --> EnsureSchema

  EnsureSchema --> FullIngest: full rebuild
  EnsureSchema --> DeleteRemovedAndDerived: incremental update

  DeleteRemovedAndDerived --> IngestUpdatedIR
  FullIngest --> CleanupOldRuns
  IngestUpdatedIR --> PruneEmptyDirectories

  CleanupOldRuns --> SaveIndexState
  PruneEmptyDirectories --> SaveIndexState

  SaveIndexState --> OptionalDebugExport
  OptionalDebugExport --> [*]

  ParseAndExtract --> Failed: unsupported file / parser failure / unexpected exception
  BuildIR --> Failed
  EnsureSchema --> Failed
  FullIngest --> Failed
  IngestUpdatedIR --> Failed
  SaveIndexState --> Failed
```

## 3) Graph exploration and chat

```mermaid
stateDiagram-v2
  [*] --> NoRepoSelected

  NoRepoSelected --> GraphLoading: open graph / restore last repo
  GraphLoading --> GraphReady: subgraph fetched
  GraphLoading --> GraphUnavailable: missing repo / server error

  GraphReady --> NodeSelected: click node
  NodeSelected --> DetailPanelVisible: show file / AST / metadata
  DetailPanelVisible --> GraphReady: close panel / select another node

  GraphReady --> TourMode: open guided tour
  TourMode --> GraphReady: exit tour

  GraphReady --> ChatThreadActive: ask question
  ChatThreadActive --> ContextGathering: resolve thread + collect graph context
  ContextGathering --> RetrievalRunning: embed query + fetch relevant chunks
  RetrievalRunning --> AnswerGenerating: build prompt and call model
  AnswerGenerating --> MessagePersisted: store user and assistant messages
  MessagePersisted --> ChatThreadActive

  ChatThreadActive --> ChatCleared: user clears thread
  ChatCleared --> GraphReady

  GraphUnavailable --> GraphLoading: retry
```

## 4) VS Code extension/server control

```mermaid
stateDiagram-v2
  [*] --> ServerStopped

  ServerStopped --> ServerStarting: open graph / auto-start / start command
  ServerStarting --> ServerRunning: process responds on port
  ServerStarting --> ServerError: cannot locate server / spawn failure / env issue

  ServerRunning --> ServerStopped: stop command
  ServerRunning --> ServerStarting: restart command
  ServerRunning --> ServerError: process exits unexpectedly

  ServerError --> ServerStarting: retry or open graph again
  ServerError --> ServerStopped: dismiss / stop cleanup
```

## Notes

- The repository lifecycle is the main business flow.
- The indexing pipeline is intentionally split out because it has its own internal failure and retry states.
- Graph exploration and chat are separate from indexing; they become available only after a repository has been indexed.
- The extension state is useful if you use CodeAtlas inside VS Code, since it controls backend startup and repo indexing entry points.
