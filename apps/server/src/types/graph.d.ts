type FileNode = {
    basename: string,
    relative_path: string
}
type DirectoryNode = {
    basename: string,
    relative_path: string,
    isDirectory: true,
    children?: GraphNode[]
}
type ASTNode = {
    type: string,
    start_line:number,
    end_line:number,
    text: string,
}
type TextNode = {
    text: string,
    start_line: number,
    end_line: number
}

type GraphNode = {
    id: string,
    type: FileNode | DirectoryNode | ASTNode | TextNode,
}

type GraphEdgeTypes = 'PARENT_OF' | 'HAS_FILE' | 'HAS_AST' | 'HAS_TEXT' | 'NEXT_TEXT_CHUNK' ;


type KnowledgeGraphEdge = {
    source: string,
    target: string,
    type: GraphEdgeTypes,
    metadata?: Record<string, any>
}
export type { FileNode, DirectoryNode, ASTNode, TextNode, GraphNode, KnowledgeGraphEdge, GraphEdgeTypes }