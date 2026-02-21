
import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import type { CodeNode } from './components/KnowledgeGraph';
import { Neo4jGraph } from './components/Neo4jGraph';
import type { Neo4jNode, Neo4jEdge } from './components/Neo4jGraph';
import { fetchNeo4jSubgraph } from './lib/api';


const mockGraph = {
  path: 'repo',
  file: 'repo',
  isDirectory: true,
  children: [
    {
      path: 'repo/src',
      file: 'src',
      isDirectory: true,
      children: [
        {
          path: 'repo/src/index.ts',
          file: 'index.ts',
          isDirectory: false,
        },
        {
          path: 'repo/src/utils.ts',
          file: 'utils.ts',
          isDirectory: false,
        },
      ],
    },
    {
      path: 'repo/README.md',
      file: 'README.md',
      isDirectory: false,
    },
  ],
};


function getDefaultTab() {
  // Define a type for window with optional acquireVsCodeApi
  type VSCodeWindow = Window & { acquireVsCodeApi?: () => unknown };
  if (typeof window !== 'undefined' && (window as VSCodeWindow).acquireVsCodeApi) {
    return 'graph';
  }
  return 'neo4j';
}

function App() {
  const [tab, setTab] = useState<'home' | 'graph' | 'neo4j'>(getDefaultTab());
  const [selectedNode, setSelectedNode] = useState<CodeNode | null>(null);
  // Neo4j state
  const [repoId, setRepoId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [neoData, setNeoData] = useState<{ nodes: Neo4jNode[]; edges: Neo4jEdge[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadNeo4j = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNeo4jSubgraph(repoId, baseUrl, 500);
      setNeoData({ nodes: data.nodes ?? [], edges: data.edges ?? [] });
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('Failed to load Neo4j data');
    } finally {
      setLoading(false);
    }
  };

  // Reset selectedNode when switching away from 'graph' tab
  const handleTabChange = (newTab: typeof tab) => {
    setTab(newTab);
    if (newTab !== 'graph') setSelectedNode(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg, #18181b 70%, #232334 100%)', padding: 0 }}>
      {/* Modern Tab Bar */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 32, padding: '24px 0 0 0', justifyContent: 'center' }}>
        <button
          onClick={() => handleTabChange('home')}
          style={{
            fontWeight: tab === 'home' ? 700 : 500,
            fontSize: 18,
            background: tab === 'home' ? 'linear-gradient(90deg, #334155 60%, #64748b 100%)' : 'rgba(30,41,59,0.7)',
            color: '#f3f4f6',
            border: 'none',
            borderRadius: 10,
            padding: '10px 32px',
            boxShadow: tab === 'home' ? '0 2px 12px #000a' : 'none',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >Home</button>
        <button
          onClick={() => handleTabChange('graph')}
          style={{
            fontWeight: tab === 'graph' ? 700 : 500,
            fontSize: 18,
            background: tab === 'graph' ? 'linear-gradient(90deg, #334155 60%, #64748b 100%)' : 'rgba(30,41,59,0.7)',
            color: '#f3f4f6',
            border: 'none',
            borderRadius: 10,
            padding: '10px 32px',
            boxShadow: tab === 'graph' ? '0 2px 12px #000a' : 'none',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >Graph</button>
        <button
          onClick={() => handleTabChange('neo4j')}
          style={{
            fontWeight: tab === 'neo4j' ? 700 : 500,
            fontSize: 18,
            background: tab === 'neo4j' ? 'linear-gradient(90deg, #334155 60%, #64748b 100%)' : 'rgba(30,41,59,0.7)',
            color: '#f3f4f6',
            border: 'none',
            borderRadius: 10,
            padding: '10px 32px',
            boxShadow: tab === 'neo4j' ? '0 2px 12px #000a' : 'none',
            cursor: 'pointer',
            outline: 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
        >Neo4j</button>
      </div>
      {tab === 'home' && (
        <>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
              <img src={viteLogo} className="logo" alt="Vite logo" />
            </a>
            <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
              <img src={reactLogo} className="logo react" alt="React logo" />
            </a>
          </div>
          <h1 style={{ textAlign: 'center', color: '#f3f4f6', fontSize: 38, fontWeight: 800, marginTop: 18 }}>CODE-ATLAS</h1>
          <div className="card" style={{ maxWidth: 480, margin: '32px auto', background: 'rgba(30,41,59,0.98)', borderRadius: 16, boxShadow: '0 2px 16px #000a', padding: 32, color: '#f3f4f6' }}>
            <p>
              Edit <code>src/App.tsx</code> and save to test HMR
            </p>
          </div>
          <p className="read-the-docs" style={{ textAlign: 'center', color: '#a3a3a3' }}>
            learn
          </p>
        </>
      )}
      {tab === 'graph' && (
        <div style={{ width: '100%', height: 600, background: 'rgba(30,41,59,0.98)', borderRadius: 16, padding: 24, boxShadow: '0 2px 16px #000a', margin: '0 auto', maxWidth: 1200 }}>
          <KnowledgeGraph
            data={mockGraph}
            onNodeClick={(node: CodeNode) => setSelectedNode(node)}
            selectedNodePath={selectedNode ? selectedNode.path : null}
          />
        </div>
      )}
      {tab === 'neo4j' && (
        <div style={{ width: '100vw', height: '100vh', minHeight: '100vh', minWidth: '100vw', background: 'rgba(30,41,59,0.98)', borderRadius: 0, padding: 0, boxShadow: 'none', margin: 0, position: 'fixed', left: 0, top: 0, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 800, fontSize: 34, color: '#f3f4f6', margin: '38px 0 32px 0', textAlign: 'center', letterSpacing: 0.5 }}>Load Neo4j graph</div>
          <div style={{ margin: '0 auto', marginBottom: 32, display: 'flex', gap: 28, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', maxWidth: 900 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
              <label style={{ fontSize: 17, color: '#a3a3a3', marginBottom: 4 }}>Repo ID</label>
              <input
                type="text"
                placeholder="Repo ID"
                value={repoId}
                onChange={e => setRepoId(e.target.value)}
                style={{ padding: '14px 18px', borderRadius: 10, border: '1.5px solid #334155', background: '#232334', color: '#f3f4f6', fontSize: 18, minWidth: 220 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
              <label style={{ fontSize: 17, color: '#a3a3a3', marginBottom: 4 }}>Base URL (optional)</label>
              <input
                type="text"
                placeholder="Base URL (optional)"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                style={{ padding: '14px 18px', borderRadius: 10, border: '1.5px solid #334155', background: '#232334', color: '#f3f4f6', fontSize: 18, minWidth: 260 }}
              />
            </div>
            <button
              onClick={handleLoadNeo4j}
              disabled={loading || !repoId}
              style={{
                padding: '18px 38px',
                borderRadius: 12,
                background: loading || !repoId ? '#334155' : 'linear-gradient(90deg, #2563eb 60%, #38bdf8 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                fontSize: 20,
                marginTop: 32,
                minHeight: 56,
                boxShadow: '0 2px 18px #0007',
                cursor: loading || !repoId ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}
            >
              {loading ? 'Loading...' : 'Load Neo4j Graph'}
            </button>
          </div>
          {error && <div style={{ color: '#f87171', marginBottom: 18, fontWeight: 700, textAlign: 'center', fontSize: 18 }}>{error}</div>}
          <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: '100vw', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {neoData && (
              <div style={{ width: '100vw', height: '100%', borderRadius: 0, overflow: 'hidden', background: 'rgba(24,24,32,0.99)', boxShadow: '0 2px 12px #000a', position: 'absolute', left: 0, top: 0 }}>
                <Neo4jGraph
                  nodes={neoData.nodes}
                  edges={neoData.edges}
                  onNodeClick={() => {}}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App
