import { Hono } from "hono";
import { getNeo4jClient } from "../neo4j/client";

export const graphRoute = new Hono();

// GET /getGraph all nodes in graph
// @returns records of stuff in db
graphRoute.get("/getGraph", async (c) => {
  const session = getNeo4jClient().session();
  
  const result = await session.executeRead(tx => {
      // The transaction function is executed by the driver
      // The driver automatically retries this function in case of a transient failure
      const cypherQuery = `
        MATCH (n)
        RETURN n
      `;
      const parameters = {};
      return tx.run(cypherQuery, parameters);
    });
 
   console.log(`The query returned ${result.records.length} records.`);
  return c.json({
    data: result.records
  });
});
