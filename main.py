from pathlib import Path
from tree_sitter import Parser
from tree_sitter_languages import get_language

# Get JavaScript parser directly
parser = Parser()
parser.set_language(get_language('javascript'))

def parse():
    file = Path("./example_files/index.js")
    if not file.exists():
        print(f"File not found: {file}")
        return None

    src = file.read_bytes()
    tree = parser.parse(src)
    # Print clean syntax tree
    print("JavaScript Syntax Tree:")
    print("----------------------")
    print(tree.root_node.sexp())
    return tree

def main():
    parsed_file = parse()
    print(f"Parsed file: {parsed_file}")

if __name__ == "__main__":
    main()
  
 
