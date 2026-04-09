import 'dotenv/config';
import { getNeo4jClient } from './src/db/neo4j/client';

async function main() {
  console.log('NEO4J_URI set:', !!process.env.NEO4J_URI);
  console.log('NEO4J_USERNAME set:', !!process.env.NEO4J_USERNAME);
  const neo4j = getNeo4jClient();
  const session = neo4j.session();
  
  const result = await session.run(
    'MATCH (n) WHERE n.embedding IS NOT NULL RETURN labels(n) as nodeType, keys(n) as properties LIMIT 10'
  );
  
  console.log('Nodes with embedding property:');
  result.records.forEach(rec => {
    console.log(JSON.stringify({
      nodeType: rec.get('nodeType'),
      properties: rec.get('properties')
    }));
  });
  
  await session.close();
  await neo4j.close();
}

main().catch(console.error);