import { Hono } from 'hono';
import path from 'path';
import { embedASTFiles } from '../pipeline/embed/embedASTFiles';
import { generateBatchSummaries } from '../pipeline/generateSummary';
import { assembleFileContext } from '../retrieval/context';
import { generateTextWithContext } from '../ai/generation';
import { generateEmbedding } from '../ai/embeddings';
import { findSimilarChunks } from '../retrieval/vector';
import { runCypher } from '../db/cypher';
import { repoRoots } from '../state/repoRoots';

export const graphragRoute = new Hono();

// Helper: Convert absolute Windows/macOS paths to repo-relative POSIX paths
function normalizeToRepoPath(filePath: string, repoRoot: string): string {
  // Trim whitespace and quotes
  let p = filePath.trim().replace(/^["'](.*)["']$/, '$1');
  
  // If it's an absolute path, make it relative to repoRoot
  if (path.isAbsolute(p)) {
    p = path.relative(repoRoot, p);
  }
  
  // Convert backslashes to forward slashes for cross-platform consistency
  return p.replace(/\\/g, '/');
}

// POST /graphrag/embedRepo - Generate embeddings for entire repo
graphragRoute.post('/embedRepo', async (c) => {
  const { repoId, repoRoot } = await c.req.json().catch(() => ({}));
  
  if (!repoId || !repoRoot) {
    return c.json({ ok: false, error: 'Missing repoId or repoRoot' }, 400);
  }

  try {
    // Store repoRoot so /graphrag/summarize can normalize paths
    repoRoots.set(repoId, repoRoot);
    console.log(`[EMBED] Stored repoRoot for ${repoId}: ${repoRoot}`);
    
    const result = await embedASTFiles(repoId, repoRoot);
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /graphrag/summarize - Generate file summaries
graphragRoute.post('/summarize', async (c) => {
  const { repoId, filePaths, repoRoot: reqRepoRoot } = await c.req.json().catch(() => ({}));
  
  if (!repoId) {
    return c.json({ ok: false, error: 'Missing repoId' }, 400);
  }

  // Get repo root for path normalization - from request body or memory
  let repoRoot = reqRepoRoot || repoRoots.get(repoId);
  
  // If we have absolute paths but no repoRoot, we can't normalize
  if (!repoRoot && filePaths && filePaths.length > 0) {
    // Check if any path is absolute
    const hasAbsolutePath = filePaths.some((fp: string) => path.isAbsolute(fp));
    if (hasAbsolutePath) {
      return c.json({ 
        ok: false, 
        error: `Unknown repoId: ${repoId}. Please provide repoRoot in request or call /graphrag/embedRepo first.` 
      }, 400);
    }
  }
  
  // Store repoRoot if provided in request for future use
  if (reqRepoRoot && repoId) {
    repoRoots.set(repoId, reqRepoRoot);
    console.log(`[SUMMARIZE] Stored repoRoot for ${repoId}: ${reqRepoRoot}`);
  }

  try {
    let files: string[];
    
    if (filePaths && filePaths.length > 0) {
      // Normalize provided file paths to repo-relative format
      files = filePaths.map((fp: string) => {
        if (repoRoot) {
          return normalizeToRepoPath(fp, repoRoot);
        }
        // If no repoRoot but paths are already relative, use as-is
        return fp.replace(/\\/g, '/');
      });
      console.log(`[SUMMARIZE] Normalized ${files.length} paths for repo ${repoId}`);
    } else {
      // Get all files from database
      files = (await getAllFiles(repoId)).map((f: any) => f.filePath);
    }
    
    const { results, errors } = await generateBatchSummaries(files, repoId);
    return c.json({ ok: true, results, errors });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// POST /graphrag/ask - Q&A about code using RAG
graphragRoute.post('/ask', async (c) => {
  const { repoId, question } = await c.req.json().catch(() => ({}));
  
  if (!repoId || !question) {
    return c.json({ ok: false, error: 'Missing repoId or question' }, 400);
  }

  try {
    // Embed question
    const queryEmbedding = await generateEmbedding(question);
    
    // Find relevant chunks
    const chunks = await findSimilarChunks(queryEmbedding, repoId, 5);
    
    // Build context
    const context = chunks.map((c: any) => c.node.text).join('\n\n');
    const prompt = `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer concisely:`;
    
    // Generate answer
    const answer = await generateTextWithContext(prompt, { maxTokens: 1000 });
    
    return c.json({
      ok: true,
      answer,
      sources: chunks.map((c: any) => ({
        file: c.node.relPath,
        symbol: c.node.symbol,
        score: c.score,
      })),
    });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// GET /graphrag/context/:filePath - Retrieve assembled context
graphragRoute.get('/context/:filePath', async (c) => {
  const filePath = c.req.param('filePath');
  const repoId = c.req.query('repoId');
  
  if (!repoId) {
    return c.json({ ok: false, error: 'Missing repoId' }, 400);
  }

  try {
    const context = await assembleFileContext(filePath, repoId);
    return c.json({ ok: true, context });
  } catch (err) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// GET /graphrag/test-embedding - Test if embeddings are working
graphragRoute.get('/test-embedding', async (c) => {
  try {
    console.log('[TEST] Testing embedding generation...');
    const testText = 'function hello() { return "world"; }';
    const embedding = await generateEmbedding(testText);
    
    return c.json({
      ok: true,
      message: 'Embedding generation works!',
      embeddingLength: embedding.length,
      sample: embedding.slice(0, 5),
    });
  } catch (err) {
    console.error('[TEST] Embedding test failed:', err);
    return c.json({ 
      ok: false, 
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined 
    }, 500);
  }
});

// Helper function
async function getAllFiles(repoId: string) {
  return runCypher(
    'MATCH (f:CodeFile {repoId: $repoId}) RETURN f.relPath as filePath',
    { repoId }
  );
}
