import * as d3 from "d3";

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

export interface D3Node extends CodeNode, d3.SimulationNodeDatum {
  id: string;
}

export interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: string | D3Node | number;
  target: string | D3Node | number;
}