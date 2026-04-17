import fs from 'fs/promises';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildIR } from '@/pipeline/ir';
import { parseAndExtract } from '@/pipeline/parseExtract';
import { scanRepo } from '@/pipeline/scan';

const fixturesDir = path.join(process.cwd(), 'src/__tests__/fixtures');
const tempDir = path.join(fixturesDir, 'temp-buildir-properties');

describe('buildIR node property invariants', () => {
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });

    await fs.writeFile(
      path.join(tempDir, 'src', 'dep.ts'),
      ['export function dep(): string {', '  return "dep";', '}'].join('\n'),
      'utf-8',
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'main.ts'),
      [
        'import { dep } from "./dep";',
        '',
        'export class Service {',
        '  run(): string {',
        '    return dep();',
        '  }',
        '}',
      ].join('\n'),
      'utf-8',
    );
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('builds CodeFile/AstNode properties and local references without orphans', async () => {
    const scan = await scanRepo(tempDir);
    const codeFiles = scan.entries.filter((entry) => entry.kind === 'code');
    const facts = await parseAndExtract(codeFiles);
    const ir = await buildIR(scan, facts);

    const repoNode = ir.nodes.find((node) => node.label === 'Repo');
    expect(repoNode).toBeDefined();

    const codeFileNodes = ir.nodes.filter((node) => node.label === 'CodeFile');
    expect(codeFileNodes.length).toBeGreaterThanOrEqual(2);
    for (const node of codeFileNodes) {
      expect(typeof node.props.id).toBe('string');
      expect(typeof node.props.repoId).toBe('string');
      expect(typeof node.props.path).toBe('string');
      expect(typeof node.props.language).toBe('string');
      expect(typeof node.props.astNodeCount).toBe('number');
      expect(node.props.path.length).toBeGreaterThan(0);
    }

    const astNodes = ir.nodes.filter((node) => node.label === 'AstNode');
    expect(astNodes.length).toBeGreaterThan(0);
    for (const node of astNodes) {
      expect(typeof node.props.id).toBe('string');
      expect(typeof node.props.filePath).toBe('string');
      expect(typeof node.props.unitKind).toBe('string');
      expect(typeof node.props.startLine).toBe('number');
      expect(typeof node.props.endLine).toBe('number');
      const startLine = Number(node.props.startLine ?? 0);
      const endLine = Number(node.props.endLine ?? 0);
      expect(endLine).toBeGreaterThanOrEqual(startLine);
    }

    const nodeIdSet = new Set(ir.nodes.map((node) => String(node.props.id)));
    const containsEdges = ir.edges.filter((edge) => edge.type === 'CONTAINS');
    expect(containsEdges.length).toBeGreaterThan(0);

    for (const edge of containsEdges) {
      expect(nodeIdSet.has(edge.from)).toBe(true);
      expect(nodeIdSet.has(edge.to)).toBe(true);
    }

    const importsReferences = ir.edges.filter(
      (edge) => edge.type === 'REFERENCES' && edge.props.referenceKind === 'local-import',
    );
    expect(importsReferences.length).toBeGreaterThan(0);
    for (const edge of importsReferences) {
      expect(nodeIdSet.has(edge.from)).toBe(true);
      expect(nodeIdSet.has(edge.to)).toBe(true);
    }
  });
});
