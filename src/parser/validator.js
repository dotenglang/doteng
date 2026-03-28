import { ValidationError, CircularImportError, NestingDepthError } from '../utils/errors.js';

const MAX_NESTING_DEPTH = 12;

const RESERVED_KEYWORDS = new Set([
  'Import', 'Place', 'Slot', 'Fill', 'Create', 'Show', 'Group', 'Hide',
  'Loop', 'If', 'Else', 'Switch', 'Case', 'Default',
  'Set', 'Bind', 'Fetch', 'Compute', 'Store', 'Update', 'Watch', 'Use',
  'On', 'Navigate', 'Submit', 'Emit', 'Toggle', 'Open', 'Close', 'Prevent',
  'List', 'Table', 'Image', 'Link', 'Icon', 'Markdown',
  'Input', 'Textarea', 'Select', 'Checkbox', 'Radio', 'Upload', 'DatePicker', 'TimePicker',
  'Style', 'Theme', 'Responsive', 'Animate',
  'Debug', 'Comment', 'TODO', 'Include',
  'Handle', 'Call', 'Refresh', 'Clear', 'Reset', 'Retry',
  'When', 'While', 'Or', 'And', 'Not',
  'Listen', 'Scroll', 'Confirm', 'Delete', 'Validate',
  'true', 'false', 'null', 'today', 'now',
]);

export class Validator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate(ast, importResolver = null) {
    this.errors = [];
    this.warnings = [];

    this.validateFrontmatter(ast);
    this.validateImports(ast, importResolver);
    this.validateBody(ast.body, 0, ast);
    this.checkUnusedImports(ast);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  addError(message, line = null, file = null) {
    this.errors.push(new ValidationError(message, line, null, file));
  }

  addWarning(message, line = null, file = null) {
    this.warnings.push({ message, line, file });
  }

  // ── Frontmatter ──

  validateFrontmatter(ast) {
    const fm = ast.frontmatter;
    if (!fm) {
      this.addError('Missing frontmatter block', 1, ast.file);
      return;
    }

    if (!fm.type) {
      this.addError('Frontmatter missing required field: type', 1, ast.file);
    } else {
      const validTypes = ['component', 'page', 'layout', 'fragment', 'modal'];
      if (!validTypes.includes(fm.type)) {
        this.addError(`Invalid frontmatter type "${fm.type}". Must be one of: ${validTypes.join(', ')}`, 1, ast.file);
      }
    }

    if (!fm.name) {
      this.addError('Frontmatter missing required field: name', 1, ast.file);
    } else {
      // Name must be PascalCase
      if (!/^[A-Z][a-zA-Z0-9]*$/.test(fm.name)) {
        this.addWarning(`Component name "${fm.name}" should be PascalCase`, 1, ast.file);
      }
      // Check reserved keywords
      if (RESERVED_KEYWORDS.has(fm.name)) {
        this.addError(`Component name "${fm.name}" is a reserved keyword`, 1, ast.file);
      }
    }

    // Validate props
    if (fm.props && Array.isArray(fm.props)) {
      const validPropTypes = ['string', 'number', 'boolean', 'array', 'object', 'image', 'date', 'any'];
      for (const prop of fm.props) {
        if (!prop.name) {
          this.addError('Prop missing required field: name', 1, ast.file);
        } else if (RESERVED_KEYWORDS.has(prop.name)) {
          this.addError(`Prop name "${prop.name}" is a reserved keyword`, 1, ast.file);
        }
        if (prop.type && !validPropTypes.includes(prop.type)) {
          this.addWarning(`Prop "${prop.name}" has unknown type "${prop.type}"`, 1, ast.file);
        }
      }
    }

    // Page-specific checks
    if (fm.type === 'page') {
      if (fm.auth && !['required', 'guest', 'any'].includes(fm.auth)) {
        this.addWarning(`Invalid auth value "${fm.auth}". Expected: required, guest, or any`, 1, ast.file);
      }
    }
  }

  // ── Imports ──

  validateImports(ast, importResolver) {
    const seen = new Set();
    for (const imp of ast.imports) {
      // Check duplicate import names
      if (seen.has(imp.name)) {
        this.addError(`Duplicate import name "${imp.name}"`, null, ast.file);
      }
      seen.add(imp.name);

      // Import names must be camelCase
      if (!/^[a-z][a-zA-Z0-9]*$/.test(imp.name)) {
        this.addWarning(`Import name "${imp.name}" should be camelCase`, null, ast.file);
      }

      // Path must end with .eng
      if (!imp.path.endsWith('.eng')) {
        this.addError(`Import path "${imp.path}" must end with .eng`, null, ast.file);
      }

      // Check reserved keywords for import names
      if (RESERVED_KEYWORDS.has(imp.name)) {
        this.addError(`Import name "${imp.name}" is a reserved keyword`, null, ast.file);
      }
    }
  }

  // ── Circular import detection ──

  static checkCircularImports(filePath, importMap, visited = new Set(), chain = []) {
    if (visited.has(filePath)) {
      const cycleStart = chain.indexOf(filePath);
      if (cycleStart >= 0) {
        const cycle = [...chain.slice(cycleStart), filePath];
        throw new CircularImportError(cycle, filePath);
      }
      return;
    }

    visited.add(filePath);
    chain.push(filePath);

    const imports = importMap.get(filePath) || [];
    for (const imp of imports) {
      Validator.checkCircularImports(imp, importMap, new Set(visited), [...chain]);
    }
  }

  // ── Body validation ──

  validateBody(nodes, depth, ast) {
    if (depth > MAX_NESTING_DEPTH) {
      const line = nodes[0]?.line || null;
      this.errors.push(new NestingDepthError(depth, MAX_NESTING_DEPTH, line, ast.file));
      return;
    }

    for (const node of nodes) {
      this.validateNode(node, depth, ast);
    }
  }

  validateNode(node, depth, ast) {
    // Validate children recursively
    if (node.children && Array.isArray(node.children)) {
      this.validateBody(node.children, depth + 1, ast);
    }

    // If/Else If/Else chain
    if (node.type === 'If') {
      if (node.elseIf) {
        for (const ei of node.elseIf) {
          if (ei.children) this.validateBody(ei.children, depth + 1, ast);
        }
      }
      if (node.else?.children) {
        this.validateBody(node.else.children, depth + 1, ast);
      }
    }

    // Image requires alt text (warning)
    if (node.type === 'Image') {
      if (!node.modifier || !node.modifier.includes('alt')) {
        this.addWarning('Image should have alt text for accessibility', node.line, ast.file);
      }
    }

    // Input should have label (warning)
    if (node.type === 'Input') {
      const hasLabel = node.modifier?.includes('label') ||
        node.children?.some(c => c.type === 'Text' && c.content?.includes('label'));
      if (!hasLabel) {
        this.addWarning('Input should have a label for accessibility', node.line, ast.file);
      }
    }
  }

  // ── Unused imports ──

  checkUnusedImports(ast) {
    const importNames = new Set(ast.imports.map(i => i.alias || i.name));
    const usedRefs = new Set();

    // Walk the AST to find all variable references
    this.collectVariableRefs(ast.body, usedRefs);

    for (const name of importNames) {
      if (!usedRefs.has(name)) {
        this.addWarning(`Import "${name}" is declared but never used`, null, ast.file);
      }
    }
  }

  collectVariableRefs(nodes, refs) {
    for (const node of nodes) {
      // Check common fields that might reference imports
      if (node.component) refs.add(node.component);
      if (node.variable) {
        const root = node.variable.split('.')[0];
        refs.add(root);
      }

      // Recurse into children
      if (node.children && Array.isArray(node.children)) {
        this.collectVariableRefs(node.children, refs);
      }
      if (node.elseIf) {
        for (const ei of node.elseIf) {
          if (ei.children) this.collectVariableRefs(ei.children, refs);
        }
      }
      if (node.else?.children) {
        this.collectVariableRefs(node.else.children, refs);
      }

      // Check condition references
      if (node.condition) {
        this.collectConditionRefs(node.condition, refs);
      }
    }
  }

  collectConditionRefs(condition, refs) {
    if (!condition) return;
    if (condition.left) {
      const root = String(condition.left).split('.')[0];
      refs.add(root);
    }
    if (condition.right && typeof condition.right === 'object' && condition.right.ref) {
      refs.add(condition.right.ref.split('.')[0]);
    }
    if (condition.left && typeof condition.left === 'object') {
      this.collectConditionRefs(condition.left, refs);
    }
    if (condition.right && typeof condition.right === 'object' && condition.type === 'compound') {
      this.collectConditionRefs(condition.right, refs);
    }
  }
}
