# CodeAtlas: Technical Integration Reference

Detailed data flow diagrams and integration points for embeddings and graph RAG systems.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                              │
│                                                                  │
│        Question: "How does this function work?"                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────────┐
                    │   RAG ROUTE        │
                    │ graphrag.ts        │
                    └────────┬───────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
    ┌─────────────┐    ┌──────────────┐   ┌──────────────┐
    │ Generate    │    │ Vector       │   │ Gather       │
    │ Embedding   │    │ Search       │   │ Node Context │
    │             │    │              │   │              │
    │ embeddings  │    │ findSimilar  │   │ gatherNode   │
    │ .ts         │    │ Chunks()     │   │ Context()    │
    │             │    │              │   │              │
    └────┬────────┘    └──┬───────────┘   └────┬─────────┘
         │                │                     │
         │                │                     │
         ▼                ▼                     ▼
         │         Neo4j Vector Index      Neo4j Graph
         │         ─────────────────       ──────────────
         │         • astnode_embedding     • Find related
         │         • textchunk_embedding     AST nodes
         │         • codefile_embedding    • Build tour
         │         • textfile_embedding    • Get context
         │                │                     │
         └────────────────┼─────────────────────┘
                          │
                          ▼
                ┌──────────────────────────┐
                │ Assemble Context        │
                │ assembleFileContext()  │
                └────────┬────────────────┘
                         │
                         ▼
            ┌────────────────────────────┐
            │ LLM Generation             │
            │ generateTextWithContext()  │
            └────────┬──────────────────┘
                     │
                     ▼
            ┌────────────────────────────┐
            │ Response with Sources      │
            │ {                          │
            │   answer: "...",           │
            │   sources: [{...}]         │
            │ }                          │
            └────────────────────────────┘
```

---

## Data Pipeline: Indexing Flow

```
┌──────────────────────────────────┐
│ Repository on Disk               │
│ src/                             │
│ ├─ main.ts                       │
│ ├─ helper.ts                     │
│ ├─ README.md                     │
│ └─ docs/guide.md                 │
└─────────┬────────────────────────┘
          │
          ▼
┌──────────────────────────────────┐
│ PHASE 1: SCAN                    │
│ scanRepo()                       │
│                                  │
│ Output: ScanResult {             │
│   entries: [                     │
│     { relPath, kind, size, ... } │
│   ]                              │
│ }                                │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ PHASE 2: LOAD STATE              │
│ loadIndexState()                 │
│                                  │
│ .codeatlas/index-state.json      │
│─────────────────────────────────│
│ {                                │
│   files: {                       │
│     "src/main.ts": {             │
│       mtime: 1234567890,         │
│       size: 5000,                │
│       hash: "abc123..." (opt)    │
│     }                            │
│   }                              │
│ }                                │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ PHASE 3: DIFF & INVALIDATE       │
│                                  │
│ Changed?                         │
│ ├─ Change detection algorithm:   │
│ │  1. Compare mtime + size       │
│ │  2. Optional: hash comparison  │
│ │                                │
│ ├─ Result:                       │
│ │  • added: []                   │
│ │  • changed: ["src/main.ts"]    │
│ │  • removed: []                 │
│ │                                │
│ ├─ Find dependents:              │
│ │  Query Neo4j for files that    │
│ │  import changed files          │
│ │  Pattern: [:REFERENCES*1..10]  │
│ │                                │
│ └─ filesToProcess +=             │
│    [changed files + dependents]  │
└──────────┬───────────────────────┘
           │
       ┌───┴────────────────────┐
       │                        │
       ▼ CODE FILES             ▼ TEXT FILES
┌──────────────────────┐   ┌──────────────────┐
│ PHASE 4A: PARSE      │   │ PHASE 4B: EXTRACT│
│ parseAndExtract()    │   │ extractTextFacts │
│                      │   │                  │
│ ├─ Tree-sitter parse│   │ ├─ Text chunking│
│ ├─ Extract symbols  │   │ ├─ References   │
│ │  ├- name          │   │ ├─ Mentions     │
│ │  ├- kind          │   │ └─ Metadata    │
│ │  ├- range         │   │                  │
│ │  └- inheritance   │   │ Output: TextFacts
│ │                   │   │ {                │
│ ├─ Extract imports  │   │   chunks: [...], │
│ ├─ Extract calls    │   │   references:... │
│ └─ Output: CodeFacts│   │ }                │
│    {                │   │                  │
│     imports: [...], │   │                  │
│     symbols: [...], │   │                  │
│     callSites: [...] │  │                  │
│    }                │   │                  │
└──────────┬──────────┘   └────────┬─────────┘
           │                       │
           └───────────┬───────────┘
                       │
                       ▼
┌──────────────────────────────────────┐
│ PHASE 5: CODE SEGMENTATION           │
│ buildCodeSegments()                  │
│                                      │
│ Group symbols into embedding units:  │
│ • Small files: composite             │
│ • Grouped by type: class, function   │
│ • Standalone: region-based           │
│ • Split: oversized > 200 lines       │
│                                      │
│ Output: CodeSegment[] {              │
│   startLine, endLine, summary, ...   │
│ }                                    │
└──────────┬───────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ PHASE 6: BUILD IR                    │
│ buildIR()                            │
│                                      │
│ Convert Facts → Graph IR             │
│                                      │
│ IRNode[] = [                         │
│   { label: "Repo", props: {...} },   │
│   { label: "Directory", props:{...}},│
│   { label: "CodeFile", props:{...} },│
│   { label: "AstNode", props:{...} }, │
│   { label: "TextChunk",...},         │
│   ...                                │
│ ]                                    │
│                                      │
│ IREdge[] = [                         │
│   { from, to, type/label },          │
│   { "dir-id", "file-id", "CONTAINS"},│
│   { "file-id", "node-id", "HAS_AST" }│
│   ...                                │
│ ]                                    │
│                                      │
│ Output: GraphIR {                    │
│   nodes: IRNode[],                   │
│   edges: IREdge[],                   │
│   stats: {...}                       │
│ }                                    │
└──────────┬───────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│ PHASE 7: ENSURE SCHEMA                 │
│ ensureSchema()                         │
│                                        │
│ CREATE CONSTRAINT repo_id IF NOT ...   │
│ CREATE CONSTRAINT directory_id IF ...  │
│ CREATE INDEX repo_repo_id IF ...       │
│ CREATE VECTOR INDEX astnode_embedding  │
│ CREATE VECTOR INDEX textchunk_...      │
│ ...                                    │
│                                        │
│ (All idempotent, safe to re-run)      │
└────────────┬─────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ PHASE 8: INGEST                        │
│ ingestIR()                             │
│                                        │
│ For each node batch (1000 at a time):  │
│   UNWIND nodes AS row                  │
│   MERGE (n:Label {id: row.id})         │
│   SET n += row.props                   │
│                                        │
│ For each edge:                         │
│   CREATE (from)-[:TYPE]->(to)          │
│                                        │
│ With retry logic:                      │
│   • Deadlock detection                 │
│   • Exponential backoff                │
│   • Max 5 retries                      │
└────────────┬─────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ PHASE 9A: EMBED AST                    │
│ embedASTFiles()                        │
│                                        │
│ For each CodeFile with AstNodes:       │
│   1. Generate embeddings via           │
│      openrouter.textEmbeddingModel()   │
│   2. Store in node.embeddings property │
│   3. Creates vector index entry        │
│                                        │
│ Query:                                 │
│ MATCH (f:CodeFile)-[:HAS_AST]->(n)    │
│ WHERE n.embeddings IS NULL             │
│ UPDATE n SET embeddings = $vec         │
└────────────┬─────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ PHASE 9B: EMBED TEXT                   │
│ embedTextChunks()                      │
│                                        │
│ For each TextFile with TextChunks:     │
│   1. Generate embeddings               │
│   2. Store in chunk.embeddings         │
│   3. Creates vector index entry        │
│                                        │
│ Query:                                 │
│ MATCH (f:TextFile)-[:HAS_CHUNK]->(c)  │
│ WHERE c.embeddings IS NULL             │
│ UPDATE c SET embeddings = $vec         │
└────────────┬─────────────────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ PHASE 10: CLEANUP & STATE              │
│                                        │
│ If FULL mode:                          │
│   DELETE old nodes by runId            │
│                                        │
│ If INCREMENTAL mode:                   │
│   DELETE empty directories             │
│                                        │
│ Save index state:                      │
│ .codeatlas/index-state.json ← updated  │
│                                        │
│ ✅ INDEXING COMPLETE                  │
└────────────────────────────────────────┘
```

---

## Vector Search Flow

```
USER QUESTION
    │
    ├─ "How does embedding work?"
    │
    ▼
GENERATE QUESTION EMBEDDING
    │
    ├─ generateSingleEmbed(question)
    ├─ OpenRouter API call
    ├─ Returns: number[1536]
    │
    ▼
QUERY VECTOR INDICES
    │
    ├─ Query 1: BothASTNode embeddings
    │  ┌────────────────────────────────────┐
    │  │ CALL db.index.vector.queryNodes(   │
    │  │   'astnode_embedding',             │
    │  │   $limit * 3,                      │
    │  │   $queryEmbedding                  │
    │  │ )                                  │
    │  │ YIELD node, score                  │
    │  │ WHERE node.repoId = $repoId        │
    │  └────────────────────────────────────┘
    │
    ├─ Query 2: TextChunk embeddings
    │  ┌────────────────────────────────────┐
    │  │ CALL db.index.vector.queryNodes(   │
    │  │   'textchunk_embedding',           │
    │  │   $limit * 3,                      │
    │  │   $queryEmbedding                  │
    │  │ )                                  │
    │  │ YIELD node, score                  │
    │  │ WHERE node.repoId = $repoId        │
    │  └────────────────────────────────────┘
    │
    ▼
MERGE & RANK RESULTS
    │
    ├─ Combine both result sets
    ├─ Sort by score DESC (highest first)
    ├─ Take top-k (default 10)
    │
    ▼
RETURN SIMILAR ITEMS
    │
    ├─ AstNode matches (with score)
    │  ├─ symbol: "function name"
    │  ├─ filePath: "src/main.ts"
    │  ├─ chunkText: "snippet..."
    │  ├─ startLine, endLine
    │  └─ score: 0.95
    │
    ├─ TextChunk matches (with score)
    │  ├─ content: "explanation..."
    │  ├─ filePath: "docs/guide.md"
    │  ├─ score: 0.82
    │  └─ startLine, endLine
    │
    ▼
ASSEMBLE INTO CONTEXT
    │
    ├─ Create unified response
    ├─ Include: file content, snippets, explanations
    │
    ▼
PASS TO LLM
    │
    ├─ LLM generates answer based on context
    ├─ LLM has visibility to source materials
    └─ Generates grounded, referenced response
```

---

## Database Schema Relationships

```
┌─────────────────────────────────────────────────────────────────┐
│                        GRAPH SCHEMA                             │
└─────────────────────────────────────────────────────────────────┘

                            Repo
                             │
                         HAS_ROOT
                             │
                    ┌────────┴────────┐
                    │                 │
                Directory          CodeFile
                    │               │  │  │
              CONTAINS          HAS_AST │ (embeddings)
                    │               │  │
                Directory        AstNode
                    │              │
                CodeFile       NEXT_AST
                CodeFile       IMPORTS
                TextFile       EXTENDS
                               OVERRIDES

                        TextFile
                             │
                        HAS_CHUNK
                             │
                        TextChunk
                          │  │  │
                     NEXT_CHUNK MENTIONS
                          │  │   │
                      TextChunk AstNode
                               (embeddings)


EDGE TYPES (11 total):
═══════════════════════════════════════════════

CONTAINS (Directory/Repo → Directory/File)
├─ Used for: Navigation, hierarchy
├─ Properties: parent-child relationships
└─ Multiplicity: One-to-many

HAS_AST (CodeFile → AstNode)
├─ Used for: Code fragments in file
├─ Properties: from file to its declarations
└─ Multiplicity: One-to-many

NEXT_AST (AstNode → AstNode)
├─ Used for: Sequential segments
├─ Properties: ordering within file
└─ Multiplicity: One-to-one

HAS_CHUNK (TextFile → TextChunk)
├─ Used for: Text segments
├─ Properties: chunk indexing
└─ Multiplicity: One-to-many

NEXT_CHUNK (TextChunk → TextChunk)
├─ Used for: Sequential text chunks
├─ Properties: chunk ordering
└─ Multiplicity: One-to-one

IMPORTS (CodeFile/AstNode → CodeFile/AstNode)
├─ Used for: Module dependencies
├─ Properties: dependency tracking
└─ Multiplicity: Many-to-many

EXTENDS (AstNode → AstNode)
├─ Used for: Inheritance
├─ Properties: class hierarchy
└─ Multiplicity: Many-to-many

OVERRIDES (AstNode → AstNode)
├─ Used for: Method overrides
├─ Properties: polymorphism tracking
└─ Multiplicity: Many-to-many

DESCRIBES (AstNode → TextChunk)
├─ Used for: Documentation links
├─ Properties: code-to-docs mapping
└─ Multiplicity: Many-to-many

MENTIONS (TextChunk → AstNode)
├─ Used for: Symbol references in docs
├─ Properties: backward reference tracking
└─ Multiplicity: Many-to-many

REFERENCES (CodeFile/TextFile → CodeFile/TextFile)
├─ Used for: File-level references
├─ Properties: file dependencies
└─ Multiplicity: Many-to-many
```

---

## Embedding Integration Points

```
EMBEDDING GENERATION
════════════════════════════════════════════════════

    openrouter.textEmbeddingModel("openai/text-embedding-3-small")
                    │
                    ├─ Input: string
                    ├─ Processing: OpenRouter API
                    ├─ Output: number[1536]
                    └─ Fallback: null vector on error

EMBEDDING STORAGE
════════════════════════════════════════════════════

    AstNode nodes store embeddings:
    ├─ node.embeddings: number[1536]
    ├─ Index: astnode_embedding
    ├─ Similarity: cosine
    └─ Query: db.index.vector.queryNodes()

    TextChunk nodes store embeddings:
    ├─ node.embeddings: number[1536]
    ├─ Index: textchunk_embedding
    ├─ Similarity: cosine
    └─ Query: db.index.vector.queryNodes()

    CodeFile nodes store optional embeddings:
    ├─ node.embeddings: number[1536] (optional)
    ├─ Index: codefile_embedding
    ├─ Similarity: cosine
    └─ Used for: File-level searches

    TextFile nodes store optional embeddings:
    ├─ node.embeddings: number[1536] (optional)
    ├─ Index: textfile_embedding
    ├─ Similarity: cosine
    └─ Used for: File-level searches

EMBEDDING PIPELINE
════════════════════════════════════════════════════

    CodeSegment text extraction:
    ├─ Start line from symbol range
    ├─ End line from symbol range
    ├─ Extract source code snippet
    ├─ Pass to generateEmbeddings()
    └─ Store in AstNode.embeddings

    TextChunk embedding:
    ├─ Content from fixed-size chunks
    ├─ 24 lines per chunk (default)
    ├─ Pass to generateEmbeddings()
    └─ Store in TextChunk.embeddings

EMBEDDING QUERY (RAG)
════════════════════════════════════════════════════

    User question:
    ├─ generateSingleEmbed(question)
    ├─ Returns: queryEmbedding (1536-dim)
    │
    ├─ Query astnode_embedding index
    │  ├─ Return top-30 (for filtering)
    │  ├─ Filter by repoId
    │  ├─ Keep top-10
    │  └─ Include: score, name, startLine, endLine
    │
    ├─ Query textchunk_embedding index
    │  ├─ Return top-30 (for filtering)
    │  ├─ Filter by repoId
    │  ├─ Keep top-10
    │  └─ Include: score, content, startLine, endLine
    │
    ├─ Merge results (max 20 total)
    ├─ Sort by score descending
    └─ Pass to LLM for contextualization
```

---

## State Management Flow

```
FIRST RUN (Full Index)
═════════════════════════════════════════════════

    mkdir .codeatlas
    └─ index-state.json doesn't exist

    indexRepository(..., mode: 'full')
    ├─ scanRepo() → detects all files
    ├─ loadIndexState() → returns null (first run)
    ├─ effectedMode = 'full' (forced)
    ├─ filesToProcess = all files
    ├─ Parse all files
    ├─ Build complete IR
    ├─ Ingest all nodes/edges
    ├─ Generate all embeddings
    ├─ saveIndexState()
    │  └─ .codeatlas/index-state.json
    │     {
    │       version: 2,
    │       scannedAt: "2026-04-16T...",
    │       files: {
    │         "src/main.ts": {
    │           kind: "code",
    │           mtimeMs: 1234567890,
    │           size: 5000,
    │           hash: "abc123..." (optional)
    │         }
    │       }
    │     }
    └─ ✅ Done


SUBSEQUENT RUN (Incremental)
═════════════════════════════════════════════════

    indexRepository(..., mode: 'incremental')
    ├─ scanRepo() → detects current files
    ├─ loadIndexState() → reads saved state
    ├─ diffScan() → compares
    │  ├─ File A.ts: mtime same, size same → NOT changed
    │  ├─ File B.ts: mtime NEW, size NEW → CHANGED
    │  ├─ File C.ts: size 0 → REMOVED
    │  └─ File D.ts: not in old state → ADDED
    │  
    │  Result:
    │  ├─ added: [D.ts]
    │  ├─ changed: [B.ts]
    │  └─ removed: [C.ts]
    │
    ├─ findImportDependents()
    │  └─ Query Neo4j for files importing [B.ts, C.ts]
    │  └─ Returns: [E.ts, F.ts] (transitively import B or C)
    │
    ├─ filesToProcess = [D.ts, B.ts, E.ts, F.ts]
    ├─ For each in filesToProcess:
    │  ├─ If changed: deleteCodeFileDerived()
    │  ├─ Re-parse
    │  ├─ Re-build IR
    │  └─ Re-embed
    │
    ├─ For C.ts (removed):
    │  └─ deleteFile() cascade
    │
    ├─ Ingest updated IR
    ├─ saveIndexState() (updated)
    │  └─ .codeatlas/index-state.json
    │     {
    │       version: 2,
    │       scannedAt: "2026-04-16T11:00:00Z" (NEW TIME),
    │       files: {
    │         "src/main.ts": { ... (unchanged) },
    │         "src/B.ts": { mtimeMs: NEW, ... },
    │         "src/D.ts": { kind: "code", ... },
    │         // "src/C.ts" removed
    │       }
    │     }
    └─ ✅ Done


HASH MODES
═════════════════════════════════════════════════

    mode: "none"
    ├─ No hash computation
    ├─ Relies on mtime + size
    ├─ Fast but may miss changes if clock issues
    └─ Suitable for: Local development

    mode: "code"
    ├─ Hash code files only (.ts, .js, .py, etc)
    ├─ Skip hashing for text (.md, .txt)
    ├─ Good performance, good accuracy
    └─ Suggested: Default, recommended

    mode: "all"
    ├─ Hash everything (code + text)
    ├─ Slowest but most accurate
    ├─ Detects even trivial whitespace changes
    └─ Use for: CI/CD pipelines
```

---

## Performance Characteristics

### Embedding Generation
- **Time per text:** 100-300ms (network dependent)
- **Batch overhead:** Minimal (sequential processing)
- **Fallback time:** <1ms (returns null vector)
- **Dimension:** 1536 (fixed by model)

### Vector Search
- **Query time:** 10-50ms per search
- **Index size:** ~0.5GB per 100K embeddings
- **Memory:** Loaded fully in Neo4j (configurable)
- **Throughput:** 20-100 queries/sec per instance

### Parsing
- **Time per file:** 10-100ms (size dependent)
- **Small file (<1KB):** ~10ms
- **Medium file (1-10KB):** ~50ms
- **Large file (10-100KB):** ~100ms

### Incremental Indexing
- **Change detection:** O(n) where n = files in last scan
- **Hash computation:** O(1) per file if SHA1
- **Dependency query:** O(m log n) where m = dependents
- **Full re-index:** 2-5x slower than incremental

### Ingestion
- **Batch size:** 1000 nodes/batch
- **Throughput:** 10K-50K nodes/min
- **Edge creation:** Sequential (transactional)
- **Retry overhead:** 50-200ms per retry (with backoff)

---

## Error Recovery

```
EMBEDDING FAILURES
═════════════════════════════════════════════════

    OpenRouter API error
    ├─ Log error
    ├─ Emit null vector (all zeros)
    ├─ Continue processing
    ├─ Vector search will still work (bad matching)
    └─ Detect: Monitor for zero vectors in DB

    Recovery:
    ├─ Check API key validity
    ├─ Check network connectivity
    ├─ Retry with exponential backoff
    └─ Re-run embedASTFiles() on failed nodes


PARSING FAILURES
═════════════════════════════════════════════════

    Tree-sitter parse error
    ├─ Try language-specific extractor
    ├─ Fall back to textFallback extractor
    ├─ Set parseStatus = "failed"
    ├─ Continue with partial extraction
    └─ Log warning with line number

    Recovery:
    ├─ Check file syntax validity
    ├─ Fix syntax errors
    ├─ Re-run parse phase
    └─ No manual DB cleanup needed


NEO4J CONNECTION FAILURES
═════════════════════════════════════════════════

    Connection refused
    ├─ Caught in indexRepository
    ├─ Throws error up to caller
    ├─ No Neo4j side effects applied
    └─ Safe to retry

    Deadlock detected
    ├─ Caught in runWithRetry
    ├─ Exponential backoff: 50ms * 2^attempt
    ├─ Max 5 retries
    ├─ Throws after max retries exceeded
    └─ Transaction rolled back automatically


DEPENDENCY QUERY FAILURES
═════════════════════════════════════════════════

    Query times out
    ├─ Caught in findImportDependents
    ├─ Empty dependents array returned
    ├─ No transitivedependents re-indexed
    └─ Log warning, proceed with basic incremental

    Neo4j offline
    ├─ Caught in try-catch
    ├─ Empty dependents array returned
    └─ Proceed with changed files only (safe)
```

---

## Monitoring Checklist

### Health Checks
```
✅ OpenRouter API reachable
✅ Neo4j connected and responsive
✅ Vector indices populated
✅ Embeddings generated (non-null)
✅ Graph schema valid
✅ Latest index completed successfully
```

### Performance Metrics
```
⏱️  Last indexing duration
📊 File count indexed
🔍 Average vector search latency
💾 Database size (nodes, edges)
📈 Embedding generation rate (texts/sec)
```

### Data Quality
```
✅ No zero vectors (all-null embeddings)
✅ All non-null vectors have dimension 1536
✅ Score values between 0 and 1
✅ No orphaned nodes (unreachable from Repo)
✅ All edges reference existing nodes
```

---

## Configuration Reference

```typescript
// embeddings.ts
const EMBEDDING_MODEL = "openai/text-embedding-3-small"
const EMBEDDING_DIMENSION = 1536

// segmentCode.ts
const SMALL_FILE_LINES = 80
const MAX_SEGMENT_LINES = 120
const MAX_SYMBOLS_PER_COMPOSITE = 3
const STANDALONE_SYMBOL_LINES = 60
const SPLIT_THRESHOLD_LINES = 200

// ingest.ts
const BATCH_SIZE = 1000
const MAX_RETRIES = 5

// invalidate.ts
const MAX_DEPENDENCY_DEPTH = 10 (configurable)
const MAX_DEPTH_LIMIT = 25 (hard limit)

// indexState.ts - Hash modes
"none" | "code" | "all"

// RAG search
const DEFAULT_SEARCH_LIMIT = 10
const FETCH_MULTIPLIER = 3 (fetch 30 for filtering)
```

---

## Breaking Changes & Compatibility

### Version 2 State File
- Previous versions used different structure
- Auto-migration: loadIndexState() handles v1→v2
- Recommendation: Full re-index after upgrade

### Embedding Dimension
- `text-embedding-3-small` always returns 1536
- Changing models requires full re-embedding
- Vector indices dimensionality must match

### Neo4j Version
- Requires Neo4j 5.x+ for vector indices
- Earlier versions fall back to standard indices (slower)

### Schema Constraints
- All idempotent (IF NOT EXISTS)
- Safe to re-run ensureSchema()
- No breaking changes between runs

