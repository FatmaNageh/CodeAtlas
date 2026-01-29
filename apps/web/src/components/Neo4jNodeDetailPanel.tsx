import type { Neo4jNode, Neo4jEdge } from "./Neo4jGraph";
import { CloseIcon } from "./icons";

export function Neo4jNodeDetailPanel({
  node,
  edges,
  onClose,
}: {
  node: Neo4jNode | null;
  edges: Neo4jEdge[];
  onClose: () => void;
}) {
  const isOpen = node !== null;
  const id = node?.id ?? "";

  const connected = node
    ? edges.filter((e) => String(e.from) === String(id) || String(e.to) === String(id))
    : [];

  const types = Array.from(new Set(connected.map((e) => e.type))).sort();

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-gray-800/95 backdrop-blur-sm shadow-2xl transition-transform duration-300 ease-in-out z-20 w-full md:w-1/3 lg:w-1/4 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-100">Node Details</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {node ? (
          <div className="flex-grow overflow-y-auto">
            <div className="space-y-2">
              <div className="text-sm text-gray-300 break-all">
                <span className="text-gray-400">id:</span> {node.id}
              </div>

              <div className="flex flex-wrap gap-2">
                {(node.labels ?? []).map((l) => (
                  <span
                    key={l}
                    className="text-xs px-2 py-1 rounded-full bg-gray-700/70 text-gray-200 font-mono"
                  >
                    {l}
                  </span>
                ))}
              </div>

              <hr className="my-4 border-gray-600" />

              {types.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-cyan-400 mb-2">Connected relationship types</h3>
                  <div className="flex flex-wrap gap-2">
                    {types.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-1 rounded-full bg-gray-700/50 text-gray-300 font-mono"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">Properties</h3>
                <pre className="text-xs bg-gray-900/60 p-3 rounded border border-gray-700 overflow-x-auto text-gray-200">
                  {JSON.stringify(node.properties ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a node to see its details</p>
          </div>
        )}
      </div>
    </div>
  );
}
