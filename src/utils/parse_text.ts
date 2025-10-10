import fs from "fs";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import path from "path";
export function load_text_file(file_path: string): string {
    const absolutePath = path.resolve(file_path);
    const fileContent = fs.readFileSync(absolutePath, "utf-8");
    return fileContent;
}
//ai generated dont trust itt
export async function create_chunks(fileContent: string) {
  // Dummy embedding function: convert each character to its char code
  const lines = fileContent.split("").map((char) => char.charCodeAt(0));
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.createDocuments([fileContent]);
   
}
