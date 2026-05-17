import type { SimilarASTNodeRow } from "@/retrieval/vector";

export type GraphRagEvalCase = {
  id: string;
  repoId: string;
  question: string;
  expectedAnswer?: string;
  expectedFacts?: string[];
  expectedSources?: Array<{
    filePath: string;
    symbol?: string;
    sourceKind?: "ast" | "text";
  }>;
  tags: string[];
};

export type GraphRagEvalResult = {
  id: string;
  question: string;
  answer: string;
  retrievedSources: AskSource[];
  error?: string;
  retrieval: {
    prompt: string;
    nodeContext: string;
    codeContext: string;
    summaryContext: string;
    retrievedContext: string;
  };
  scores: {
    retrievalRelevance?: number;
    groundedness?: number;
    answerRelevance?: number;
    correctness?: number;
    sourceRecall?: number;
  };
  labels: {
    groundedness?: string;
    answerRelevance?: string;
    correctness?: string;
  };
  explanations: Record<string, string>;
};

export type AskSource = {
  file: string;
  symbol: string;
  score: number;
  sourceKind: string;
};

export type AskGraphRagInput = {
  repoId: string;
  question: string;
  threadId?: string;
  contextNodeId?: string;
  mentionedNodes?: AskNodeRef[];
  selectedNodes?: AskNodeRef[];
};

export type AskGraphRagResult = {
  answer: string;
  sources: AskSource[];
  embeddingOk: boolean;
  prompt: string;
  nodeContext: string;
  codeContext: string;
  summaryContext: string;
  initialChunks: SimilarASTNodeRow[];
  expandedChunks: SimilarASTNodeRow[];
  retrievedContext: string;
};

export type AskNodeRef = {
  id: string;
  name?: string;
  path?: string;
};
