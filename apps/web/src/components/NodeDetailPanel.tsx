import {
  FolderIcon,
  DocumentIcon,
  CloseIcon,
  CodeBracketIcon,
  ArrowDownOnSquareIcon,
} from "./icons";
import type { CodeNode } from "@CodeAtlas/api/types/codeNode.d";

interface NodeDetailPanelProps {
  node: CodeNode | null;
  onClose: () => void;
}

const DetailSection: React.FC<{
  title: string;
  items?: string[];
  icon: React.ReactNode;
}> = ({ title, items, icon }) => {
  if (!items || items.length === 0) return null;

  const cleanItem = (item: string) =>
    item
      .replace(/[\r\n\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="max-h-40 overflow-y-auto pr-2">
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li
              key={index}
              className="bg-gray-700/50 p-2 rounded-md text-sm font-mono break-words text-gray-300 shadow-sm"
            >
              {cleanItem(item)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// --------- helper functions for folder analysis ---------

type FolderStats = {
  directFiles: number;
  directDirectories: number;
  totalFiles: number;
  totalDirectories: number;
  languageCounts: Record<string, number>; // e.g. { go: 12, ts: 3 }
};

const getFileExtension = (fileName: string): string => {
  const parts = fileName.split(".");
  if (parts.length <= 1) return "unknown";
  return parts[parts.length - 1].toLowerCase();
};

const computeFolderStats = (node: CodeNode): FolderStats => {
  const children = node.children ?? [];

  let directFiles = 0;
  let directDirectories = 0;

  // direct counts
  for (const child of children) {
    if (child.isDirectory) {
      directDirectories++;
    } else {
      directFiles++;
    }
  }

  let totalFiles = 0;
  let totalDirectories = 0;
  const languageCounts: Record<string, number> = {};

  const traverse = (n: CodeNode) => {
    if (n.isDirectory) {
      totalDirectories++;
      (n.children ?? []).forEach(traverse);
    } else {
      totalFiles++;
      const ext = getFileExtension(n.file);
      languageCounts[ext] = (languageCounts[ext] ?? 0) + 1;
    }
  };

  traverse(node);

  // totalDirectories includes this folder; you can choose to exclude it if you want
  return {
    directFiles,
    directDirectories,
    totalFiles,
    totalDirectories: totalDirectories - 1, // exclude the current folder
    languageCounts,
  };
};

// --------------------------------------------------------

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  onClose,
}) => {
  const isOpen = node !== null;

  const isJsonFile =
    !!node && !node.isDirectory && node.file.toLowerCase().endsWith(".json");

  // Only compute stats if this is a folder and we actually have children
  const folderStats =
    node && node.isDirectory ? computeFolderStats(node) : null;

  const languageItems =
    folderStats &&
    Object.entries(folderStats.languageCounts).map(
      ([ext, count]) => `${ext} (${count} file${count === 1 ? "" : "s"})`,
    );

  const folderSummaryItems = folderStats
    ? [
        `Direct children → ${folderStats.directDirectories} folder(s), ${folderStats.directFiles} file(s)`,
        `Total (recursive) → ${folderStats.totalDirectories} folder(s), ${folderStats.totalFiles} file(s)`,
      ]
    : [];

  return (
    <div
      className={`fixed top-0 right-0 h-full bg-gray-800/95 backdrop-blur-sm shadow-2xl transition-transform duration-300 ease-in-out z-20 w-full md:w-1/3 lg:w-1/4 ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-gray-100">Node Details</h2>
            {node && (
              <span className="text-xs text-gray-400">
                {node.isDirectory ? "Directory" : "File"}
                {isJsonFile && " · JSON / Config"}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {node ? (
          <div className="flex-grow overflow-y-auto">
            {/* Header: icon + name + path */}
            <div className="flex items-center gap-3 mb-2">
              {node.isDirectory ? (
                <FolderIcon className="w-8 h-8 text-blue-500" />
              ) : (
                <DocumentIcon className="w-8 h-8 text-emerald-500" />
              )}
              <h3 className="text-xl font-semibold text-gray-100 break-all">
                {node.file}
              </h3>
            </div>

            <p className="text-xs font-mono text-gray-400 break-all">
              {node.path}
            </p>

            <hr className="my-4 border-gray-600" />

            {/* Folder-specific analytics (computed from JSON tree) */}
            {node.isDirectory && (
              <>
                <DetailSection
                  title="Folder Summary"
                  items={folderSummaryItems}
                  icon={<FolderIcon className="w-5 h-5" />}
                />
                <DetailSection
                  title="Languages in This Folder (Recursive)"
                  // items={languageItems}
                  icon={<CodeBracketIcon className="w-5 h-5" />}
                />
              </>
            )}

            {/* Code-related details for files (or folders if you want) */}
            <DetailSection
              title="Imports"
              items={node.imports ?? []}
              icon={<ArrowDownOnSquareIcon className="w-5 h-5" />}
            />
            <DetailSection
              title="Functions"
              items={node.functions ?? []}
              icon={<CodeBracketIcon className="w-5 h-5" />}
            />
            <DetailSection
              title="Classes"
              items={node.classes ?? []}
              icon={<CodeBracketIcon className="w-5 h-5" />}
            />
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
