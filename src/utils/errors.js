export class EngError extends Error {
  constructor(message, line = null, column = null, file = null) {
    super(message);
    this.name = 'EngError';
    this.line = line;
    this.column = column;
    this.file = file;
  }

  toString() {
    let loc = '';
    if (this.file) loc += `${this.file}`;
    if (this.line !== null) loc += `:${this.line}`;
    if (this.column !== null) loc += `:${this.column}`;
    return loc ? `${this.name} [${loc}]: ${this.message}` : `${this.name}: ${this.message}`;
  }
}

export class LexerError extends EngError {
  constructor(message, line, column, file) {
    super(message, line, column, file);
    this.name = 'LexerError';
  }
}

export class ParseError extends EngError {
  constructor(message, line, column, file) {
    super(message, line, column, file);
    this.name = 'ParseError';
  }
}

export class ValidationError extends EngError {
  constructor(message, line, column, file) {
    super(message, line, column, file);
    this.name = 'ValidationError';
  }
}

export class CircularImportError extends ValidationError {
  constructor(cycle, file) {
    super(`Circular import detected: ${cycle.join(' → ')}`, null, null, file);
    this.name = 'CircularImportError';
    this.cycle = cycle;
  }
}

export class NestingDepthError extends ValidationError {
  constructor(depth, maxDepth, line, file) {
    super(`Maximum nesting depth of ${maxDepth} exceeded (found ${depth})`, line, null, file);
    this.name = 'NestingDepthError';
    this.depth = depth;
    this.maxDepth = maxDepth;
  }
}
