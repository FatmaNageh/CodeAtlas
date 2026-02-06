I’ve got a compact, ready-to-run curl checklist for testing the GraphRAG pipeline. It assumes your server is at http://localhost:3000. Replace repoId and repoRoot with your actual values.

Short plan
- Health check
- Discover indexed repos
- Embed a repo
- Summarize files (all or specific)
- Retrieve context for a file
- Q&A (ask)
- Optional test endpoints (embedding test, debug subgraph)

Curl commands

1) Health check
- Purpose: verify the server is up
- Command:
  curl -X GET http://localhost:3000/

2) List indexed repos (diagnostics)
- Purpose: see what repos are known to the server
- Command:
  curl -X GET "http://localhost:3000/diagnostics/repos" --max-time 10

3) Check diagnostics for a specific repo (optional)
- Purpose: sanity-check a particular repo
- Command (replace repoId with actual value from step 2):
  curl -X GET "http://localhost:3000/diagnostics/check?repoId=repo:YOUR_ID" --max-time 10

4) Embed a repository (generate embeddings for all symbols)
- Purpose: create real embeddings stored in Neo4j
- Command (replace with real repoId and root):
  curl -X POST http://localhost:3000/graphrag/embedRepo \
    -H "Content-Type: application/json" \
    -d '{"repoId": "your-repo-id", "repoRoot": "E:/path/to/your/repo"}' --max-time 180000

5) Summarize files (all files in repo)
- Purpose: generate functional summaries for all files
- Command:
  curl -X POST http://localhost:3000/graphrag/summarize \
    -H "Content-Type: application/json" \
    -d '{"repoId": "your-repo-id"}' --max-time 120000

6) Summarize specific files
- Purpose: target a subset to test partial indexing
- Command:
  curl -X POST http://localhost:3000/graphrag/summarize \
    -H "Content-Type: application/json" \
    -d '{"repoId": "your-repo-id", "filePaths": ["src/index.ts","src/utils/helpers.ts"]}' --max-time 120000

7) Get context for a file
- Purpose: fetch assembled context for a given file
- Note: URL-encode the file path
- Command:
  curl -X GET "http://localhost:3000/graphrag/context/src%2Findex.ts?repoId=your-repo-id" --max-time 10

8) Q&A against code (ask)
- Purpose: ask a question and get an answer with sources
- Command:
  curl -X POST http://localhost:3000/graphrag/ask \
    -H "Content-Type: application/json" \
    -d '{"repoId": "your-repo-id", "question": "Explain the main data flow in this file."}' --max-time 60

9) Embedding test endpoint (optional, if you added a test route)
- Purpose: sanity-check embedding function locally
- Command:
  curl -X GET http://localhost:3000/graphrag/test-embedding --max-time 60

10) Debug subgraph (optional)
- Purpose: inspect a small portion of the graph for a repo
- Command:
  curl -X GET "http://localhost:3000/debug/subgraph?repoId=repo:YOUR_ID&limit=5" --max-time 10

11) Index a repo (if you want to re-index after changes)
- Purpose: index a repository path into the system
- Command:
  curl -X POST http://localhost:3000/indexRepo \
    -H "Content-Type: application/json" \
    -d '{"projectPath": "E:/path/to/your/project", "mode": "full"}' --max-time 120000

Tips
- If your server runs on a different port, replace 3000 in all URLs.
- For file paths with spaces, ensure JSON strings are properly quoted; use escape sequences as shown.
- Use a small repo first to confirm the flow end-to-end before scaling to large repos.
- If you get timeouts, increase --max-time accordingly (embedding and generation may take longer on large repos).

If you want, I can generate a single Bash script containing all of the above commands in sequence, with variables you can adjust (BASE_URL, REPO_ID, REPO_ROOT), so you can just run one file to test.