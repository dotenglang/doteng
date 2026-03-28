# ENG Language Support

Syntax highlighting for `.eng` files — English as a Programming Language.

## Features

- Full syntax highlighting for all `.eng` keywords, variables, strings, and comments
- YAML frontmatter highlighting with field-specific colors
- Variable references `{curlyBraces}` and `{nested.dot.access}`
- Natural language operators (`is greater than`, `is empty`, `contains`, etc.)
- Comment toggling with `--`
- Auto-closing pairs for `{}`, `[]`, `()`, `""`
- Indentation-based folding
- Auto-indent after lines ending with `:`

## Installation

From the extension directory:

```bash
code --install-extension eng-vscode/
```

Or symlink for development:

```bash
# Windows
mklink /J "%USERPROFILE%\.vscode\extensions\eng-language" eng-vscode

# macOS/Linux
ln -s "$(pwd)/eng-vscode" ~/.vscode/extensions/eng-language
```

Then reload VS Code.
