import { LexerError } from '../utils/errors.js';

// All reserved keywords from the spec
const KEYWORDS = new Set([
  // Structure
  'Import', 'Place', 'Slot', 'Fill', 'Create', 'Show', 'Group', 'Hide',
  // Control flow
  'Loop', 'If', 'Else', 'Switch', 'Case', 'Default',
  // Data
  'Set', 'Bind', 'Fetch', 'Compute', 'Store', 'Update', 'Watch', 'Use',
  // Interaction
  'On', 'Navigate', 'Submit', 'Emit', 'Toggle', 'Open', 'Close', 'Prevent',
  // Display
  'List', 'Table', 'Image', 'Link', 'Icon', 'Markdown',
  // Form
  'Input', 'Textarea', 'Select', 'Checkbox', 'Radio', 'Upload', 'DatePicker', 'TimePicker',
  // Styling
  'Style', 'Theme', 'Responsive', 'Animate',
  // Utility
  'Debug', 'Comment', 'TODO', 'Include',
  // Extra from spec
  'Handle', 'Call', 'Refresh', 'Clear', 'Reset', 'Retry',
  'When', 'While', 'Or', 'And', 'Not',
  'Listen', 'Scroll', 'Confirm', 'Delete', 'Validate',
]);

// Two-word keywords where second word is part of keyword
const COMPOUND_KEYWORDS = ['Else If'];

export const TokenType = {
  FRONTMATTER_DELIM: 'FRONTMATTER_DELIM',  // ---
  FRONTMATTER_BODY: 'FRONTMATTER_BODY',
  KEYWORD: 'KEYWORD',
  VARIABLE: 'VARIABLE',          // {varName}
  STRING: 'STRING',              // "text"
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  NULL: 'NULL',
  COLON: 'COLON',                // : at end of line (block opener)
  COMMA: 'COMMA',
  EQUALS: 'EQUALS',              // = in prop assignment
  DOT: 'DOT',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  LBRACKET: 'LBRACKET',
  RBRACKET: 'RBRACKET',
  COMMENT: 'COMMENT',            // -- comment
  TEXT: 'TEXT',                   // natural language text
  INDENT: 'INDENT',
  NEWLINE: 'NEWLINE',
  EOF: 'EOF',
};

export class Token {
  constructor(type, value, line, column, indent = 0) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
    this.indent = indent;
  }
}

export class Lexer {
  constructor(source, filePath = '<unknown>') {
    this.source = source;
    this.filePath = filePath;
    this.tokens = [];
    this.line = 1;
    this.column = 1;
  }

  error(message) {
    throw new LexerError(message, this.line, this.column, this.filePath);
  }

  tokenize() {
    const lines = this.source.split('\n');
    let inFrontmatter = false;
    let frontmatterStarted = false;
    let frontmatterLines = [];
    let frontmatterStartLine = 0;

    for (let i = 0; i < lines.length; i++) {
      this.line = i + 1;
      const rawLine = lines[i].replace(/\r$/, '');
      const trimmed = rawLine.trimEnd();

      // Skip fully blank lines (but track them for structure)
      if (trimmed.length === 0) {
        this.tokens.push(new Token(TokenType.NEWLINE, '', this.line, 1));
        continue;
      }

      // Frontmatter delimiter: ---
      if (trimmed === '---') {
        if (!frontmatterStarted) {
          // Opening frontmatter
          frontmatterStarted = true;
          inFrontmatter = true;
          frontmatterStartLine = this.line;
          this.tokens.push(new Token(TokenType.FRONTMATTER_DELIM, '---', this.line, 1));
          continue;
        } else if (inFrontmatter) {
          // Closing frontmatter
          inFrontmatter = false;
          this.tokens.push(new Token(TokenType.FRONTMATTER_BODY, frontmatterLines.join('\n'), frontmatterStartLine + 1, 1));
          this.tokens.push(new Token(TokenType.FRONTMATTER_DELIM, '---', this.line, 1));
          frontmatterLines = [];
          continue;
        }
      }

      // Doc comment block: --- doc ... ---
      if (trimmed === '--- doc') {
        // Collect until next ---
        const docLines = [];
        i++;
        while (i < lines.length) {
          this.line = i + 1;
          const dl = lines[i].replace(/\r$/, '').trimEnd();
          if (dl === '---') {
            break;
          }
          docLines.push(dl);
          i++;
        }
        this.tokens.push(new Token(TokenType.COMMENT, docLines.join('\n'), this.line, 1));
        continue;
      }

      // Inside frontmatter: collect raw YAML
      if (inFrontmatter) {
        frontmatterLines.push(rawLine);
        continue;
      }

      // Calculate indentation level
      const indent = rawLine.length - rawLine.trimStart().length;
      const indentLevel = Math.floor(indent / 2);

      // Emit indent token
      this.tokens.push(new Token(TokenType.INDENT, indentLevel, this.line, 1, indentLevel));

      // Tokenize the content of the line
      this.tokenizeLine(trimmed, indentLevel);

      // End-of-line
      this.tokens.push(new Token(TokenType.NEWLINE, '\n', this.line, trimmed.length + 1));
    }

    if (inFrontmatter) {
      this.error('Unterminated frontmatter block');
    }

    this.tokens.push(new Token(TokenType.EOF, null, this.line, 1));
    return this.tokens;
  }

  tokenizeLine(line, indentLevel) {
    let pos = 0;
    const content = line.trim();

    // Check for full-line comment
    if (content.startsWith('--')) {
      this.tokens.push(new Token(TokenType.COMMENT, content.slice(2).trim(), this.line, pos + 1));
      return;
    }

    // Check for compound keyword "Else If" at start
    if (content.startsWith('Else If')) {
      this.tokens.push(new Token(TokenType.KEYWORD, 'Else If', this.line, pos + 1));
      pos = 7;
      this.tokenizeRemainder(content.slice(pos), pos, indentLevel);
      return;
    }

    // Check if line starts with a keyword
    const firstWord = content.match(/^([A-Z][a-zA-Z]*)/);
    if (firstWord && KEYWORDS.has(firstWord[1])) {
      this.tokens.push(new Token(TokenType.KEYWORD, firstWord[1], this.line, pos + 1));
      pos = firstWord[1].length;
      this.tokenizeRemainder(content.slice(pos), pos, indentLevel);
      return;
    }

    // Not a keyword line — tokenize as general content
    this.tokenizeRemainder(content, pos, indentLevel);
  }

  tokenizeRemainder(text, startPos, indentLevel) {
    let pos = 0;

    while (pos < text.length) {
      const ch = text[pos];

      // Skip whitespace
      if (ch === ' ' || ch === '\t') {
        pos++;
        continue;
      }

      // Inline comment: --
      if (ch === '-' && pos + 1 < text.length && text[pos + 1] === '-') {
        this.tokens.push(new Token(TokenType.COMMENT, text.slice(pos + 2).trim(), this.line, startPos + pos + 1));
        return; // Rest of line is comment
      }

      // Variable: {something} — handle nested braces like { email: {email} }
      if (ch === '{') {
        const end = text.indexOf('}', pos);
        if (end === -1) {
          this.error(`Unterminated variable reference at column ${startPos + pos + 1}`);
        }
        const varName = text.slice(pos + 1, end).trim();
        this.tokens.push(new Token(TokenType.VARIABLE, varName, this.line, startPos + pos + 1));
        pos = end + 1;
        continue;
      }

      // Stray closing brace — skip it (from constructs like { key: {var} })
      if (ch === '}') {
        pos++;
        continue;
      }

      // String literal: "something"
      if (ch === '"') {
        let end = pos + 1;
        while (end < text.length && text[end] !== '"') {
          if (text[end] === '\\') end++; // skip escaped chars
          end++;
        }
        if (end >= text.length) {
          this.error(`Unterminated string literal at column ${startPos + pos + 1}`);
        }
        const str = text.slice(pos + 1, end);
        this.tokens.push(new Token(TokenType.STRING, str, this.line, startPos + pos + 1));
        pos = end + 1;
        continue;
      }

      // Colon at end of line (block opener)
      if (ch === ':' && pos === text.length - 1) {
        this.tokens.push(new Token(TokenType.COLON, ':', this.line, startPos + pos + 1));
        pos++;
        continue;
      }

      // Colon followed by space (inline)
      if (ch === ':') {
        this.tokens.push(new Token(TokenType.COLON, ':', this.line, startPos + pos + 1));
        pos++;
        continue;
      }

      // Equals sign
      if (ch === '=') {
        this.tokens.push(new Token(TokenType.EQUALS, '=', this.line, startPos + pos + 1));
        pos++;
        continue;
      }

      // Comma
      if (ch === ',') {
        this.tokens.push(new Token(TokenType.COMMA, ',', this.line, startPos + pos + 1));
        pos++;
        continue;
      }

      // Brackets
      if (ch === '[') {
        this.tokens.push(new Token(TokenType.LBRACKET, '[', this.line, startPos + pos + 1));
        pos++;
        continue;
      }
      if (ch === ']') {
        this.tokens.push(new Token(TokenType.RBRACKET, ']', this.line, startPos + pos + 1));
        pos++;
        continue;
      }

      // Parentheses
      if (ch === '(') {
        this.tokens.push(new Token(TokenType.LPAREN, '(', this.line, startPos + pos + 1));
        pos++;
        continue;
      }
      if (ch === ')') {
        this.tokens.push(new Token(TokenType.RPAREN, ')', this.line, startPos + pos + 1));
        pos++;
        continue;
      }

      // Number
      if (/\d/.test(ch)) {
        let numStr = '';
        while (pos < text.length && /[\d.]/.test(text[pos])) {
          numStr += text[pos];
          pos++;
        }
        this.tokens.push(new Token(TokenType.NUMBER, parseFloat(numStr), this.line, startPos + pos + 1));
        continue;
      }

      // Boolean / null literals
      if (text.slice(pos).startsWith('true') && (pos + 4 >= text.length || /[\s,\]\)]/.test(text[pos + 4]))) {
        this.tokens.push(new Token(TokenType.BOOLEAN, true, this.line, startPos + pos + 1));
        pos += 4;
        continue;
      }
      if (text.slice(pos).startsWith('false') && (pos + 5 >= text.length || /[\s,\]\)]/.test(text[pos + 5]))) {
        this.tokens.push(new Token(TokenType.BOOLEAN, false, this.line, startPos + pos + 1));
        pos += 5;
        continue;
      }
      if (text.slice(pos).startsWith('null') && (pos + 4 >= text.length || /[\s,\]\)]/.test(text[pos + 4]))) {
        this.tokens.push(new Token(TokenType.NULL, null, this.line, startPos + pos + 1));
        pos += 4;
        continue;
      }

      // Text word — consume until we hit a special char
      let word = '';
      while (pos < text.length && !/[{}"=,\[\]():]/.test(text[pos]) && text[pos] !== ' ' && text[pos] !== '\t') {
        // Check for inline comment
        if (text[pos] === '-' && pos + 1 < text.length && text[pos + 1] === '-') {
          break;
        }
        word += text[pos];
        pos++;
      }
      if (word.length > 0) {
        this.tokens.push(new Token(TokenType.TEXT, word, this.line, startPos + pos - word.length + 1));
      }
    }
  }
}
