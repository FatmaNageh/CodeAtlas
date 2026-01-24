export const Queries = {
  repoSummary: `
    MATCH (r:Repo {id: $repoNodeId})
    OPTIONAL MATCH (r)-[:CONTAINS]->(d:Directory)
    OPTIONAL MATCH (d)-[:CONTAINS]->(f:File)
    RETURN r, count(DISTINCT d) AS directories, count(DISTINCT f) AS files
  `,
  searchSymbols: `
    MATCH (s:Symbol)
    WHERE s.repoId = $repoId AND toLower(s.name) CONTAINS toLower($q)
    RETURN s
    ORDER BY s.name
    LIMIT $limit
  `,
  fileDetails: `
    MATCH (f:File {id: $fileId})
    OPTIONAL MATCH (f)-[:DECLARES]->(s:Symbol)
    OPTIONAL MATCH (f)-[:IMPORTS_RAW]->(i:Import)
    RETURN f, collect(DISTINCT s) AS symbols, collect(DISTINCT i) AS imports
  `,
  fileImpact: `
    MATCH (t:File {id: $fileId})
    OPTIONAL MATCH (src:File)-[:IMPORTS]->(t)
    RETURN t AS target, collect(DISTINCT src) AS importers
  `,
  treeRoot: `
    MATCH (r:Repo {id: $repoNodeId})-[:CONTAINS]->(d:Directory)
    WHERE d.relPath = '.'
    RETURN r, d
  `,
  listDirectory: `
    MATCH (d:Directory {id: $dirId})-[:CONTAINS]->(child)
    RETURN d, collect(child) AS children
  `,
  expandNeighborhood: `
    MATCH (n {id: $nodeId})
    OPTIONAL MATCH (n)-[r1]->(m)
    OPTIONAL MATCH (k)-[r2]->(n)
    RETURN n,
           collect(DISTINCT {r: r1, m: m}) AS out,
           collect(DISTINCT {r: r2, k: k}) AS in
  `,
} as const;
