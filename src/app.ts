import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import fs from 'fs'
import path from 'path'
import Parser from 'tree-sitter'
import JavaScript from 'tree-sitter-javascript'

const app = new Hono()
const parser = new Parser()
parser.setLanguage(JavaScript as unknown as import('tree-sitter').Language)

// Recursively find files
function getAllSourceFiles(dir: string, files: string[] = []): string[] {
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) getAllSourceFiles(fullPath, files)
    else if (/\.(js|ts)$/.test(fullPath)) files.push(fullPath)
  }
  return files
}

// Extract basic info from AST
function analyzeFileStructure(filePath: string) {
  const code = fs.readFileSync(filePath, 'utf8')
  const tree = parser.parse(code)
  const root = tree.rootNode

  const functions: string[] = []
  const imports: string[] = []

  const walk = (node: any) => {
    if (node.type === 'function_declaration') {
      const name = node.childForFieldName('name')
      if (name) functions.push(name.text)
    }
    if (node.type === 'import_statement') {
      const source = node.childForFieldName('source')
      if (source) imports.push(source.text.replace(/['"]/g, ''))
    }
    for (let i = 0; i < node.childCount; i++) walk(node.child(i))
  }

  walk(root)

  return {
    name: path.basename(filePath),
    path: filePath,
    imports,
    functions,
  }
}

// Endpoint to analyze project
app.get('/analyze', async (c) => {
  const baseDir = path.join(process.cwd(), 'src')
  const files = getAllSourceFiles(baseDir)

  const boxes = files.map((filePath) => analyzeFileStructure(filePath))

  return c.json({ project: path.basename(baseDir), boxes })
})

// Start server
serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}/analyze`)
})
