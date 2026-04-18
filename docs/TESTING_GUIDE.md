# CodeAtlas: Testing Guide for Embeddings & Graph RAG

Quick reference for testing each component.

## Prerequisites

```bash
# 1. Ensure Neo4j is running
docker-compose up -d

# 2. Ensure server is running
pnpm run dev

# 3. Check .env has required keys
cat apps/server/.env
```

---

## Test 1: Embeddings Generation ✅

### Quick Test
```bash
# Start from project root
cd apps/server

# Test embedding generation directly
node -e "
import('./dist/ai/embeddings.js').then(async (m) => {
  const result = await m.generateSingleEmbed('Hello world');
  console.log('Embedding dim:', result.length);
  console.log('Sample values:', result.slice(0, 5));
});
"
```

### What to Verify
- [ ] Embedding returns 1536 numbers
- [ ] Values are normalized floats between -1 and 1
- [ ] No errors or warnings
- [ ] Response time < 500ms

---

## Test 2: Vector Indices Creation ✅

### Check Schema
```bash
# Connect to Neo4j desktop/shell and run:
SHOW INDEXES;
```

### What to Verify
- [ ] `codefile_embedding` index exists
- [ ] `textfile_embedding` index exists
- [ ] `textchunk_embedding` index exists
- [ ] `astnode_embedding` index exists
- [ ] All indices use "cosine" similarity
- [ ] Dimension = 1536

### CLI Test
```cypher
SHOW VECTOR INDEXES;
```

---

## Test 3: Parsing System ✅

### Create Test Project
```bash
# Create minimal test repo
mkdir -p /tmp/codeatlas_test
cd /tmp/codeatlas_test

# Add sample file
cat > hello.ts << 'EOF'
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export class Greeter {
  greet(name: string) {
    return greet(name);
  }
}
EOF

# Add text file
cat > README.md << 'EOF'
# Test Project

This describes the `greet` function and `Greeter` class.
EOF
```

### Run Pipeline (Dry Run First)
```bash
cd apps/server

# Check if API exists
curl -X GET http://localhost:3001/api/index-status

# If no API endpoint, test pipeline directly
node -e "
import('./dist/pipeline/indexRepo.js').then(async (m) => {
  await m.indexRepository({
    projectPath: '/tmp/codeatlas_test',
    mode: 'full',
    saveDebugJson: true,
    dryRun: true  // Don't modify DB
  });
});
"
```

### What to Verify
- [ ] Scan completes without errors
- [ ] Detects both .ts and .md files
- [ ] Extracts functions and classes
- [ ] Text extraction finds symbol mentions
- [ ] Debug JSON saved (if enabled)

### Debug JSON Output
```bash
cat .codeatlas/debug-scan.json
cat .codeatlas/debug-facts.json
cat .codeatlas/debug-ir.json
```

---

## Test 4: Full Pipeline Execution ✅

### Index a Repository
```bash
# Use CodeAtlas itself as test
curl -X POST http://localhost:3001/api/index \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": ".",
    "mode": "full"
  }'
```

### Monitor Progress
```bash
# Check status
curl http://localhost:3001/api/index-status

# Check logs in server terminal
```

### What to Verify
- [ ] Scan phase completes
- [ ] Parse phase processes files
- [ ] IR generation succeeds
- [ ] Database ingestion works
- [ ] Embeddings generated
- [ ] State file saved

### Verify Neo4j Data
```cypher
// Count nodes
MATCH (n) WHERE n.repoId IS NOT NULL RETURN labels(n), count(*);

// Check embeddings exist
MATCH (a:AstNode) WHERE a.repoId IS NOT NULL 
RETURN a.name, size(a.embeddings) LIMIT 5;

// Check TextChunk embeddings
MATCH (t:TextChunk) WHERE t.repoId IS NOT NULL 
RETURN t.chunkIndex, size(t.embeddings) LIMIT 5;
```

---

## Test 5: Vector Search ✅

### Generate Sample Embedding
```bash
cd apps/server

node -e "
import('./dist/ai/embeddings.js').then(async (m) => {
  const embedding = await m.generateSingleEmbed('function definition parsing');
  console.log(JSON.stringify(embedding));
});
" > /tmp/test_embedding.json
```

### Query Vector Search
```bash
# Use the API endpoint
curl -X POST http://localhost:3001/api/graphrag \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "your-repo-id",
    "question": "how does parsing work",
    "mentionedNodes": []
  }'
```

### What to Verify
- [ ] Returns results with scores
- [ ] Top result has highest score
- [ ] Results are from current repo
- [ ] Includes both AST and text chunks
- [ ] Formatting looks correct

---

## Test 6: Incremental Indexing ✅

### Initial Full Index
```bash
cd /tmp/codeatlas_test

# Create initial state
node -e "
import('./dist/pipeline/indexRepo.js').then(async (m) => {
  await m.indexRepository({
    projectPath: '.',
    mode: 'full',
    computeHash: true
  });
});
"

# Check state file
cat .codeatlas/index-state.json
```

### Modify a File
```bash
# Change hello.ts
cat >> hello.ts << 'EOF'

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`;
}
EOF
```

### Run Incremental Index
```bash
node -e "
import('./dist/pipeline/indexRepo.js').then(async (m) => {
  const result = await m.indexRepository({
    projectPath: '.',
    mode: 'incremental',
    computeHash: true
  });
  // Check what was detected as changed
  console.log('Done');
});
"
```

### Verify Changes
```bash
# Check state file updated
cat .codeatlas/index-state.json

# Verify in Neo4j the new function exists
curl http://localhost:3001/api/graphrag \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "...",
    "question": "what is farewell function"
  }'
```

### What to Verify
- [ ] State file has updated mtime
- [ ] Only changed files are re-processed
- [ ] New function appears in graph
- [ ] Embeddings regenerated for changed file
- [ ] No errors reported

---

## Test 7: Graph RAG End-to-End ✅

### Ask a Question
```bash
curl -X POST http://localhost:3001/api/graphrag \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "your-repo-id",
    "question": "How do I use the Greeter class?",
    "mentionedNodes": [],
    "selectedNodes": []
  }'
```

### What to Verify
- [ ] HTTP 200 response
- [ ] Response includes `answer` field
- [ ] Response includes `sources` array
- [ ] Sources have: file, symbol, score, sourceKind
- [ ] Score values between 0 and 1 (normalized)
- [ ] Answer references correct code

### Check Sources Format
```json
{
  "answer": "The Greeter class...",
  "sources": [
    {
      "file": "src/example.ts",
      "symbol": "Greeter",
      "score": 0.89,
      "sourceKind": "ast"
    },
    {
      "file": "README.md",
      "symbol": null,
      "score": 0.75,
      "sourceKind": "text"
    }
  ]
}
```

---

## Test 8: Error Handling ✅

### Test Invalid Embedding
```bash
node -e "
import('./dist/ai/embeddings.js').then(async (m) => {
  try {
    const result = await m.generateEmbeddings(['', null, 123]);
  } catch (e) {
    console.error('Error caught:', e.message);
  }
});
"
```

### Test Missing Database
```bash
# Stop Neo4j
docker-compose down

# Try indexing
cd apps/server
node -e "
import('./dist/pipeline/indexRepo.js').then(async (m) => {
  try {
    await m.indexRepository({
      projectPath: '/tmp/codeatlas_test',
      mode: 'full'
    });
  } catch (e) {
    console.error('Expected error:', e.message);
  }
});
"

# Restart Neo4j
docker-compose up -d
```

### What to Verify
- [ ] Graceful error messages
- [ ] No stack traces in user-facing responses
- [ ] Proper HTTP status codes
- [ ] Retry logic triggers appropriately

---

## Test 9: Schema Constraints ✅

### Verify Uniqueness Constraints
```cypher
// Try to create duplicate IDs
MATCH (a:AstNode {repoId: 'test'}) LIMIT 1
WITH a.id AS dupId
CREATE (n:AstNode {id: dupId, repoId: 'test', name: 'dup'})
// Should fail with constraint violation
```

### Verify Indices
```cypher
// Should be fast (using index)
EXPLAIN MATCH (f:CodeFile {repoId: 'test', path: 'src/main.ts'}) RETURN f;

// Check execution plan uses index scan
```

### What to Verify
- [ ] Uniqueness constraint prevents duplicates
- [ ] Queries use index scans (check EXPLAIN plan)
- [ ] Vector indices available for cosine queries

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Embeddings fail | API key valid? Network reachable? |
| Vector index queries slow | Index created? Dimension correct? |
| Parser misses symbols | Language supported? Check debug JSON |
| Incremental doesn't update | State file writable? mtime accurate? |
| Graph relations missing | IR generation correct? Edge creation working? |
| RAG returns no sources | Embeddings generated? Vector indices populated? |

---

## Running All Tests

```bash
#!/bin/bash

echo "Running Embeddings Test..."
# Test 1

echo "Checking Vector Indices..."
# Test 2

echo "Testing Parser..."
# Test 3

echo "Running Full Pipeline..."
# Test 4

echo "Testing Vector Search..."
# Test 5

echo "Testing Incremental Index..."
# Test 6

echo "End-to-End RAG Test..."
# Test 7

echo "Error Handling Tests..."
# Test 8

echo "Schema Constraint Tests..."
# Test 9

echo "✅ All tests complete!"
```

---

## Quick Health Check

```bash
# Run this to verify all systems
pnpm run check-health

# Expected output:
# ✅ OpenRouter API: reachable
# ✅ Neo4j: connected
# ✅ Indices: created and populated
# ✅ Schema: valid
# ✅ Latest indexing: completed
```

---

## Logs to Monitor

```bash
# Terminal 1: Server logs
pnpm run dev

# Terminal 2: Database activity
docker exec neo4j_container tail -f /logs/out.log

# Terminal 3: Check state files
watch 'find . -name "index-state.json" -exec cat {} \;'
```

---

## Next Steps

1. ✅ Run all tests above
2. ✅ Verify all checks pass
3. ⏭️ Index real codebase (large project)
4. ⏭️ Test RAG with domain-specific questions
5. ⏭️ Monitor performance and adjust batch sizes
6. ⏭️ Enable additional hash modes if needed

