import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import Parser from 'tree-sitter';
import JavaScript from 'tree-sitter-javascript';
const parser = new Parser();
parser.setLanguage(JavaScript as unknown as import("tree-sitter").Language);
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const driver = neo4j.driver(
//   'neo4j://localhost',
//   neo4j.auth.basic('neo4j', 'password')
// )

const filePath = path.join(__dirname, '../example_files/index.js');
const sourceCode = fs.readFileSync(filePath);
const tree = parser.parse(sourceCode.toString());


console.log(tree.rootNode.toString());

// (program
//   (lexical_declaration
//     (variable_declarator (identifier) (number)))
//   (expression_statement
//     (call_expression
//       (member_expression (identifier) (property_identifier))
//       (arguments (identifier)))))

const callExpression = tree.rootNode?.child(1)?.firstChild;
console.log(callExpression);

// {
//   type: 'call_expression',
//   startPosition: {row: 0, column: 16},
//   endPosition: {row: 0, column: 30},
//   startIndex: 0,
//   endIndex: 30
// }




// const app = new Hono()

// app.get('/', (c) => {
//   return c.text('Hello Hono!')
// })

// serve({
//   fetch: app.fetch,
//   port: 3000
// }, (info) => {
//   console.log(`Server is running on http://localhost:${info.port}`)
// })
