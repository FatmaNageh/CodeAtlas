import { getNeo4jClient } from "../src/db/neo4j/client";

async function main() {
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  
  try {
    const result = await session.run(`
      MATCH (n)
      RETURN labels(n) as lbl, count(*) as cnt
      ORDER BY lbl[0]
    `);
    
    console.log("=== NODE TYPES IN DB ===");
    for (const record of result.records) {
      const lbl = record.get("lbl");
      const cnt = record.get("cnt");
      console.log(`${lbl[0]}: ${cnt}`);
    }
  } finally {
    await session.close();
  }
}

main().catch(console.error);
