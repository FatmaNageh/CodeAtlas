import type * as d3 from 'd3';

export interface CodeNode {
  file: string;
  path: string;
  isDirectory: boolean;
  imports: string[];
  functions: string[];
  classes: string[];
  modules: string[];
  children: CodeNode[];
}

// For D3 simulation
export interface D3Node extends CodeNode, d3.SimulationNodeDatum {
  id: string;
}

// D3Link's source and target are strings at initialization, 
// and d3's force simulation replaces them with D3Node objects.
// Using `any` to accommodate this dynamic nature, matching the existing usage.
export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: any;
  target: any;
}
