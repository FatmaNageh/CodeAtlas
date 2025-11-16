
import { FolderIcon, DocumentIcon, CloseIcon, CodeBracketIcon, ArrowDownOnSquareIcon } from './icons';
import type { CodeNode } from '@CodeAtlas/api/types/codeNode.d';

interface NodeDetailPanelProps {
  node: CodeNode | null;
  onClose: () => void;
}

const DetailSection: React.FC<{ title: string; items: string[]; icon: React.ReactNode }> = ({ title, items, icon }) => {
  if (!items || items.length === 0) return null;

  const cleanItem = (item: string) => item.replace(/[\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="max-h-40 overflow-y-auto pr-2">
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="bg-gray-700/50 p-2 rounded-md text-sm font-mono break-words text-gray-300 shadow-sm">
              {cleanItem(item)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ node, onClose }) => {
  const isOpen = node !== null;

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-gray-800/95 backdrop-blur-sm shadow-2xl transition-transform duration-300 ease-in-out z-20 w-full md:w-1/3 lg:w-1/4 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-100">Node Details</h2>
          <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {node ? (
          <div className="flex-grow overflow-y-auto">
            <div className="flex items-center gap-3 mb-2">
              {node.isDirectory ? (
                <FolderIcon className="w-8 h-8 text-blue-500" />
              ) : (
                <DocumentIcon className="w-8 h-8 text-emerald-500" />
              )}
              <h3 className="text-xl font-semibold text-gray-100 break-all">{node.file}</h3>
            </div>
            <p className="text-xs font-mono text-gray-400 break-all">{node.path}</p>
            
            <hr className="my-4 border-gray-600"/>

            <DetailSection title="Imports" items={node.imports} icon={<ArrowDownOnSquareIcon className="w-5 h-5"/>} />
            <DetailSection title="Functions" items={node.functions} icon={<CodeBracketIcon className="w-5 h-5"/>} />
            <DetailSection title="Classes" items={node.classes} icon={<CodeBracketIcon className="w-5 h-5"/>} />

          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a node to see its details</p>
          </div>
        )}
      </div>
    </div>
  );
};
