import neo4j from "neo4j-driver";

const driver = neo4j.driver(
  "neo4j://localhost",
  neo4j.auth.basic("neo4j", "password") // change your credentials
);

export async function saveGraph(data: any[]) {
  const session = driver.session();
  try {
    for (const file of data) {
      await session.run(
        `MERGE (f:File {name: $name, path: $path}) RETURN f`,
        { name: file.file, path: file.path }
      );

      for (const imp of file.imports) {
        await session.run(
          `MERGE (i:Import {text: $imp})
           WITH i
           MATCH (f:File {name: $name})
           MERGE (f)-[:IMPORTS]->(i)`,
          { name: file.file, imp }
        );
      }

      for (const fn of file.functions) {
        await session.run(
          `MERGE (fn:Function {name: $fn})
           WITH fn
           MATCH (f:File {name: $name})
           MERGE (f)-[:DECLARES]->(fn)`,
          { name: file.file, fn }
        );
      }

      for (const cls of file.classes) {
        await session.run(
          `MERGE (c:Class {name: $cls})
           WITH c
           MATCH (f:File {name: $name})
           MERGE (f)-[:DECLARES]->(c)`,
          { name: file.file, cls }
        );
      }
    }
  } finally {
    await session.close();
  }
}

export async function closeDriver() {
  await driver.close();
}
