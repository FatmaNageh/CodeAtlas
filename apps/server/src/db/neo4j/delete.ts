import { getNeo4jClient } from "./client";
import {
  repoNodeId,
  codeFileNodeId,
  textFileNodeId,
  normalizeRepoRelativePath,
} from "@/pipeline/id";

export async function deleteRepo(repoId: string, repoRoot: string): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();

  try {
    await session.run(
      `/*cypher*/
      MATCH (n)
      WHERE n.repoId = $repoId OR n.id = $repoNodeId
      DETACH DELETE n
      `,
      {
        repoId,
        repoNodeId: repoNodeId(repoRoot),
      },
    );
  } finally {
    await session.close();
  }
}

export async function deleteCodeFileDerived(repoId: string, relPath: string): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const normalizedRelPath = normalizeRepoRelativePath(relPath);
  const fileNodeId = codeFileNodeId(repoId, normalizedRelPath);

  try {
    // Delete file-owned semantic edges.
    await session.run(
      `/*cypher*/
      MATCH ()-[r]->()
      WHERE r.repoId = $repoId
        AND r.sourceFilePath = $relPath
      DELETE r
      `,
      { repoId, relPath: normalizedRelPath },
    );

    // Delete AST subtree derived from this file.
    await session.run(
      `/*cypher*/
      MATCH (f:CodeFile {id: $fileId})
      OPTIONAL MATCH (f)-[:HAS_AST]->(a:AstNode)
      WITH collect(DISTINCT a) AS astNodes
      FOREACH (n IN astNodes | DETACH DELETE n)
      `,
      { fileId: fileNodeId },
    );
  } finally {
    await session.close();
  }
}


export async function deleteTextFileDerived(repoId: string, relPath: string): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const normalizedRelPath = normalizeRepoRelativePath(relPath);
  const fileNodeId = textFileNodeId(repoId, normalizedRelPath);

  try {
    // Delete file-owned semantic edges.
    await session.run(
      `/*cypher*/
      MATCH ()-[r]->()
      WHERE r.repoId = $repoId
        AND r.sourceFilePath = $relPath
      DELETE r
      `,
      { repoId, relPath: normalizedRelPath },
    );

    // Delete text chunks derived from this file.
    await session.run(
      `/*cypher*/
      MATCH (f:TextFile {id: $fileId})
      OPTIONAL MATCH (f)-[:HAS_CHUNK]->(c:TextChunk)
      DETACH DELETE c
      `,
      { fileId: fileNodeId },
    );
  } finally {
    await session.close();
  }
}


export async function deleteFile(
  repoId: string,
  relPath: string,
  kind: "code" | "text",
): Promise<void> {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  const normalizedRelPath = normalizeRepoRelativePath(relPath);
  const fileNodeId =
    kind === "code"
      ? codeFileNodeId(repoId, normalizedRelPath)
      : textFileNodeId(repoId, normalizedRelPath);

  try {
    await session.run(
      `/*cypher*/
      MATCH (f {id: $fileId})
      DETACH DELETE f
      `,
      { fileId: fileNodeId },
    );
  } finally {
    await session.close();
  }
}
