import fs from 'fs'
import path from 'path'
import Parser from 'tree-sitter'
import JavaScript from 'tree-sitter-javascript'

import type { FileNode } from '@/types/graph.js'

const parser = new Parser()
const folder = path.join(process.cwd(), './example_files')
parser.setLanguage(JavaScript as unknown as import('tree-sitter').Language)

// Create a file tree from the project files
export function createGraph(baseDir : string = path.join(folder, 'simple_js_project')) : FileNode[] {
    const name = path.basename(baseDir);
    const files =fs.readdirSync(`${baseDir}`);
    let fileTree: FileNode[] = [];
    files.forEach((file, i) => {
        if (fs.statSync(path.join(baseDir, file)).isDirectory()) {
            fileTree.push({
                basename: file,
                relative_path: path.join(name, file),
                type: 'directory',
                children: [createGraph(path.join(baseDir, file))].flat()
            });
        } else {
            fileTree.push({
                basename: file,
                relative_path: path.join(name, file),
                type: 'file',
                children: null
            });
        }
        console.log(`loop number ${i}` ,fileTree)
    });



 
    return fileTree;
}



