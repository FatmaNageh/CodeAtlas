import { type Driver, driver as createDriver, auth } from 'neo4j-driver';
import type { ParsedNode } from './parser';

const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env;

if (!NEO4J_URI || !NEO4J_USERNAME || !NEO4J_PASSWORD) {
  throw new Error('Missing Neo4j environment variables');
}

export class Neo4jService {
  private driver: Driver;

  constructor() {
    this.driver = createDriver(NEO4J_URI!, auth.basic(NEO4J_USERNAME!, NEO4J_PASSWORD!));
  }

  async close() {
    await this.driver.close();
  }

  async clearDatabase() {
    const session = this.driver.session();
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  }

  async saveParsedNode(node: ParsedNode, parentPath?: string): Promise<void> {
    const session = this.driver.session();
    try {
      // Save the node itself
      await session.run(
        `
        MERGE (n:Node {path: $path})
        SET n.name = $name,
            n.isDirectory = $isDirectory,
            n.file = $file
        RETURN n
        `,
        {
          path: node.path,
          name: node.file,
          isDirectory: node.isDirectory,
          file: node.file
        }
      );

      // Create parent relationship if provided
      if (parentPath) {
        await session.run(
          `
          MATCH (c:Node {path: $childPath}), (p:Node {path: $parentPath})
          MERGE (p)-[:CONTAINS]->(c)
          `,
          {
            childPath: node.path,
            parentPath: parentPath
          }
        );
      }

      // Save imports
      for (const imp of node.imports) {
        await session.run(
          `
          MATCH (n:Node {path: $path})
          MERGE (i:Import {name: $importName})
          MERGE (n)-[:IMPORTS]->(i)
          `,
          {
            path: node.path,
            importName: imp
          }
        );
      }

      // Save functions
      for (const func of node.functions) {
        await session.run(
          `
          MATCH (n:Node {path: $path})
          MERGE (f:Function {name: $functionName})
          MERGE (n)-[:CONTAINS_FUNCTION]->(f)
          `,
          {
            path: node.path,
            functionName: func
          }
        );
      }

      // Save classes
      for (const cls of node.classes) {
        await session.run(
          `
          MATCH (n:Node {path: $path})
          MERGE (c:Class {name: $className})
          MERGE (n)-[:CONTAINS_CLASS]->(c)
          `,
          {
            path: node.path,
            className: cls
          }
        );
      }

      // Save modules
      for (const module of node.modules) {
        await session.run(
          `
          MATCH (n:Node {path: $path})
          MERGE (m:Module {name: $moduleName})
          MERGE (n)-[:CONTAINS_MODULE]->(m)
          `,
          {
            path: node.path,
            moduleName: module
          }
        );
      }

      // Recursively save children
      for (const child of node.children) {
        await this.saveParsedNode(child, node.path);
      }

    } finally {
      await session.close();
    }
  }

  async getProjectGraph(): Promise<any> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (n:Node)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        `
      );
      return result.records;
    } finally {
      await session.close();
    }
  }
}

let neo4jService: Neo4jService;

export function getNeo4jService(): Neo4jService {
  if (!neo4jService) {
    neo4jService = new Neo4jService();
  }
  return neo4jService;
}
