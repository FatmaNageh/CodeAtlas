# Changelog

## [0.3.0] — 2026-04-13

### Fixed
- **Critical bug**: inline `onclick` in the server-status banner used a closure variable (`vsc`) that was out of scope in attribute context — replaced with proper `addEventListener` calls.
- `activate()` now catches server start errors without crashing the extension host.
- `.env` parser now handles quoted values, comments, and keys with embedded `=` correctly.
- `autoStartIfAvailable()` now also detects a `server/` directory at the workspace root (not just `apps/server`).
- Graph panel `settings/update` handler no longer reloads when neither serverUrl nor repoId has changed.
- Chat: pressing Send with no Repo ID now shows a helpful actionable message instead of a silent API failure.

### Added
- `Ctrl+Shift+G` / `Cmd+Shift+G` keyboard shortcut to open the graph.
- **CodeAtlas: Open Neo4j Browser** command + "Neo4j ↗" toolbar button.
- **CodeAtlas: Clear Chat History** command + 🗑 button in the chat panel.
- **CodeAtlas: Settings** command with a multi-choice quick-pick (Repo ID, Server URL, Neo4j Browser URL).
- `codeatlas.neo4jBrowserUrl` configuration setting.
- `codeatlas.autoStartServer` toggle (default `true`).
- `codeatlas.graphNodeLimit` setting (50–2000, default 500).
- `codeatlas.autoRefreshGraph` setting — silently refreshes the graph every 30 s when enabled.
- Auto-refresh badge indicator ("⟳ auto") in the graph toolbar.
- Loading screen now shows actionable buttons ("Retry", "Open Neo4j", "Index Repo") on error.
- Markdown rendering in AI chat messages (code blocks, bold, lists, links).
- Better network error messages in the chat (distinguishes connection refused vs API errors).
- Graph panel forwards `allNodes` slice on node click so the chat @-mention list populates faster.
- `onStartupFinished` activation event — extension activates for all workspaces, not just those containing `apps/server`.
- `galleryBanner`, `keywords`, `repository`, `bugs`, `homepage`, `license` fields in `package.json` for Marketplace listing.
- `icon.png` referenced from `package.json`.

### Changed
- Status bar now shows just "$(check) CodeAtlas" when running (URL was too long).
- `serverManager._checkEnv` no longer blocks server start — it warns and continues.
- `broadcastSettings()` helper centralises settings sync to graph panel and chat view.
- `getCfg()` helper reads all settings in one place.
- `.vscodeignore` updated to include `icon.png`.

## [0.2.0] — 2026-04-06

### Added
- Initial public release.
- Graph panel with force-directed layout, filter sidebar, detail + insights tabs.
- AI chat sidebar with @-mention support and embed generation.
- Embedded backend server manager (auto-detect, spawn, monitor).
- Status bar item with server state.
