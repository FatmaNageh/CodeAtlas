import "dotenv/config";
import { getNeo4jClient } from "../src/db/neo4j/client";

async function main() {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  
  try {
    console.log("=== SCHEMA VISUALIZATION ===\n");
    const result = await session.run(`CALL db.schema.visualization()`);
    
    if (result.records.length === 0) {
      console.log("No schema information returned.");
      return;
    }
    
    for (const record of result.records) {
      console.log(JSON.stringify(record.toObject(), null, 2));
    }
    
    console.log("\n=== LABELS & RELATIONSHIPS ===\n");
    const labels = await session.run(`CALL db.labels()`);
    console.log("Labels:", labels.records.map(r => r.get(0)));
    
    const rels = await session.run(`CALL db.relationshipTypes()`);
    console.log("Relationships:", rels.records.map(r => r.get(0)));
  } finally {
    await session.close();
  }
}

main().catch(console.error);