import { parse as parseYaml } from 'yaml';
import { Lexer, TokenType } from './lexer.js';
import { ParseError } from '../utils/errors.js';

// Keywords that can appear as inline actions after a colon (e.g., "On click: Navigate to ...")
const INLINE_KEYWORDS = new Set([
  'Navigate', 'Submit', 'Emit', 'Toggle', 'Open', 'Close', 'Prevent',
  'Set', 'Update', 'Clear', 'Reset', 'Call', 'Refresh', 'Show', 'Hide',
  'Fetch', 'Validate', 'Debug', 'Retry',
]);

export class Parser {
  constructor(source, filePath = '<unknown>') {
    this.filePath = filePath;
    const lexer = new Lexer(source, filePath);
    this.allTokens = lexer.tokenize();
    // Filter out NEWLINEs and blank-line tokens; keep meaningful ones
    this.tokens = this.allTokens.filter(t =>
      t.type !== TokenType.NEWLINE &&
      !(t.type === TokenType.INDENT && this.isBlankLine(t))
    );
    this.pos = 0;
  }

  isBlankLine(indentToken) {
    // An indent followed immediately by another indent or NEWLINE = blank line
    const idx = this.allTokens.indexOf(indentToken);
    if (idx < 0) return false;
    const next = this.allTokens[idx + 1];
    return next && (next.type === TokenType.NEWLINE || next.type === TokenType.EOF);
  }

  error(message, token) {
    const t = token || this.peek();
    throw new ParseError(message, t?.line, t?.column, this.filePath);
  }

  peek(offset = 0) {
    return this.tokens[this.pos + offset] || null;
  }

  advance() {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  expect(type, value) {
    const token = this.peek();
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      this.error(`Expected ${type}${value !== undefined ? ` "${value}"` : ''}, got ${token?.type} "${token?.value}"`);
    }
    return this.advance();
  }

  match(type, value) {
    const token = this.peek();
    if (token && token.type === type && (value === undefined || token.value === value)) {
      return this.advance();
    }
    return null;
  }

  skipComments() {
    while (this.peek()?.type === TokenType.COMMENT) {
      this.advance();
    }
  }

  skipIndents() {
    while (this.peek()?.type === TokenType.INDENT) {
      this.advance();
    }
  }

  parse() {
    const ast = {
      type: 'EngFile',
      file: this.filePath,
      frontmatter: null,
      imports: [],
      body: [],
    };

    this.skipComments();

    // Parse frontmatter
    ast.frontmatter = this.parseFrontmatter();

    // Skip comments/whitespace
    this.skipComments();
    this.skipIndents();

    // Parse imports
    ast.imports = this.parseImports();

    // Parse body
    ast.body = this.parseBody(0);

    return ast;
  }

  parseFrontmatter() {
    if (!this.match(TokenType.FRONTMATTER_DELIM)) {
      return null;
    }

    const bodyToken = this.expect(TokenType.FRONTMATTER_BODY);
    this.expect(TokenType.FRONTMATTER_DELIM);

    try {
      const parsed = parseYaml(bodyToken.value);
      return parsed || {};
    } catch (e) {
      this.error(`Invalid YAML in frontmatter: ${e.message}`, bodyToken);
    }
  }

  parseImports() {
    const imports = [];
    this.skipComments();
    this.skipIndents();

    while (this.peek()?.type === TokenType.KEYWORD && this.peek()?.value === 'Import') {
      this.advance(); // consume 'Import'
      this.skipComments();

      // Check for bulk import (Import followed by colon)
      if (this.peek()?.type === TokenType.COLON) {
        this.advance(); // consume ':'
        this.skipIndents();
        this.skipComments();

        // Parse indented import lines
        while (this.peek()?.type === TokenType.INDENT) {
          const indent = this.advance();
          if (indent.value < 1) break;
          this.skipComments();
          const imp = this.parseSingleImport();
          if (imp) imports.push(imp);
          this.skipComments();
        }
      } else {
        const imp = this.parseSingleImport();
        if (imp) imports.push(imp);
      }

      this.skipComments();
      this.skipIndents();
    }

    return imports;
  }

  parseSingleImport() {
    // Format: name from "path" [as alias]
    const nameToken = this.advance();
    if (!nameToken) return null;
    const name = nameToken.value;

    // Consume 'from'
    this.consumeText('from');

    // Path string
    const pathToken = this.expect(TokenType.STRING);
    const path = pathToken.value;

    // Optional alias
    let alias = null;
    if (this.peek()?.type === TokenType.TEXT && this.peek()?.value === 'as') {
      this.advance(); // consume 'as'
      const aliasToken = this.advance();
      alias = aliasToken.value;
    }

    return { name, path, alias };
  }

  consumeText(expected) {
    const token = this.peek();
    if (token && token.type === TokenType.TEXT && token.value === expected) {
      this.advance();
      return true;
    }
    // Silently skip if not there — natural language is flexible
    return false;
  }

  parseBody(minIndent) {
    const nodes = [];

    while (this.pos < this.tokens.length) {
      this.skipComments();

      const token = this.peek();
      if (!token || token.type === TokenType.EOF) break;

      // Check indent level
      if (token.type === TokenType.INDENT) {
        if (token.value < minIndent) break;
        this.advance(); // consume indent
        this.skipComments();
        continue;
      }

      // Safety: track position to prevent infinite loops
      const posBefore = this.pos;

      // Parse a statement based on the keyword
      if (token.type === TokenType.KEYWORD) {
        const node = this.parseStatement(minIndent);
        if (node) nodes.push(node);
      } else {
        // Non-keyword line — treat as text/description
        const node = this.parseTextStatement(minIndent);
        if (node) nodes.push(node);
      }

      // Safety: if parser didn't advance, force skip to prevent infinite loop
      if (this.pos === posBefore) {
        this.advance();
      }
    }

    return nodes;
  }

  parseStatement(currentIndent) {
    const token = this.peek();
    if (!token) return null;

    switch (token.value) {
      case 'Create': return this.parseCreate(currentIndent);
      case 'Show': return this.parseShow(currentIndent);
      case 'Place': return this.parsePlace(currentIndent);
      case 'Group': return this.parseGroup(currentIndent);
      case 'Loop': return this.parseLoop(currentIndent);
      case 'If': return this.parseIf(currentIndent);
      case 'Else If': return this.parseElseIf(currentIndent);
      case 'Else': return this.parseElse(currentIndent);
      case 'Switch': return this.parseSwitch(currentIndent);
      case 'Case': return this.parseCase(currentIndent);
      case 'Default': return this.parseDefault(currentIndent);
      case 'Set': return this.parseSet(currentIndent);
      case 'Bind': return this.parseBind(currentIndent);
      case 'Fetch': return this.parseFetch(currentIndent);
      case 'Compute': return this.parseCompute(currentIndent);
      case 'Store': return this.parseStore(currentIndent);
      case 'Update': return this.parseUpdate(currentIndent);
      case 'On': return this.parseOn(currentIndent);
      case 'Navigate': return this.parseNavigate(currentIndent);
      case 'Submit': return this.parseSubmit(currentIndent);
      case 'Emit': return this.parseEmit(currentIndent);
      case 'Toggle': return this.parseToggle(currentIndent);
      case 'Open': return this.parseOpen(currentIndent);
      case 'Close': return this.parseClose(currentIndent);
      case 'Prevent': return this.parsePrevent(currentIndent);
      case 'Fill': return this.parseFill(currentIndent);
      case 'Slot': return this.parseSlot(currentIndent);
      case 'Hide': return this.parseHide(currentIndent);
      case 'List': return this.parseList(currentIndent);
      case 'Table': return this.parseTable(currentIndent);
      case 'Image': return this.parseImage(currentIndent);
      case 'Link': return this.parseLink(currentIndent);
      case 'Icon': return this.parseIcon(currentIndent);
      case 'Input': return this.parseInput(currentIndent);
      case 'Textarea': return this.parseTextarea(currentIndent);
      case 'Select': return this.parseSelect(currentIndent);
      case 'Checkbox': return this.parseCheckbox(currentIndent);
      case 'Radio': return this.parseRadio(currentIndent);
      case 'Upload': return this.parseUpload(currentIndent);
      case 'DatePicker': return this.parseDatePicker(currentIndent);
      case 'Style': return this.parseStyle(currentIndent);
      case 'Animate': return this.parseAnimate(currentIndent);
      case 'Responsive': return this.parseResponsive(currentIndent);
      case 'When': return this.parseWhen(currentIndent);
      case 'While': return this.parseWhile(currentIndent);
      case 'Handle': return this.parseHandle(currentIndent);
      case 'Import': return this.parseImportStatement(currentIndent);
      case 'Debug': return this.parseDebug(currentIndent);
      case 'TODO': return this.parseTodo(currentIndent);
      case 'Validate': return this.parseValidate(currentIndent);
      case 'Markdown': return this.parseMarkdown(currentIndent);
      case 'Watch': return this.parseWatch(currentIndent);
      case 'Listen': return this.parseListen(currentIndent);
      case 'Clear': return this.parseClear(currentIndent);
      case 'Call': return this.parseCall(currentIndent);
      case 'Refresh': return this.parseRefresh(currentIndent);
      case 'Delete': return this.parseDelete(currentIndent);
      case 'Use': return this.parseUse(currentIndent);
      default:
        return this.parseGenericKeyword(currentIndent);
    }
  }

  // ─── Collect remainder of line as description text ───
  collectLineText() {
    const parts = [];
    while (this.peek() && this.peek().type !== TokenType.INDENT && this.peek().type !== TokenType.EOF) {
      const t = this.peek();
      if (t.type === TokenType.COMMENT) {
        this.advance();
        break;
      }
      if (t.type === TokenType.COLON && this.isEndOfLineColon()) {
        // Don't consume block-opening colon here
        break;
      }
      parts.push(this.advance());
    }
    return parts;
  }

  collectLineAsString() {
    const parts = this.collectLineText();
    return parts.map(t => {
      if (t.type === TokenType.VARIABLE) return `{${t.value}}`;
      if (t.type === TokenType.STRING) return `"${t.value}"`;
      if (t.type === TokenType.COLON) return ':';
      if (t.type === TokenType.EQUALS) return '=';
      if (t.type === TokenType.COMMA) return ',';
      if (t.type === TokenType.LBRACKET) return '[';
      if (t.type === TokenType.RBRACKET) return ']';
      if (t.type === TokenType.LPAREN) return '(';
      if (t.type === TokenType.RPAREN) return ')';
      return String(t.value);
    }).join(' ').trim();
  }

  isEndOfLineColon() {
    // Check if colon is at end of meaningful content (next is INDENT or EOF or COMMENT)
    const next = this.peek(1);
    return !next || next.type === TokenType.INDENT || next.type === TokenType.EOF || next.type === TokenType.COMMENT;
  }

  hasBlock() {
    const t = this.peek();
    return t && t.type === TokenType.COLON && this.isEndOfLineColon();
  }

  consumeBlock(currentIndent) {
    if (this.hasBlock()) {
      this.advance(); // consume ':'
      return this.parseBody(currentIndent + 1);
    }
    return [];
  }

  // ─── Parse condition expression from tokens ───
  parseCondition() {
    const parts = [];
    while (this.peek() && this.peek().type !== TokenType.INDENT && this.peek().type !== TokenType.EOF) {
      const t = this.peek();
      if (t.type === TokenType.COMMENT) break;
      if (t.type === TokenType.COLON && this.isEndOfLineColon()) break;
      parts.push(this.advance());
    }
    return this.buildCondition(parts);
  }

  buildCondition(tokens) {
    // Check for compound conditions with 'and' / 'or'
    const andIdx = tokens.findIndex(t => t.type === TokenType.TEXT && t.value === 'and');
    if (andIdx > 0) {
      return {
        type: 'compound',
        operator: 'and',
        left: this.buildCondition(tokens.slice(0, andIdx)),
        right: this.buildCondition(tokens.slice(andIdx + 1)),
      };
    }

    const orIdx = tokens.findIndex(t => t.type === TokenType.TEXT && t.value === 'or');
    if (orIdx > 0) {
      return {
        type: 'compound',
        operator: 'or',
        left: this.buildCondition(tokens.slice(0, orIdx)),
        right: this.buildCondition(tokens.slice(orIdx + 1)),
      };
    }

    // Simple condition: extract subject, operator, value
    return this.buildSimpleCondition(tokens);
  }

  buildSimpleCondition(tokens) {
    if (tokens.length === 0) return { type: 'expression', raw: '' };

    // Build a raw text representation for operator matching
    const raw = tokens.map(t => {
      if (t.type === TokenType.VARIABLE) return `{${t.value}}`;
      if (t.type === TokenType.STRING) return `"${t.value}"`;
      return String(t.value);
    }).join(' ');

    // Find the subject (first variable typically)
    const subjectToken = tokens.find(t => t.type === TokenType.VARIABLE);
    const subject = subjectToken ? subjectToken.value : null;

    // Pattern matching for natural language conditions
    const patterns = [
      { re: /is\s+not\s+empty/, op: '!empty' },
      { re: /has\s+items/, op: '!empty' },
      { re: /is\s+empty/, op: 'empty' },
      { re: /is\s+not\s+logged\s+in/, op: '!auth.check' },
      { re: /is\s+logged\s+in/, op: 'auth.check' },
      { re: /is\s+greater\s+than\s+(.+)/, op: '>', capture: true },
      { re: /is\s+more\s+than\s+(.+)/, op: '>', capture: true },
      { re: /is\s+less\s+than\s+(.+)/, op: '<', capture: true },
      { re: /is\s+fewer\s+than\s+(.+)/, op: '<', capture: true },
      { re: /is\s+at\s+least\s+(.+)/, op: '>=', capture: true },
      { re: /is\s+at\s+most\s+(.+)/, op: '<=', capture: true },
      { re: /is\s+between\s+(.+)\s+and\s+(.+)/, op: 'between', capture: true },
      { re: /is\s+one\s+of\s+(.+)/, op: 'in', capture: true },
      { re: /is\s+not\s+one\s+of\s+(.+)/, op: 'not in', capture: true },
      { re: /is\s+valid\s+email/, op: 'valid_email' },
      { re: /is\s+valid\s+url/, op: 'valid_url' },
      { re: /does\s+not\s+exist/, op: '== null' },
      { re: /exists/, op: '!= null' },
      { re: /is\s+not\s+(.+)/, op: '!=', capture: true },
      { re: /does\s+not\s+equal\s+(.+)/, op: '!=', capture: true },
      { re: /is\s+true/, op: '=== true' },
      { re: /is\s+false/, op: '=== false' },
      { re: /equals\s+(.+)/, op: '==', capture: true },
      { re: /is\s+(.+)/, op: '==', capture: true },
      { re: /contains\s+(.+)/, op: 'includes', capture: true },
      { re: /starts\s+with\s+(.+)/, op: 'startsWith', capture: true },
      { re: /ends\s+with\s+(.+)/, op: 'endsWith', capture: true },
      { re: /is\s+before\s+(.+)/, op: '<', capture: true },
      { re: /is\s+after\s+(.+)/, op: '>', capture: true },
    ];

    // Remove subject from raw for operator matching
    const afterSubject = subject ? raw.replace(`{${subject}}`, '').trim() : raw;

    for (const pattern of patterns) {
      const match = afterSubject.match(pattern.re);
      if (match) {
        const result = {
          left: subject,
          operator: pattern.op,
        };
        if (pattern.op === 'between') {
          result.right = { low: this.parseValueStr(match[1]), high: this.parseValueStr(match[2]) };
        } else if (pattern.capture && match[1]) {
          result.right = this.parseValueStr(match[1].trim());
        } else {
          result.right = null;
        }
        return result;
      }
    }

    // Fallback: return raw expression
    return {
      type: 'expression',
      raw,
      left: subject,
      operator: null,
      right: null,
    };
  }

  parseValueStr(str) {
    if (!str) return null;
    str = str.trim();
    // Variable
    if (str.startsWith('{') && str.endsWith('}')) return str.slice(1, -1);
    // String
    if (str.startsWith('"') && str.endsWith('"')) return str.slice(1, -1);
    // Number
    if (/^\d+(\.\d+)?$/.test(str)) return parseFloat(str);
    // Boolean
    if (str === 'true') return true;
    if (str === 'false') return false;
    if (str === 'null') return null;
    // Array-like
    if (str.startsWith('[')) {
      try {
        return JSON.parse(str.replace(/'/g, '"'));
      } catch { /* fallthrough */ }
    }
    return str;
  }

  // ─── Parse inline props: key = value pairs ───
  parseInlineProps() {
    const props = {};
    while (this.peek()) {
      const t = this.peek();
      if (t.type === TokenType.INDENT || t.type === TokenType.EOF || t.type === TokenType.COMMENT) break;
      if (t.type === TokenType.COLON && this.isEndOfLineColon()) break;

      // Look for pattern: text = value or text = {variable}
      if (t.type === TokenType.TEXT || t.type === TokenType.VARIABLE) {
        const next = this.peek(1);
        if (next && next.type === TokenType.EQUALS) {
          const key = this.advance().value;
          this.advance(); // consume '='
          const val = this.parseValue();
          props[key] = val;
          this.match(TokenType.COMMA);
          continue;
        }
      }
      // Not a prop — break
      break;
    }
    return props;
  }

  parseValue() {
    const t = this.peek();
    if (!t) return null;
    if (t.type === TokenType.VARIABLE) { this.advance(); return { ref: t.value }; }
    if (t.type === TokenType.STRING) { this.advance(); return t.value; }
    if (t.type === TokenType.NUMBER) { this.advance(); return t.value; }
    if (t.type === TokenType.BOOLEAN) { this.advance(); return t.value; }
    if (t.type === TokenType.NULL) { this.advance(); return null; }
    if (t.type === TokenType.LBRACKET) return this.parseArray();
    if (t.type === TokenType.TEXT) {
      // Might be a text value or a keyword like 'handle'
      const collected = [];
      while (this.peek() && this.peek().type === TokenType.TEXT) {
        collected.push(this.advance().value);
      }
      // If next is a variable, grab it too
      while (this.peek() && (this.peek().type === TokenType.VARIABLE || this.peek().type === TokenType.TEXT)) {
        const pt = this.advance();
        collected.push(pt.type === TokenType.VARIABLE ? `{${pt.value}}` : pt.value);
      }
      return collected.join(' ');
    }
    return null;
  }

  parseArray() {
    this.expect(TokenType.LBRACKET);
    const items = [];
    while (this.peek() && this.peek().type !== TokenType.RBRACKET) {
      const val = this.parseValue();
      if (val !== null) items.push(val);
      this.match(TokenType.COMMA);
    }
    this.expect(TokenType.RBRACKET);
    return items;
  }

  // ─── Block props (indented key = value) ───
  parseBlockProps(indent) {
    const props = {};
    while (this.peek()?.type === TokenType.INDENT && this.peek().value >= indent) {
      const savedPos = this.pos;
      this.advance(); // consume indent
      this.skipComments();

      const t = this.peek();
      if (!t) break;

      // Check for key = value pattern
      const next = this.peek(1);
      if (t.type === TokenType.TEXT && next && next.type === TokenType.EQUALS) {
        const key = this.advance().value;
        this.advance(); // consume '='
        const val = this.parseValue();
        props[key] = val;
      } else {
        // Not a prop line, rewind
        this.pos = savedPos;
        break;
      }
    }
    return props;
  }

  // ─── Keyword-specific parse methods ───

  parseCreate(currentIndent) {
    this.advance(); // consume 'Create'
    const desc = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Create', description: desc, children, line: this.peek()?.line };
  }

  parseShow(currentIndent) {
    this.advance(); // consume 'Show'
    const parts = this.collectLineText();
    const node = { type: 'Show', line: parts[0]?.line };

    // Extract variable if present
    const varToken = parts.find(t => t.type === TokenType.VARIABLE);
    if (varToken) {
      node.variable = varToken.value;
    }

    // Extract string literal if present
    const strToken = parts.find(t => t.type === TokenType.STRING);
    if (strToken) {
      node.text = strToken.value;
    }

    // Build modifier from remaining tokens
    const modifier = parts
      .filter(t => t !== varToken && t !== strToken)
      .map(t => t.type === TokenType.VARIABLE ? `{${t.value}}` : String(t.value))
      .join(' ').trim();
    if (modifier) node.modifier = modifier;

    const children = this.consumeBlock(currentIndent);
    if (children.length > 0) node.children = children;

    return node;
  }

  parsePlace(currentIndent) {
    this.advance(); // consume 'Place'
    const node = { type: 'Place', line: this.peek()?.line };

    // Get component reference
    const varToken = this.match(TokenType.VARIABLE);
    if (varToken) {
      node.component = varToken.value;
    }

    // Collect remainder for description/positioning
    const rest = this.collectLineAsString();
    if (rest) node.modifier = rest;

    // Check for block (props)
    if (this.hasBlock()) {
      this.advance();
      node.props = this.parseBlockProps(currentIndent + 1);
      node.children = this.parseBody(currentIndent + 1);
    } else {
      // Try inline props after 'with'
      // Already consumed in collectLineAsString, so parse from modifier
      node.props = this.extractPropsFromModifier(rest);
    }

    return node;
  }

  extractPropsFromModifier(modifier) {
    if (!modifier) return {};
    const props = {};
    // Pattern: key = value, key = value
    const regex = /(\w+)\s*=\s*(?:\{([^}]+)\}|"([^"]+)"|(\w+))/g;
    let match;
    while ((match = regex.exec(modifier)) !== null) {
      const key = match[1];
      const value = match[2] ? { ref: match[2] } : (match[3] || match[4]);
      if (value === 'true') props[key] = true;
      else if (value === 'false') props[key] = false;
      else if (!isNaN(value) && value !== '') props[key] = Number(value);
      else props[key] = value;
    }
    return props;
  }

  parseGroup(currentIndent) {
    this.advance(); // consume 'Group'
    const desc = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Group', description: desc, children, line: this.peek()?.line };
  }

  parseLoop(currentIndent) {
    this.advance(); // consume 'Loop'
    const node = { type: 'Loop', line: this.peek()?.line };

    const parts = this.collectLineText();
    const raw = parts.map(t => t.type === TokenType.VARIABLE ? `{${t.value}}` : String(t.value)).join(' ');

    // Extract collection and iterator
    // Pattern: over {collection} as {item}[, index {i}]
    const overMatch = raw.match(/over\s+(?:first\s+(\d+)\s+of\s+)?\{([^}]+)\}(?:\s+where\s+.+?)?\s+as\s+\{([^}]+)\}(?:,?\s+index\s+\{([^}]+)\})?/);
    if (overMatch) {
      node.limit = overMatch[1] ? parseInt(overMatch[1]) : null;
      node.collection = overMatch[2];
      node.iterator = overMatch[3];
      node.indexVar = overMatch[4] || null;
    } else {
      node.raw = raw;
    }

    // Check for where clause
    const whereMatch = raw.match(/where\s+(.+?)\s+as/);
    if (whereMatch) {
      node.filter = whereMatch[1];
    }

    node.children = this.consumeBlock(currentIndent);
    return node;
  }

  parseIf(currentIndent) {
    this.advance(); // consume 'If'
    const condition = this.parseCondition();
    const children = this.consumeBlock(currentIndent);

    const node = {
      type: 'If',
      condition,
      children,
      elseIf: [],
      else: null,
      line: this.peek()?.line,
    };

    // Look ahead for Else If / Else at same indent
    while (this.peek()) {
      this.skipComments();
      const t = this.peek();
      if (t?.type === TokenType.INDENT) {
        const nextKw = this.peek(1);
        if (nextKw?.type === TokenType.KEYWORD && nextKw.value === 'Else If') {
          this.advance(); // indent
          const elseIfNode = this.parseElseIf(currentIndent);
          node.elseIf.push(elseIfNode);
          continue;
        }
        if (nextKw?.type === TokenType.KEYWORD && nextKw.value === 'Else') {
          this.advance(); // indent
          node.else = this.parseElse(currentIndent);
          break;
        }
      }
      // Check if keyword directly follows (no indent token between)
      if (t?.type === TokenType.KEYWORD && t.value === 'Else If') {
        const elseIfNode = this.parseElseIf(currentIndent);
        node.elseIf.push(elseIfNode);
        continue;
      }
      if (t?.type === TokenType.KEYWORD && t.value === 'Else') {
        node.else = this.parseElse(currentIndent);
        break;
      }
      break;
    }

    return node;
  }

  parseElseIf(currentIndent) {
    this.advance(); // consume 'Else If'
    const condition = this.parseCondition();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Else If', condition, children, line: this.peek()?.line };
  }

  parseElse(currentIndent) {
    this.advance(); // consume 'Else'
    // May have trailing colon
    this.match(TokenType.COLON);
    const children = this.parseBody(currentIndent + 1);
    return { type: 'Else', children, line: this.peek()?.line };
  }

  parseSwitch(currentIndent) {
    this.advance(); // consume 'Switch'
    const varToken = this.match(TokenType.VARIABLE);
    this.collectLineText(); // consume rest
    const children = this.consumeBlock(currentIndent);
    return {
      type: 'Switch',
      variable: varToken?.value || null,
      children,
      line: this.peek()?.line,
    };
  }

  parseCase(currentIndent) {
    this.advance(); // consume 'Case'
    const value = this.parseValue();
    this.collectLineText(); // consume rest
    const children = this.consumeBlock(currentIndent);
    return { type: 'Case', value, children, line: this.peek()?.line };
  }

  parseDefault(currentIndent) {
    this.advance(); // consume 'Default'
    this.collectLineText();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Default', children, line: this.peek()?.line };
  }

  parseSet(currentIndent) {
    this.advance(); // consume 'Set'
    const node = { type: 'Set', line: this.peek()?.line };

    const varToken = this.match(TokenType.VARIABLE);
    if (varToken) node.variable = varToken.value;

    const rest = this.collectLineAsString();
    // Extract value after 'to'
    const toMatch = rest.match(/to\s+(.*)/);
    if (toMatch) {
      node.value = this.parseValueStr(toMatch[1].trim());
    } else {
      node.raw = rest;
    }

    // Block form: Set {var} to:\n  key: value
    if (this.hasBlock()) {
      this.advance();
      node.children = this.parseBody(currentIndent + 1);
    }

    return node;
  }

  parseBind(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Bind', variable: varToken?.value, modifier: rest, children, line: this.peek()?.line };
  }

  parseFetch(currentIndent) {
    this.advance();
    const node = { type: 'Fetch', line: this.peek()?.line };

    const varToken = this.match(TokenType.VARIABLE);
    if (varToken) node.variable = varToken.value;

    const rest = this.collectLineAsString();
    // Extract URL from "..." after 'from'
    const fromMatch = rest.match(/from\s+"([^"]+)"/);
    if (fromMatch) {
      node.url = fromMatch[1];
    }
    node.modifier = rest;
    node.children = this.consumeBlock(currentIndent);
    return node;
  }

  parseCompute(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    return {
      type: 'Compute',
      variable: varToken?.value,
      expression: rest,
      line: this.peek()?.line,
    };
  }

  parseStore(currentIndent) {
    this.advance();
    const name = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return {
      type: 'Store',
      name: name,
      children,
      line: this.peek()?.line,
    };
  }

  parseUpdate(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    return {
      type: 'Update',
      variable: varToken?.value,
      modifier: rest,
      line: this.peek()?.line,
    };
  }

  parseOn(currentIndent) {
    this.advance();

    // Collect tokens up to a colon (event name)
    const eventParts = [];
    while (this.peek() && this.peek().type !== TokenType.INDENT && this.peek().type !== TokenType.EOF) {
      const t = this.peek();
      if (t.type === TokenType.COMMENT) break;
      if (t.type === TokenType.COLON) {
        this.advance(); // consume ':'
        break;
      }
      eventParts.push(this.advance());
    }

    const event = eventParts.map(t => {
      if (t.type === TokenType.VARIABLE) return `{${t.value}}`;
      if (t.type === TokenType.STRING) return `"${t.value}"`;
      return String(t.value);
    }).join(' ').trim();

    // Check if there's an inline action after the colon on the same line
    let children = [];
    const next = this.peek();
    if (next && next.type !== TokenType.INDENT && next.type !== TokenType.EOF && next.type !== TokenType.COMMENT) {
      // Inline action — promote TEXT that matches a keyword to KEYWORD
      if (next.type === TokenType.KEYWORD) {
        const node = this.parseStatement(currentIndent);
        if (node) children.push(node);
      } else if (next.type === TokenType.TEXT && INLINE_KEYWORDS.has(next.value)) {
        // Promote to keyword and parse
        next.type = TokenType.KEYWORD;
        const node = this.parseStatement(currentIndent);
        if (node) children.push(node);
      } else {
        const text = this.collectLineAsString();
        if (text) children.push({ type: 'Text', content: text });
      }
    }

    // Also parse block children
    const blockChildren = this.consumeBlock(currentIndent);
    children = children.concat(blockChildren);

    return {
      type: 'On',
      event,
      children,
      line: this.peek()?.line,
    };
  }

  parseNavigate(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    // Extract destination
    let destination = rest;
    const toMatch = rest.match(/to\s+"([^"]+)"/);
    if (toMatch) destination = toMatch[1];
    else {
      const toVarMatch = rest.match(/to\s+"?([^"]*)"?/);
      if (toVarMatch) destination = toVarMatch[1];
    }
    const children = this.consumeBlock(currentIndent);
    return { type: 'Navigate', destination, raw: rest, children, line: this.peek()?.line };
  }

  parseSubmit(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Submit', variable: varToken?.value, modifier: rest, children, line: this.peek()?.line };
  }

  parseEmit(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Emit', raw: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseToggle(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Toggle', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseOpen(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Open', variable: varToken?.value, modifier: rest, children, line: this.peek()?.line };
  }

  parseClose(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Close', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parsePrevent(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Prevent', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseFill(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    this.collectLineText(); // consume rest
    const children = this.consumeBlock(currentIndent);
    return { type: 'Fill', slot: varToken?.value, children, line: this.peek()?.line };
  }

  parseSlot(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Slot', name: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseHide(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Hide', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseList(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'List', variable: varToken?.value, modifier: rest, children, line: this.peek()?.line };
  }

  parseTable(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Table', variable: varToken?.value, modifier: rest, children, line: this.peek()?.line };
  }

  parseImage(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Image', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseLink(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Link', modifier: rest, children, line: this.peek()?.line };
  }

  parseIcon(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Icon', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseInput(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    const node = { type: 'Input', modifier: rest, children, line: this.peek()?.line };

    // Extract 'for {variable}' pattern
    const forMatch = rest.match(/for\s+\{([^}]+)\}/);
    if (forMatch) node.variable = forMatch[1];

    // Extract type
    const typeMatch = rest.match(/type\s+(\w+)/);
    if (typeMatch) node.inputType = typeMatch[1];

    return node;
  }

  parseTextarea(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Textarea', modifier: rest, children, line: this.peek()?.line };
  }

  parseSelect(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Select', variable: varToken?.value, modifier: rest, children, line: this.peek()?.line };
  }

  parseCheckbox(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Checkbox', modifier: rest, children, line: this.peek()?.line };
  }

  parseRadio(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Radio', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseUpload(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Upload', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseDatePicker(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'DatePicker', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseStyle(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Style', modifier: rest, children, line: this.peek()?.line };
  }

  parseAnimate(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Animate', modifier: rest, children, line: this.peek()?.line };
  }

  parseResponsive(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Responsive', modifier: rest, children, line: this.peek()?.line };
  }

  parseWhen(currentIndent) {
    this.advance();
    const condition = this.parseCondition();
    const children = this.consumeBlock(currentIndent);
    return { type: 'When', condition, children, line: this.peek()?.line };
  }

  parseWhile(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'While', modifier: rest, children, line: this.peek()?.line };
  }

  parseHandle(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Handle', name: rest, children, line: this.peek()?.line };
  }

  parseImportStatement(currentIndent) {
    // Import within body (not top-level)
    this.advance();
    const imp = this.parseSingleImport();
    return { type: 'Import', ...imp, line: this.peek()?.line };
  }

  parseDebug(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Debug', expression: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseTodo(currentIndent) {
    this.advance();
    // Consume optional colon
    this.match(TokenType.COLON);
    const rest = this.collectLineAsString();
    return { type: 'TODO', message: rest, line: this.peek()?.line };
  }

  parseValidate(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Validate', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseMarkdown(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Markdown', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseWatch(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    this.collectLineText();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Watch', variable: varToken?.value, children, line: this.peek()?.line };
  }

  parseListen(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Listen', modifier: rest, children, line: this.peek()?.line };
  }

  parseClear(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Clear', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseCall(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Call', target: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseRefresh(currentIndent) {
    this.advance();
    const varToken = this.match(TokenType.VARIABLE);
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Refresh', variable: varToken?.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseDelete(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Delete', modifier: rest, children, line: this.peek()?.line };
  }

  parseUse(currentIndent) {
    this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: 'Use', modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseGenericKeyword(currentIndent) {
    const kw = this.advance();
    const rest = this.collectLineAsString();
    const children = this.consumeBlock(currentIndent);
    return { type: kw.value, modifier: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }

  parseTextStatement(currentIndent = 0) {
    const rest = this.collectLineAsString();
    if (!rest) return null;
    const children = this.consumeBlock(currentIndent);
    return { type: 'Text', content: rest, children: children.length > 0 ? children : undefined, line: this.peek()?.line };
  }
}

export function parseEngFile(source, filePath) {
  const parser = new Parser(source, filePath);
  return parser.parse();
}
