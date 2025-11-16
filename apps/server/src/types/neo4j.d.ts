type Neo4jMetadataNode = {
    code_source:string,
    local_path: string,
    https_url?: string,
    branch: string,
    commit_hash?: string,
    [key: string]: any
}

type Neo4jFileNode = {
    node_id:number,
    basename: string,
    relative_path: string,
}


type Neo4jASTNode = {
    node_id:number,
    type: string,
    start_line:number,
    end_line:number,
    text: string,
}

type Neo4jTextNode = {
    node_id:number,
    text: string,
    start_line: number,
    end_line: number
}
type Neo4jHasFileEdge = {
    edge_id: number,
    source_node_id: Neo4jFileNode,
    target_node_id: Neo4jFileNode,
    metadata?: Record<string, any>
}



type Neo4jHasASTEdge = {
    edge_id: number,
    source_node_id: Neo4jFileNode,
    target_node_id: Neo4jASTNode,
    metadata?: Record<string, any>
}

type Neo4jParentOfEdge = {
    edge_id: number,
    source_node_id: Neo4jASTNode,
    target_node_id: Neo4jASTNode,
    metadata?: Record<string, any>
}

type Neo4jHasTextEdge = {
    edge_id: number,
    source_node_id: Neo4jFileNode,
    target_node_id: Neo4jTextNode,
    metadata?: Record<string, any>
}

type Neo4jNextTextChunkEdge = {
    edge_id: number,
    source_node_id: Neo4jTextNode,
    target_node_id: Neo4jTextNode,
    metadata?: Record<string, any>
}

export type { Neo4jMetadataNode }