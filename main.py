from pathlib import Path

from tree_sitter_languages import get_parser
from tree_sitter import Tree


def parse() -> Tree:
    file = Path("./example_files/index.js")
    lang = "javascript"
    lang_parser = get_parser(lang)
    with file.open("rb") as f:
        return lang_parser.parse(f.read())


def main():
    print("helo")
   

if __name__ == "__main__":
    main()
