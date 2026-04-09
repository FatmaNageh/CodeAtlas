import { getNeo4jClient } from "../src/db/neo4j/client";

async function main() {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  
  try {
    const nodes = await session.run(`
      MATCH (n)
      RETURN labels(n)[0] as label, count(*) as count
      ORDER BY label
    `);
    
    console.log("=== NODES ===");
    for (const record of nodes.records) {
      console.log(record.get("label"), record.get("count"));
    }

    const edges = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) as type, count(*) as count
      ORDER BY type
    `);
    
    console.log("\n=== EDGES ===");
    for (const record of edges.records) {
      console.log(record.get("type"), record.get("count"));
    }
  } finally {
    await session.close();
  }
}

main().catch(console.error);
