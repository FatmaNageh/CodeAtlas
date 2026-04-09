export interface CodeNode {
  path: string;
  file: string;
  isDirectory: boolean;
  imports: string[];
  functions: string[];
  classes: string[];
  modules: string[];
  children: CodeNode[];
}

export interface D3Node extends CodeNode {
  id: string;
  index?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
}
