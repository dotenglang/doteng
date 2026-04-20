import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { resolveProvider, createProviderClient } from './providers.js';

// ── Target-specific output mappings ──

const TARGET_CONFIG = {
  react: {
    name: 'React',
    extensions: { component: '.jsx', page: '.jsx', layout: '.jsx', fragment: '.jsx', modal: '.jsx' },
    dirMap: { component: 'components', page: 'pages', layout: 'layouts', fragment: 'fragments', modal: 'modals' },
    description: 'React functional components with JSX, hooks (useState, useEffect, useNavigate), and Tailwind CSS classes.',
    mappings: `
- Loop over → .map() with key prop
- If → {condition && <...>} or ternary
- Slot → {children} prop or named render props
- Fill → pass as children or named props
- Set → useState() hook
- Bind → value={state} + onChange handler
- Fetch → useEffect + fetch or useSWR pattern
- On click → onClick handler
- Navigate → useNavigate() from react-router-dom
- Store → React Context or props
- Style → Tailwind CSS utility classes
- Animate → CSS transitions or className toggling
- Emit → callback props (e.g. onItemAdded)
- Toggle → setState(prev => !prev)`,
  },
  'laravel-blade': {
    name: 'Laravel Blade',
    extensions: { component: '.blade.php', page: '.blade.php', layout: '.blade.php', fragment: '.blade.php', modal: '.blade.php' },
    dirMap: { component: 'components', page: 'pages', layout: 'layouts', fragment: 'partials', modal: 'modals' },
    extraFiles: true,
    description: 'Laravel Blade templates with Blade directives, Tailwind CSS, and Alpine.js for interactivity.',
    mappings: `
- Loop over → @foreach($items as $item) ... @endforeach
- If → @if($condition) ... @elseif ... @else ... @endif
- Slot → @yield('name') in layouts, {{ $slot }} in components
- Fill → @section('name') ... @endsection
- Set → $variable in controller, or Alpine.js x-data
- Bind → wire:model (Livewire) or x-model (Alpine.js)
- Fetch → Controller method passes data to view
- On click → Alpine.js @click or onclick
- Navigate → <a href="..."> or redirect()
- Store → session(), cache(), or Livewire state
- Style → Tailwind CSS utility classes
- Animate → Alpine.js x-transition or CSS
- Emit → Livewire events or Alpine.js $dispatch`,
  },
  html: {
    name: 'Static HTML',
    extensions: { component: '.html', page: '.html', layout: '.html', fragment: '.html', modal: '.html' },
    dirMap: { component: 'components', page: '', layout: 'layouts', fragment: 'fragments', modal: 'modals' },
    description: 'Static HTML5 with inline CSS (Tailwind via CDN), and vanilla JavaScript for interactivity.',
    mappings: `
- Loop over → Generate repeated HTML elements (the LLM should unroll the loop or use template/JS)
- If → Use JS to conditionally show/hide elements, or generate the visible branch
- Slot → Placeholder div with data attribute or comment marker
- Fill → Inline the content directly where the slot is
- Set → const/let variable in <script> tag
- Bind → addEventListener('input', ...) on form elements
- Fetch → fetch() API in <script> tag
- On click → onclick attribute or addEventListener
- Navigate → <a href="..."> or window.location
- Store → localStorage or sessionStorage
- Style → Tailwind CDN utility classes or inline style
- Animate → CSS @keyframes or transitions`,
  },
};

// ── System prompt builder ──

function buildSystemPrompt(target, config) {
  const tc = TARGET_CONFIG[target];
  if (!tc) throw new Error(`Unsupported target: ${target}. Supported: ${Object.keys(TARGET_CONFIG).join(', ')}`);

  const theming = config.theming || {};
  const css = config.compiler?.css || {};

  return `You are a code generator for the .eng language — a structured natural language that compiles to real framework code.

## Your Task
Convert the provided .eng AST (JSON) into production-ready ${tc.name} code.

## About .eng AST
Each AST has:
- \`frontmatter\`: metadata (type, name, props, extends, route, auth, etc.)
- \`imports\`: other .eng components this file uses
- \`body\`: array of AST nodes describing the UI

AST node types include:
- **Create**: a container/element. \`description\` holds natural language styling/structure hints. \`children\` are nested nodes.
- **Show**: display content. \`variable\` is a data reference, \`text\` is a literal string, \`modifier\` describes how to render it.
- **Place**: render an imported component. \`component\` is the import name, \`props\` are passed properties.
- **Group**: wraps children with layout (flex row/column/grid from description).
- **Loop**: iterates \`collection\` as \`iterator\` (optional \`indexVar\`, \`limit\`, \`filter\`).
- **If**: conditional with \`condition\` (left/operator/right), \`children\`, optional \`elseIf\`[] and \`else\`.
- **Set**: declares state. \`variable\` name, \`value\`.
- **On**: event handler. \`event\` name (click, hover, change, etc.), \`children\` are actions.
- **Navigate**: route change. \`destination\` URL.
- **Fetch**: data loading. \`variable\` to store data, \`url\` endpoint.
- **Fill**: provides content for a layout slot. \`slot\` name, \`children\` content.
- **Slot**: declares a fillable area. \`name\` identifier.
- **Link**: hyperlink. \`modifier\` contains target URL and display text.
- **Input/Select/Checkbox/Textarea**: form elements with \`variable\` binding, \`inputType\`, \`modifier\`.
- **Style**: styling directive. \`modifier\` contains natural language styles.
- **Animate**: animation. \`modifier\` describes animation type.
- **Toggle/Update/Emit/Submit/Open/Close/Prevent**: interaction primitives.

## Target: ${tc.name}
${tc.description}

### Concept Mapping
${tc.mappings}

## Design Tokens (from project config)
CSS Framework: ${css.framework || 'tailwind'} v${css.version || '3'}
Colors:
- Primary: ${theming.primary || '#3B82F6'}
- Secondary: ${theming.secondary || '#6366F1'}
- Success: ${theming.success || '#10B981'}
- Warning: ${theming.warning || '#F59E0B'}
- Danger: ${theming.danger || '#EF4444'}
- Info: ${theming.info || '#06B6D4'}
Typography:
- Heading font: ${theming.font_heading || 'Inter'}
- Body font: ${theming.font_body || 'Inter'}
Layout:
- Border radius: ${theming.border_radius || '8px'}
- Spacing unit: ${theming.spacing_unit || '4px'}

## Output Format
You MUST respond with ONLY a JSON object (no markdown fencing, no explanation) in this exact format:
{
  "files": [
    {
      "path": "relative/path/to/File.jsx",
      "content": "// full file content here..."
    }
  ]
}

Rules:
- Every file must be complete and self-contained (all imports, all logic).
- Use the component name from frontmatter for filenames (PascalCase).
- For components/fragments: output 1 file (the component).
- For pages extending layouts: output the page file. Reference the layout as an import.
- For layouts: output the layout component file.
${target === 'laravel-blade' ? '- For pages: also output a route entry file (routes.php fragment) and a controller file if the page fetches data.\n- Use @extends, @section, @yield for layout/slot/fill.' : ''}
${target === 'html' ? '- Include Tailwind CDN link in <head>. Output fully self-contained HTML files.\n- Use <script> tags for any JavaScript interactivity.\n- CRITICAL: All internal links must use relative .html file paths (e.g. "about.html", "contact.html"), NOT abstract routes like "/about". External URLs (https://...) stay as-is.\n- If a route-to-file map is provided in the user prompt, use it for all <a href> values.' : ''}
${target === 'react' ? `- Use functional components with hooks.
- Import React, useState, useEffect as needed.
- Use Tailwind classes for styling. Match the EXACT same visual styling as if this were a static HTML page — same spacing, colors, layout, responsive breakpoints.
- Export the component as default.
- ICONS: Use lucide-react for ALL icons. Import each icon by PascalCase name: import { LayoutDashboard, Clock, BarChart2 } from 'lucide-react'. Convert kebab-case icon names from the AST to PascalCase (e.g. "layout-dashboard" → LayoutDashboard, "bar-chart-2" → BarChart2, "arrow-up" → ArrowUp). NEVER render icon names as text.
- BUTTONS: When multiple buttons are in a row, use flex with gap. Never make buttons full-width unless explicitly stated.
- LAYOUT: Use the exact Tailwind utility classes needed to match the described layout — flex-row for horizontal groups, grid-cols-3 for 3-column grids, etc.` : ''}
- Translate ALL natural language descriptions into real code — every Show, Create, Style, Group etc. must produce actual markup.
- Props from frontmatter become component parameters with their default values.
- Map condition operators: == is ===, != is !==, empty is .length === 0, auth.check is isAuthenticated check, etc.
- Always include accessibility attributes (alt on images, labels on inputs, semantic HTML).
- Do NOT include any explanation, only the JSON object.`;
}

// ── Build the user prompt for a single file ──

function buildUserPrompt(ast, context = {}) {
  let prompt = `## Compile this .eng file

### Primary AST
\`\`\`json
${JSON.stringify(ast, null, 2)}
\`\`\``;

  if (context.layoutAst) {
    prompt += `

### Layout AST (this page extends this layout)
\`\`\`json
${JSON.stringify(context.layoutAst, null, 2)}
\`\`\``;
  }

  if (context.importedAsts && context.importedAsts.length > 0) {
    prompt += `

### Imported Component Signatures (for correct prop passing and naming — bodies omitted to save tokens)`;
    for (const imp of context.importedAsts) {
      const signature = {
        name: imp.frontmatter?.name || null,
        type: imp.frontmatter?.type || null,
        description: imp.frontmatter?.description || null,
        props: imp.frontmatter?.props || [],
        importedAs: imp._importName || null,
      };
      prompt += `

#### ${signature.name || 'Unknown'} (imported as "${signature.importedAs}")
\`\`\`json
${JSON.stringify(signature, null, 2)}
\`\`\``;
    }
  }

  if (context.routeMap && Object.keys(context.routeMap).length > 0) {
    prompt += `

### Route-to-File Map (use these for all internal links)
${Object.entries(context.routeMap).map(([route, file]) => `- "${route}" → "${file}"`).join('\n')}
- Any route not in this list → use "#" as placeholder`;
  }

  return prompt;
}

// ── Cache helpers ──

function hashAst(ast, target, model) {
  const str = JSON.stringify(ast) + '|' + target + '|' + model;
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
}

function getCachePath(cacheDir, hash) {
  return path.join(cacheDir, `${hash}.json`);
}

function readCache(cacheDir, hash) {
  const p = getCachePath(cacheDir, hash);
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch { /* corrupted cache */ }
  }
  return null;
}

function writeCache(cacheDir, hash, data) {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(getCachePath(cacheDir, hash), JSON.stringify(data, null, 2));
}

// ── Response parsing ──

function parseResponse(text) {
  const trimmed = text.trim();

  // Strip markdown fencing if present
  let jsonStr = trimmed;
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.files && Array.isArray(parsed.files)) {
      return parsed;
    }
    if (parsed.output?.files) return parsed.output;
  } catch {
    // JSON parse failed
  }

  // Fallback: find the first { ... } that contains "files"
  const objMatch = trimmed.match(/\{[\s\S]*"files"\s*:\s*\[[\s\S]*\]\s*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]);
    } catch { /* failed */ }
  }

  // Last resort: extract code blocks as files
  const codeBlocks = [...trimmed.matchAll(/```(\w+)?\n([\s\S]*?)```/g)];
  if (codeBlocks.length > 0) {
    return {
      files: codeBlocks.map((block, i) => ({
        path: `output_${i}.${block[1] || 'txt'}`,
        content: block[2],
      })),
      _fallback: true,
    };
  }

  throw new Error('Could not parse LLM response as JSON. Raw response:\n' + trimmed.slice(0, 500));
}

// ── Main compiler class ──

export class Compiler {
  constructor(config = {}) {
    this.target = config.target || 'react';
    this.config = config;
    this.cacheDir = path.resolve(config.cacheDir || '.eng-cache');
    const baseOutput = config.compiler?.output?.directory || config.outputDir || './dist';
    this.outputDir = path.resolve(baseOutput, this.target);
    this.model = config.model || config.compiler?.llm?.model || 'claude-sonnet-4-20250514';
    this.dryRun = config.dryRun || false;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;

    if (!TARGET_CONFIG[this.target]) {
      throw new Error(`Unsupported target: "${this.target}". Supported targets: ${Object.keys(TARGET_CONFIG).join(', ')}`);
    }

    // Provider client — lazily initialized on first compile()
    this._providerClient = null;
    this._providerInfo = null;

    // Pre-resolve provider to validate the model name early (doesn't need API key yet)
    try {
      this._providerInfo = resolveProvider(this.model);
    } catch (err) {
      if (!this.dryRun) throw err;
    }
  }

  /**
   * Lazy-init the provider client (needs API key at call time, not construction time).
   */
  async getProviderClient() {
    if (!this._providerClient) {
      this._providerClient = await createProviderClient(this.model);
    }
    return this._providerClient;
  }

  /**
   * Human-readable provider + model label for display.
   */
  get modelLabel() {
    const providerName = this._providerInfo?.name || 'Unknown';
    return `${this.model} (${providerName})`;
  }

  /**
   * Compile a single AST, optionally with context (layout AST, imported ASTs).
   * Returns { files: [{ path, content }], cached: bool, usage: { input, output } }
   */
  async compile(ast, context = {}) {
    if (!ast || ast.type !== 'EngFile') {
      throw new Error('Invalid AST: expected EngFile root node');
    }

    const hash = hashAst({ ast, context, target: this.target }, this.target, this.model);

    // Check cache
    const cached = readCache(this.cacheDir, hash);
    if (cached) {
      return { ...cached, cached: true, usage: { input: 0, output: 0 } };
    }

    // Dry run — return placeholder
    if (this.dryRun) {
      const tc = TARGET_CONFIG[this.target];
      const fileType = ast.frontmatter?.type || 'component';
      const name = ast.frontmatter?.name || 'Unknown';
      const ext = tc.extensions[fileType] || '.txt';
      const dir = tc.dirMap[fileType] || '';
      return {
        files: [{ path: path.join(dir, `${name}${ext}`), content: `// Dry run — would generate ${this.target} code for ${name} using ${this.model}` }],
        cached: false,
        dryRun: true,
        usage: { input: 0, output: 0 },
      };
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt(this.target, this.config);
    const userPrompt = buildUserPrompt(ast, context);

    // Get provider client
    const pc = await this.getProviderClient();

    // Call LLM with retry
    let result;
    let lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await pc.call({
          system: systemPrompt,
          user: userPrompt,
          maxTokens: 16384,
        });
        break;
      } catch (err) {
        lastError = err;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (!result) {
      throw new Error(`API call failed after 2 attempts (${pc.provider.name}): ${lastError?.message || 'Unknown error'}`);
    }

    // Track token usage
    this.totalInputTokens += result.usage.input;
    this.totalOutputTokens += result.usage.output;

    // Parse the response into files
    const parsed = parseResponse(result.text);

    // Cache the result
    writeCache(this.cacheDir, hash, parsed);

    return { ...parsed, cached: false, usage: result.usage };
  }

  /**
   * Write compiled files to the output directory.
   */
  writeFiles(files) {
    const written = [];
    for (const file of files) {
      const fullPath = path.join(this.outputDir, file.path);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, file.content, 'utf-8');
      written.push(fullPath);
    }
    return written;
  }

  /**
   * Return token usage summary.
   */
  getUsageSummary() {
    // Rough pricing — not authoritative, just an estimate
    const inputCost = (this.totalInputTokens / 1_000_000) * 3;
    const outputCost = (this.totalOutputTokens / 1_000_000) * 15;
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      estimatedCost: `~$${(inputCost + outputCost).toFixed(4)}`,
    };
  }

  /**
   * Clean the output directory.
   */
  cleanOutput() {
    if (fs.existsSync(this.outputDir)) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(this.outputDir, { recursive: true });
  }
}

export { TARGET_CONFIG };
