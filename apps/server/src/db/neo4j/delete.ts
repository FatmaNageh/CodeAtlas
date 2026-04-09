import { getNeo4jClient } from "./client";
import { fileId } from "@/pipeline/id";

// Phase 1: delete whole repo subgraph
export async function deleteRepo(repoId: string): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  try {
    await session.run(
      `
      MATCH (n)
      WHERE n.repoId = $repoId OR n.id = $repoNodeId
      DETACH DELETE n
      `,
      { repoId, repoNodeId: `repo:${repoId}` },
    );
  } finally {
    await session.close();
  }
}

/**
 * Phase 1 incremental strategy: delete everything derived from a single file,
 * while preserving the :File node itself (and any incoming edges from other files).
 */
export async function deleteFileDerived(repoId: string, relPath: string): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const fid = fileId(repoId, relPath);
  try {
    await session.run(
      `
      MATCH (f {id: $fileId})
      WHERE f:CodeFile OR f:TextFile
      OPTIONAL MATCH (f)-[r:REFERENCES|MENTIONS]->()
      DELETE r
      `,
      { fileId: fid },
    );

    await session.run(
      `
      MATCH (f:CodeFile {id: $fileId})
      OPTIONAL MATCH (f)-[:DECLARES|HAS_AST_ROOT]->(root:ASTNode)
      OPTIONAL MATCH (root)-[:AST_CHILD*0..]->(a:ASTNode)
      DETACH DELETE a
      `,
      { fileId: fid },
    );

    await session.run(
      `
      MATCH (f:TextFile {id: $fileId})
      OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:TXTChunk)
      DETACH DELETE c
      `,
      { fileId: fid },
    );
  } finally {
    await session.close();
  }
}

/** Delete a file node and everything attached to it (for removed files). */
export async function deleteFile(repoId: string, relPath: string): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const fid = fileId(repoId, relPath);
  try {
    await session.run(
      `
      MATCH (f {id: $fileId})
      WHERE f:CodeFile OR f:TextFile
      DETACH DELETE f
      `,
      { fileId: fid },
    );
  } finally {
    await session.close();
  }
}