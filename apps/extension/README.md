# CodeAtlas — Knowledge Graph + AI Chat

> Explore your entire codebase as an interactive Neo4j knowledge graph, then ask AI questions about it — all inside VS Code.

![CodeAtlas Graph](https://raw.githubusercontent.com/codeatlas/codeatlas/main/docs/screenshot.png)

## Features

### 🔭 Interactive Knowledge Graph
- Visualise your codebase as a live **force-directed graph** powered by Neo4j
- Nodes represent **folders, files, classes, and functions**
- Edges show **CONTAINS, IMPORTS, and CALLS** relationships
- Filter by node type, edge type, or search by name
- Drag nodes, zoom, and pan — the layout computes smoothly in one pass

### 🤖 AI Chat Sidebar
- Ask plain-English questions about your code: *"Why is ServerManager so highly connected?"*
- Select any graph node to automatically send it as **AI context**
- Use `@NodeName` to mention specific nodes in your questions
- Markdown-formatted answers with code blocks

### 🗄 One-Click Indexing
- Run **CodeAtlas: Index a Repository** to parse any folder into Neo4j
- Works with TypeScript, JavaScript, Python, Java, Go, and more
- Returns a **Repo ID** that you can reuse across sessions

### ⚙️ Backend Server Manager
- The extension manages a local CodeAtlas backend server automatically
- Status bar shows server state at a glance
- Start, stop, and restart from the command palette or status bar

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Neo4j** | 5.x running locally or via Neo4j Aura. Set `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` in `apps/server/.env` |
| **OpenRouter API key** | For AI answers. Set `OPENROUTER_API_KEY` in `apps/server/.env` |
| **Node.js** | 18+ for the backend server |
| **CodeAtlas backend** | Clone [codeatlas/codeatlas](https://github.com/FatmaNageh/CodeAtlas.git) and open that workspace |

---

## Quick Start

1. **Clone the CodeAtlas monorepo** and open it in VS Code:
   ```bash
   git clone https://github.com/FatmaNageh/CodeAtlas.git
   code codeatlas
   ```
2. **Create `apps/server/.env`** with your credentials:
   ```env
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USERNAME=neo4j
   NEO4J_PASSWORD=your-password
   OPENROUTER_API_KEY=sk-or-...
   ```
3. **Open the Knowledge Graph**: press `Ctrl+Shift+G` (Mac: `Cmd+Shift+G`) or run **CodeAtlas: Open Knowledge Graph** from the command palette.
4. **Index a repository**: click the 🗄 icon in the CodeAtlas sidebar, pick a folder. The extension auto-saves the Repo ID.
5. **Ask the AI**: type in the Chat sidebar, or select a node and click "Add to AI context".

---

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `CodeAtlas: Open Knowledge Graph` | `Ctrl+Shift+G` | Open the interactive graph panel |
| `CodeAtlas: Index a Repository` | — | Parse a folder into Neo4j |
| `CodeAtlas: Settings` | — | Configure server URL, Repo ID, Neo4j URL |
| `CodeAtlas: Server Options` | — | Start / stop / restart the backend |
| `CodeAtlas: Open Neo4j Browser` | — | Jump to Neo4j Browser in your default browser |
| `CodeAtlas: Clear Chat History` | — | Wipe the AI chat log |

---

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codeatlas.serverUrl` | `http://localhost:3000` | Fallback backend URL |
| `codeatlas.repoId` | `""` | Repository ID (set automatically after indexing) |
| `codeatlas.neo4jBrowserUrl` | `http://localhost:7474` | Neo4j Browser URL |
| `codeatlas.autoStartServer` | `true` | Auto-start backend on workspace open |
| `codeatlas.graphNodeLimit` | `500` | Max nodes fetched (50–2000) |
| `codeatlas.autoRefreshGraph` | `false` | Refresh graph every 30 s |

---

## How It Works

```
Your Code ──► CodeAtlas Backend ──► Neo4j Graph DB
                     │
                     ▼
            VS Code Extension
           ├── Graph Panel (SVG force layout)
           └── AI Chat (GraphRAG via OpenRouter)
```

The backend parses your code into **Neo4j nodes and relationships**. The extension fetches this graph over HTTP and renders it as an interactive SVG. The AI chat uses **GraphRAG** — it retrieves relevant graph chunks and uses them as context for the language model.

---

## Troubleshooting

**Graph shows "No nodes found"**
→ Run **CodeAtlas: Index a Repository** first, then paste the returned Repo ID.

**"Cannot find apps/server directory"**
→ Open the root of the CodeAtlas monorepo (not a sub-folder) as your VS Code workspace.

**Server keeps erroring**
→ Check the **CodeAtlas Server** output channel (`View > Output`). Usually a missing `.env` or port conflict.

**Neo4j connection refused**
→ Start Neo4j Desktop or `neo4j start` in your terminal, then restart the backend.

---

## License

MIT © CodeAtlas contributors
