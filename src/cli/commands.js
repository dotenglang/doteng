import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import { parse as parseYaml } from 'yaml';
import { parseEngFile } from '../parser/parser.js';
import { Validator } from '../parser/validator.js';
import { Compiler, TARGET_CONFIG } from '../compiler/compiler.js';

// ── parse command ──

export async function parseCommand(filePath, options) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    console.error(chalk.red(`Error: File not found: ${resolved}`));
    process.exit(1);
  }

  const source = fs.readFileSync(resolved, 'utf-8');

  try {
    const ast = parseEngFile(source, resolved);

    if (options.validate) {
      const validator = new Validator();
      const result = validator.validate(ast);
      if (result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.error(chalk.yellow(`  Warning: ${w.message}${w.line ? ` (line ${w.line})` : ''}`));
        }
      }
      if (!result.valid) {
        for (const e of result.errors) {
          console.error(chalk.red(`  Error: ${e.message}${e.line ? ` (line ${e.line})` : ''}`));
        }
        process.exit(1);
      }
    }

    const output = JSON.stringify(ast, null, 2);

    if (options.output) {
      fs.writeFileSync(options.output, output, 'utf-8');
      console.log(chalk.green(`AST written to ${options.output}`));
    } else {
      console.log(output);
    }
  } catch (err) {
    console.error(chalk.red(`${err.name || 'Error'}: ${err.message}`));
    if (err.line) console.error(chalk.gray(`  at ${resolved}:${err.line}${err.column ? ':' + err.column : ''}`));
    process.exit(1);
  }
}

// ── lint command ──

export async function lintCommand(dirPath, options) {
  const resolved = path.resolve(dirPath || '.');
  const files = findEngFiles(resolved);

  if (files.length === 0) {
    console.log(chalk.yellow('No .eng files found.'));
    return;
  }

  console.log(chalk.blue(`Linting ${files.length} .eng file(s)...\n`));

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relative = path.relative(resolved, file);

    try {
      const ast = parseEngFile(source, file);
      const validator = new Validator();
      const result = validator.validate(ast);

      if (result.errors.length > 0 || result.warnings.length > 0) {
        console.log(chalk.underline(relative));

        for (const e of result.errors) {
          console.log(chalk.red(`  error: ${e.message}${e.line ? ` (line ${e.line})` : ''}`));
          totalErrors++;
        }
        for (const w of result.warnings) {
          console.log(chalk.yellow(`  warning: ${w.message}${w.line ? ` (line ${w.line})` : ''}`));
          totalWarnings++;
        }
        console.log();
      } else {
        if (options.verbose) {
          console.log(chalk.green(`  ${relative} — OK`));
        }
      }
    } catch (err) {
      console.log(chalk.underline(relative));
      console.log(chalk.red(`  ${err.name || 'Error'}: ${err.message}`));
      if (err.line) console.log(chalk.gray(`    at line ${err.line}`));
      console.log();
      totalErrors++;
    }
  }

  console.log(chalk.bold('─'.repeat(40)));
  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.green(`All ${files.length} file(s) passed.`));
  } else {
    if (totalErrors > 0) console.log(chalk.red(`${totalErrors} error(s)`));
    if (totalWarnings > 0) console.log(chalk.yellow(`${totalWarnings} warning(s)`));
  }

  if (totalErrors > 0) process.exit(1);
}

// ── Spinner helper ──

class Spinner {
  constructor() {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.current = 0;
    this.interval = null;
    this.text = '';
  }

  start(text) {
    this.text = text;
    this.current = 0;
    if (process.stdout.isTTY) {
      this.interval = setInterval(() => {
        const frame = this.frames[this.current % this.frames.length];
        process.stdout.write(`\r  ${chalk.cyan(frame)} ${this.text}`);
        this.current++;
      }, 80);
    } else {
      process.stdout.write(`  ... ${this.text}\n`);
    }
  }

  update(text) {
    this.text = text;
  }

  stop(finalLine) {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (process.stdout.isTTY) {
      process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
    }
    if (finalLine) console.log(finalLine);
  }
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── build command ──

export async function buildCommand(dirPath, options) {
  const resolved = path.resolve(dirPath || '.');
  const target = options.target || 'react';
  const dryRun = options.dryRun || false;

  // Validate target
  if (!TARGET_CONFIG[target]) {
    console.error(chalk.red(`Unsupported target: "${target}". Supported: ${Object.keys(TARGET_CONFIG).join(', ')}`));
    process.exit(1);
  }

  // Load project config
  const config = loadConfig(resolved);

  // Load .env file from project directory (walk up to find it)
  loadDotEnv(resolved);

  // Resolve model: --cli flag > CLI flag > config file > default
  const model = options.cli ? 'cli' : (options.model || config.compiler?.llm?.model || 'claude-sonnet-4-20250514');

  const stat = fs.statSync(resolved);
  const isFile = stat.isFile();
  const files = isFile ? [resolved] : findEngFiles(resolved);

  if (files.length === 0) {
    console.log(chalk.yellow('No .eng files found.'));
    return;
  }

  // ── Header ──
  console.log(chalk.blue.bold(`\n  .eng build`));
  console.log(chalk.gray(`  Target: ${chalk.white(target)}  |  Model: ${chalk.white(model)}  |  Files: ${chalk.white(files.length)}  |  Dry run: ${chalk.white(dryRun ? 'yes' : 'no')}`));
  console.log();

  const spinner = new Spinner();

  // ── Phase 1: Parse ──
  console.log(chalk.blue('  → Phase 1: Parsing .eng files...'));
  const astMap = new Map();
  const nameMap = new Map();
  let parseErrors = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf-8');
    const relative = path.relative(process.cwd(), file);
    try {
      const ast = parseEngFile(source, file);

      const validator = new Validator();
      const validation = validator.validate(ast);
      if (!validation.valid) {
        console.log(chalk.red(`    ✗ ${relative} — validation failed`));
        for (const e of validation.errors) {
          console.log(chalk.red(`      ${e.message}`));
        }
        parseErrors++;
        continue;
      }

      astMap.set(file, ast);

      const fm = ast.frontmatter;
      if (fm?.name) {
        const camelName = fm.name[0].toLowerCase() + fm.name.slice(1);
        nameMap.set(camelName, ast);
        nameMap.set(fm.name, ast);
      }

      for (const w of validation.warnings) {
        console.log(chalk.yellow(`    ⚠ ${relative}: ${w.message}`));
      }

      console.log(chalk.gray(`    ✓ ${relative}`));
    } catch (err) {
      console.log(chalk.red(`    ✗ ${relative} — ${err.name || 'Error'}: ${err.message}`));
      parseErrors++;
    }
  }

  if (astMap.size === 0) {
    console.log(chalk.red('\n  No files parsed successfully.'));
    process.exit(1);
  }

  console.log(chalk.green(`    ${astMap.size} file(s) parsed${parseErrors > 0 ? chalk.red(`, ${parseErrors} failed`) : ''}`));
  console.log();

  // ── Phase 2: Resolve dependencies ──
  console.log(chalk.blue('  → Phase 2: Resolving dependency order...'));
  const ordered = resolveBuildOrder(astMap);
  const typeLabel = { fragment: 'fragments', component: 'components', modal: 'modals', layout: 'layouts', page: 'pages' };
  const typeCounts = {};
  for (const { ast } of ordered) {
    const t = ast.frontmatter?.type || 'component';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const orderSummary = Object.entries(typeCounts).map(([t, n]) => `${n} ${typeLabel[t] || t}`).join(', ');
  console.log(chalk.gray(`    Build order: ${orderSummary}`));
  console.log();

  // ── Phase 3: Initialize compiler ──
  console.log(chalk.blue('  → Phase 3: Initializing compiler...'));
  let compiler;
  try {
    compiler = new Compiler({
      ...config,
      target,
      model,
      dryRun,
      outputDir: config.compiler?.output?.directory || './dist',
    });
    console.log(chalk.gray(`    Provider: ${compiler.modelLabel}`));
  } catch (err) {
    console.error(chalk.red(`    ${err.message}`));
    process.exit(1);
  }

  if (!dryRun && config.compiler?.output?.clean_before_build !== false) {
    compiler.cleanOutput();
    console.log(chalk.gray(`    Output cleaned: ${path.resolve(compiler.outputDir)}`));
  }
  console.log();

  // ── Phase 4: Compile ──
  console.log(chalk.blue(`  → Phase 4: Compiling to ${chalk.white(TARGET_CONFIG[target].name)}...`));
  let compiled = 0;
  let skipped = 0;
  let errors = 0;
  const compileTimes = [];

  for (let i = 0; i < ordered.length; i++) {
    const { file, ast } = ordered[i];
    const relative = path.relative(process.cwd(), file);
    const name = ast.frontmatter?.name || path.basename(file, '.eng');

    try {
      const context = buildContext(ast, astMap, nameMap, target);

      // Spinner with time estimate
      let spinnerText = `${chalk.white(relative)} → ${chalk.gray(model)}`;
      if (compileTimes.length > 0 && !dryRun) {
        const avgTime = compileTimes.reduce((a, b) => a + b, 0) / compileTimes.length;
        const remaining = avgTime * (ordered.length - i);
        spinnerText += chalk.dim(`  ~${formatDuration(remaining)} remaining`);
      }
      spinnerText += chalk.dim(`  [${i + 1}/${ordered.length}]`);

      const startTime = Date.now();
      if (!dryRun) spinner.start(spinnerText);

      const result = await compiler.compile(ast, context);

      const elapsed = Date.now() - startTime;
      if (!result.cached && !result.dryRun) compileTimes.push(elapsed);

      if (result.cached) {
        const outputPaths = result.files.map(f => f.path).join(', ');
        spinner.stop(chalk.gray(`    ⊙ ${relative} → ${outputPaths} ${chalk.dim('(cached)')}`));
        skipped++;
      } else if (result.dryRun) {
        const outputPaths = result.files.map(f => f.path).join(', ');
        console.log(chalk.cyan(`    ○ ${relative} → ${outputPaths} ${chalk.dim('(dry run)')}`));
      } else {
        const outputPaths = result.files.map(f => f.path).join(', ');
        const tokenInfo = result.usage ? chalk.dim(` (${formatDuration(elapsed)}, ${result.usage.input + result.usage.output} tokens)`) : '';
        spinner.stop(chalk.green(`    ✓ ${relative}`) + chalk.gray(` → ${outputPaths}`) + tokenInfo);
      }

      if (!dryRun) {
        compiler.writeFiles(result.files);
      }

      compiled++;
    } catch (err) {
      spinner.stop(chalk.red(`    ✗ ${relative} — ${err.message}`));
      errors++;
    }
  }

  // ── Phase 5: Summary ──
  const totalTime = compileTimes.reduce((a, b) => a + b, 0);
  console.log();
  console.log(chalk.bold(`  ${'─'.repeat(44)}`));
  console.log(chalk.bold(`  Build complete`) + (totalTime > 0 ? chalk.gray(` in ${formatDuration(totalTime)}`) : ''));
  console.log(chalk.gray(`  Compiled: ${chalk.green(compiled)}  Cached: ${chalk.gray(skipped)}  Errors: ${errors > 0 ? chalk.red(errors) : chalk.gray(0)}`));

  if (!dryRun && (compiler.totalInputTokens > 0 || compiler.totalOutputTokens > 0)) {
    const usage = compiler.getUsageSummary();
    console.log(chalk.gray(`  Tokens: ${chalk.white(usage.inputTokens.toLocaleString())} in / ${chalk.white(usage.outputTokens.toLocaleString())} out`));
    console.log(chalk.gray(`  Estimated cost: ${chalk.white(usage.estimatedCost)}`));
  }

  if (!dryRun) {
    console.log(chalk.gray(`  Output: ${chalk.white(path.resolve(compiler.outputDir))}`));
  }
  console.log();

  if (errors > 0) process.exit(1);

  // ── Post-process: Fix React imports ──
  if (!dryRun && target === 'react') {
    fixReactImports(path.resolve(compiler.outputDir));
  }

  // ── Phase 6: Serve (optional) ──
  const serve = options.serve || false;
  if (serve && !dryRun) {
    const outputDir = path.resolve(compiler.outputDir);

    // Collect route info from page ASTs for React scaffolding
    const routes = [];
    for (const { ast } of ordered) {
      const fm = ast.frontmatter;
      if (fm?.type === 'page' && fm?.route) {
        routes.push({ route: fm.route, name: fm.name });
      }
    }

    if (target === 'html') {
      await serveHtml(outputDir);
    } else if (target === 'react') {
      await serveReact(outputDir, routes, config);
    } else if (target === 'laravel-blade') {
      await serveLaravel(outputDir, routes, config);
    }
  }
}

// ── Fix React imports ──

function fixReactImports(outputDir) {
  // 1. Walk the output dir and build a map: ComponentName → relative path from outputDir
  const componentMap = new Map(); // e.g. "Navbar" → "Navbar.jsx", "Footer" → "partials/Footer.jsx"

  function walk(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith('.jsx')) {
        const name = entry.name.replace('.jsx', '');
        componentMap.set(name, rel);
      }
    }
  }
  walk(outputDir);

  // 2. For each .jsx file, find import statements and rewrite paths
  const importRegex = /^(import\s+\w+\s+from\s+['"])([^'"]+)(['"];?\s*)$/gm;

  for (const [, relPath] of componentMap) {
    const filePath = path.join(outputDir, relPath);
    let content = fs.readFileSync(filePath, 'utf-8');
    let changed = false;

    content = content.replace(importRegex, (match, before, importPath, after) => {
      // Skip external packages (react, react-router-dom, lucide-react, etc.)
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) return match;

      // Extract the component name from the import path
      const importedName = path.basename(importPath);

      // Check if this component exists in our map
      if (componentMap.has(importedName)) {
        const targetRelPath = componentMap.get(importedName);
        const fromDir = path.dirname(relPath);

        // Calculate correct relative path
        let newImportPath = path.relative(fromDir, targetRelPath).replace(/\\/g, '/').replace('.jsx', '');

        // Ensure it starts with ./ or ../
        if (!newImportPath.startsWith('.')) {
          newImportPath = './' + newImportPath;
        }

        if (importPath !== newImportPath) {
          changed = true;
          return `${before}${newImportPath}${after}`;
        }
      }

      return match;
    });

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }
}

// ── Serve: HTML ──

async function serveHtml(outputDir) {
  console.log(chalk.blue('\n  → Starting static file server...\n'));

  // Collect HTML files for display
  const htmlFiles = fs.readdirSync(outputDir).filter(f => f.endsWith('.html'));
  const port = 3000;

  try {
    // Check if npx is available
    execSync('npx --version', { stdio: 'ignore' });
  } catch {
    console.log(chalk.yellow(`  npx not found. Open manually:`));
    for (const f of htmlFiles) {
      console.log(chalk.gray(`    file://${path.join(outputDir, f)}`));
    }
    return;
  }

  console.log(chalk.green(`  Serving on http://localhost:${port}`));
  console.log(chalk.gray(`  Files:`));
  for (const f of htmlFiles) {
    const label = f.replace('.html', '');
    console.log(chalk.gray(`    http://localhost:${port}/${f === 'home.html' ? '' : f}`));
  }
  console.log(chalk.gray(`\n  Press Ctrl+C to stop.\n`));

  const child = spawn('npx', ['serve', outputDir, '-l', String(port), '--no-clipboard'], {
    stdio: 'inherit',
    shell: true,
  });

  // Forward SIGINT to clean up
  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });

  await new Promise((resolve) => {
    child.on('exit', resolve);
  });
}

// ── Serve: React (Vite) ──

async function serveReact(outputDir, routes, config) {
  console.log(chalk.blue('\n  → Phase 6: Scaffolding React app...\n'));

  const spinner = new Spinner();

  // Collect all generated .jsx files recursively
  const jsxFiles = [];
  function walkJsx(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walkJsx(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith('.jsx')) {
        jsxFiles.push(rel);
      }
    }
  }
  walkJsx(outputDir);

  // Figure out component names from file paths
  const componentImports = [];
  const routeEntries = [];

  for (const route of routes) {
    // Find the matching jsx file
    const match = jsxFiles.find(f => {
      const basename = path.basename(f, '.jsx');
      return basename === route.name || basename === route.name.replace(/Page$/, '');
    });
    if (match) {
      const importPath = './' + match.replace(/\\/g, '/').replace('.jsx', '');
      componentImports.push(`import ${route.name} from '${importPath}';`);
      routeEntries.push(`        <Route path="${route.route}" element={<${route.name} />} />`);
    }
  }

  // Find a "home" route for the index redirect
  const homeRoute = routes.find(r => r.route === '/');
  const fallbackRoute = homeRoute
    ? `        <Route path="*" element={<Navigate to="/" replace />} />`
    : `        <Route path="*" element={<div className="p-8 text-center">Page not found</div>} />`;

  // Generate App.jsx
  const appJsx = `import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
${componentImports.join('\n')}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
${routeEntries.join('\n')}
${fallbackRoute}
      </Routes>
    </BrowserRouter>
  );
}
`;
  fs.writeFileSync(path.join(outputDir, 'App.jsx'), appJsx);

  // Generate main.jsx
  const mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;
  fs.writeFileSync(path.join(outputDir, 'main.jsx'), mainJsx);

  // Generate index.css (Tailwind)
  const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  margin: 0;
}
`;
  fs.writeFileSync(path.join(outputDir, 'index.css'), indexCss);

  // Generate index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${config.project?.name || 'eng app'}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./main.jsx"></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);

  // Generate package.json
  const pkgJson = {
    name: (config.project?.name || 'eng-app').toLowerCase().replace(/\s+/g, '-'),
    private: true,
    version: '0.0.1',
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
    },
    dependencies: {
      'react': '^18.3.0',
      'react-dom': '^18.3.0',
      'react-router-dom': '^6.23.0',
      'lucide-react': '^0.400.0',
    },
    devDependencies: {
      '@vitejs/plugin-react': '^4.3.0',
      'vite': '^5.4.0',
      'tailwindcss': '^3.4.0',
      'postcss': '^8.4.0',
      'autoprefixer': '^10.4.0',
      '@tailwindcss/forms': '^0.5.0',
    },
  };
  fs.writeFileSync(path.join(outputDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // Generate vite.config.js
  const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`;
  fs.writeFileSync(path.join(outputDir, 'vite.config.js'), viteConfig);

  // Generate tailwind.config.js
  const themeColors = config.theming || {};
  const twConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./*.{html,jsx}', './*/**/*.{html,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '${themeColors.primary || '#4F46E5'}',
        secondary: '${themeColors.secondary || '#7C3AED'}',
      },
      fontFamily: {
        heading: ['${themeColors.font_heading || 'Inter'}', 'sans-serif'],
        body: ['${themeColors.font_body || 'Inter'}', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
`;
  fs.writeFileSync(path.join(outputDir, 'tailwind.config.js'), twConfig);

  // Generate postcss.config.js
  const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  fs.writeFileSync(path.join(outputDir, 'postcss.config.js'), postcssConfig);

  console.log(chalk.green('    Generated: App.jsx, main.jsx, index.html, package.json, vite.config.js'));

  // Install dependencies
  console.log(chalk.blue('\n  → Installing dependencies...\n'));
  spinner.start('Running npm install...');
  try {
    execSync('npm install', { cwd: outputDir, stdio: 'pipe', timeout: 120000 });
    spinner.stop(chalk.green('    Dependencies installed'));
  } catch (err) {
    spinner.stop(chalk.red(`    npm install failed: ${err.message}`));
    console.log(chalk.yellow(`    Try manually: cd ${outputDir} && npm install && npm run dev`));
    return;
  }

  // Start dev server
  const port = 5173;
  console.log(chalk.blue('\n  → Starting dev server...\n'));
  console.log(chalk.green(`  App running at http://localhost:${port}`));

  // Show routes
  for (const route of routes) {
    console.log(chalk.gray(`    http://localhost:${port}${route.route}`));
  }
  console.log(chalk.gray(`\n  Press Ctrl+C to stop.\n`));

  const child = spawn('npx', ['vite', '--port', String(port)], {
    cwd: outputDir,
    stdio: 'inherit',
    shell: true,
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });

  await new Promise((resolve) => {
    child.on('exit', resolve);
  });
}

// ── Serve: Laravel Blade ──

async function serveLaravel(outputDir, routes, config) {
  console.log(chalk.blue('\n  → Phase 6: Setting up Laravel project...\n'));

  const spinner = new Spinner();

  // Check php
  try {
    execSync('php --version', { stdio: 'pipe' });
  } catch {
    console.log(chalk.red('  php not found on PATH. Install PHP 8.1+ to use --serve with laravel-blade.'));
    console.log(chalk.gray(`  Generated files are in ${outputDir}`));
    return;
  }

  // Check composer
  try {
    execSync('composer --version', { stdio: 'pipe' });
  } catch {
    console.log(chalk.red('  composer not found on PATH. Install Composer to use --serve with laravel-blade.'));
    console.log(chalk.gray(`  Generated files are in ${outputDir}`));
    return;
  }

  console.log(chalk.gray('    php ✓  composer ✓'));

  // Scaffold Laravel project if not already present
  const artisanPath = path.join(outputDir, 'artisan');
  if (!fs.existsSync(artisanPath)) {
    spinner.start('Creating Laravel project (composer create-project)...');

    const scaffoldDir = path.join(path.dirname(outputDir), '.laravel-scaffold');

    try {
      // Clean up any leftover scaffold dir
      if (fs.existsSync(scaffoldDir)) {
        fs.rmSync(scaffoldDir, { recursive: true, force: true });
      }

      execSync(
        `composer create-project laravel/laravel "${scaffoldDir}" --no-interaction --prefer-dist`,
        { stdio: 'pipe', timeout: 180000 }
      );

      // Merge scaffold into output dir (don't overwrite LLM-generated files)
      mergeScaffoldInto(scaffoldDir, outputDir);

      // Clean up scaffold temp dir
      fs.rmSync(scaffoldDir, { recursive: true, force: true });

      spinner.stop(chalk.green('    Laravel project created'));
    } catch (err) {
      spinner.stop(chalk.red(`    composer create-project failed: ${err.message}`));
      console.log(chalk.yellow(`    Try manually: cd ${outputDir}`));
      return;
    }
  } else {
    console.log(chalk.gray('    Laravel project already exists, skipping scaffold'));
  }

  // Patch layout files to use CDN instead of @vite()
  patchBladeLayoutForCdn(outputDir);
  console.log(chalk.gray('    Patched layouts: Tailwind CDN + Alpine.js CDN'));

  // Generate complete routes/web.php
  generateLaravelRoutes(outputDir, routes);
  console.log(chalk.gray('    Generated: routes/web.php'));

  // Generate .env if it doesn't exist (artisan serve needs it)
  const laravelEnvPath = path.join(outputDir, '.env');
  if (!fs.existsSync(laravelEnvPath)) {
    const envExamplePath = path.join(outputDir, '.env.example');
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, laravelEnvPath);
    }
  }

  // Generate app key if needed
  try {
    const envContent = fs.readFileSync(path.join(outputDir, '.env'), 'utf-8');
    if (envContent.includes('APP_KEY=\n') || envContent.includes('APP_KEY=')) {
      execSync('php artisan key:generate --no-interaction', { cwd: outputDir, stdio: 'pipe' });
      console.log(chalk.gray('    Generated: APP_KEY'));
    }
  } catch { /* key already set or not needed */ }

  // Start artisan serve
  const port = 8000;
  console.log(chalk.blue('\n  → Starting Laravel dev server...\n'));
  console.log(chalk.green(`  App running at http://localhost:${port}`));

  for (const route of routes) {
    console.log(chalk.gray(`    http://localhost:${port}${route.route}`));
  }
  console.log(chalk.gray(`\n  Press Ctrl+C to stop.\n`));

  const child = spawn('php', ['artisan', 'serve', `--port=${port}`], {
    cwd: outputDir,
    stdio: 'inherit',
    shell: true,
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    process.exit(0);
  });

  await new Promise((resolve) => {
    child.on('exit', resolve);
  });
}

/**
 * Recursively copy files from scaffoldDir into targetDir.
 * Does NOT overwrite files that already exist in targetDir.
 */
function mergeScaffoldInto(scaffoldDir, targetDir) {
  const entries = fs.readdirSync(scaffoldDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(scaffoldDir, entry.name);
    const destPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        // Directory doesn't exist in target — copy the whole thing
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        // Directory exists — recurse to merge contents
        mergeScaffoldInto(srcPath, destPath);
      }
    } else {
      // File — only copy if it doesn't exist in target
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

/**
 * Patch Blade layout files to use Tailwind CDN + Alpine.js CDN instead of @vite().
 */
function patchBladeLayoutForCdn(outputDir) {
  const layoutsDir = path.join(outputDir, 'resources', 'views', 'layouts');
  if (!fs.existsSync(layoutsDir)) return;

  for (const file of fs.readdirSync(layoutsDir)) {
    if (!file.endsWith('.blade.php')) continue;

    const layoutPath = path.join(layoutsDir, file);
    let content = fs.readFileSync(layoutPath, 'utf-8');

    // Replace @vite() directive with CDN links
    content = content.replace(
      /@vite\(\[.*?\]\)/s,
      `<script src="https://cdn.tailwindcss.com"></script>\n    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>`
    );

    // If no @vite was found, check if CDN is already there; if not, add before </head>
    if (!content.includes('cdn.tailwindcss.com')) {
      content = content.replace(
        '</head>',
        `    <script src="https://cdn.tailwindcss.com"></script>\n    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/cdn.min.js"></script>\n</head>`
      );
    }

    // Add CSRF meta tag if not present
    if (!content.includes('csrf-token')) {
      content = content.replace(
        '</head>',
        `    <meta name="csrf-token" content="{{ csrf_token() }}">\n</head>`
      );
    }

    fs.writeFileSync(layoutPath, content, 'utf-8');
  }
}

/**
 * Generate a complete routes/web.php from the routes array and discovered controllers.
 */
function generateLaravelRoutes(outputDir, routes) {
  // Discover generated controllers
  const controllersDir = path.join(outputDir, 'app', 'Http', 'Controllers');
  const controllerFiles = new Set();

  if (fs.existsSync(controllersDir)) {
    for (const f of fs.readdirSync(controllersDir)) {
      if (f.endsWith('Controller.php') && f !== 'Controller.php') {
        controllerFiles.add(f.replace('.php', ''));
      }
    }
  }

  let routeContent = `<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n`;

  // Add use statements for controllers
  for (const controller of controllerFiles) {
    routeContent += `use App\\Http\\Controllers\\${controller};\n`;
  }

  routeContent += '\n';

  for (const route of routes) {
    const pageName = route.name.replace(/Page$/i, '');
    const controllerName = pageName + 'Controller';

    if (controllerFiles.has(controllerName)) {
      routeContent += `Route::get('${route.route}', [${controllerName}::class, 'index'])->name('${pageName.toLowerCase()}');\n`;
    } else {
      // Find the blade view
      const viewName = findBladeViewName(outputDir, route.name);
      routeContent += `Route::get('${route.route}', function () {\n    return view('${viewName}');\n})->name('${pageName.toLowerCase()}');\n`;
    }
  }

  // Ensure routes directory exists
  const routesDir = path.join(outputDir, 'routes');
  fs.mkdirSync(routesDir, { recursive: true });
  fs.writeFileSync(path.join(routesDir, 'web.php'), routeContent, 'utf-8');
}

/**
 * Find the Blade view dot-notation path for a given page name.
 * Searches resources/views/ for matching .blade.php files.
 */
function findBladeViewName(outputDir, pageName) {
  const viewsDir = path.join(outputDir, 'resources', 'views');
  if (!fs.existsSync(viewsDir)) return 'welcome';

  // Convert PascalCase to kebab-case for file matching
  const kebabName = pageName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const simpleName = pageName.replace(/Page$/i, '').toLowerCase();

  // Search in pages/ first, then root views
  const searchPaths = [
    { dir: path.join(viewsDir, 'pages'), prefix: 'pages.' },
    { dir: viewsDir, prefix: '' },
  ];

  for (const { dir, prefix } of searchPaths) {
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.blade.php')) continue;
      const baseName = file.replace('.blade.php', '');

      if (baseName === simpleName || baseName === kebabName || baseName === pageName.toLowerCase()) {
        return prefix + baseName;
      }
    }
  }

  return 'welcome';
}

// ── init command ──

export async function initCommand(name, options) {
  const projectDir = path.resolve('projects', name);

  if (fs.existsSync(projectDir)) {
    console.error(chalk.red(`Error: Directory "projects/${name}" already exists.`));
    process.exit(1);
  }

  console.log(chalk.blue(`Creating new .eng project: projects/${name}\n`));

  fs.mkdirSync(projectDir, { recursive: true });

  // eng.config.yaml
  const config = `# eng.config.yaml
project:
  name: "${name}"
  version: "1.0.0"

compiler:
  target: "react"
  llm:
    model: "claude-sonnet-4-20250514"
    api_key_env: "ANTHROPIC_API_KEY"
  output:
    directory: "./dist"
    clean_before_build: true
  css:
    framework: "tailwind"
    version: "3"

theming:
  primary: "#3B82F6"
  secondary: "#6366F1"
  success: "#10B981"
  warning: "#F59E0B"
  danger: "#EF4444"
  info: "#06B6D4"
`;
  fs.writeFileSync(path.join(projectDir, 'eng.config.yaml'), config);

  // Example .eng file
  const hello = `---
type: component
name: HelloWorld
description: "A simple welcome card"
props:
  - name: title
    type: string
    default: "Hello from .eng"
  - name: message
    type: string
    default: "Write English. Get code."
---

Create a centered card with padding large, rounded corners, subtle shadow:
  Show {title} as a heading, font size 2rem
  Show {message} as paragraph text, muted color
  Create a button "Get Started" style primary:
    On click: Navigate to "/docs"
`;
  fs.writeFileSync(path.join(projectDir, 'hello.eng'), hello);

  // .env.example
  const envExample = `# API keys for .eng compiler
# Copy this file to .env and fill in your key.
# Which key is needed depends on your --model flag.

ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
`;
  fs.writeFileSync(path.join(projectDir, '.env.example'), envExample);

  // .gitignore
  const gitignore = `dist/
.eng-cache/
.env
`;
  fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignore);

  console.log(chalk.green('  Created:'));
  console.log(chalk.gray(`    projects/${name}/`));
  console.log(chalk.gray(`    ├── eng.config.yaml`));
  console.log(chalk.gray(`    ├── .env.example`));
  console.log(chalk.gray(`    ├── .gitignore`));
  console.log(chalk.gray(`    └── hello.eng`));
  console.log();
  console.log(chalk.green(`  Done!`));
  console.log(chalk.gray(`  cd projects/${name}`));
  console.log(chalk.gray(`  cp .env.example .env     # add your API key`));
  console.log(chalk.gray(`  eng build . --target=react`));
}

// ═══════════════════════════════════════
// ── Helpers
// ═══════════════════════════════════════

function findEngFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', '.eng-cache'].includes(entry.name)) continue;
      results.push(...findEngFiles(fullPath));
    } else if (entry.name.endsWith('.eng')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Load eng.config.yaml from the project directory (walk up from resolved path).
 */
function loadConfig(startPath) {
  let dir = fs.statSync(startPath).isFile() ? path.dirname(startPath) : startPath;

  for (let i = 0; i < 10; i++) {
    const configPath = path.join(dir, 'eng.config.yaml');
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        return parseYaml(raw) || {};
      } catch {
        return {};
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return {};
}

/**
 * Load .env file from project directory (walk up from startPath to find it).
 * Parses KEY=VALUE lines and sets them on process.env (does not override existing vars).
 */
function loadDotEnv(startPath) {
  let dir = fs.statSync(startPath).isFile() ? path.dirname(startPath) : startPath;

  for (let i = 0; i < 10; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        // Don't override existing env vars
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

/**
 * Sort files in dependency order: components/fragments first, layouts next, pages last.
 * Within the same tier, files with fewer imports come first.
 */
function resolveBuildOrder(astMap) {
  const typeOrder = { fragment: 0, component: 1, modal: 2, layout: 3, page: 4 };
  const entries = [];

  for (const [file, ast] of astMap) {
    const type = ast.frontmatter?.type || 'component';
    const order = typeOrder[type] ?? 2;
    const importCount = ast.imports?.length || 0;
    entries.push({ file, ast, order, importCount });
  }

  entries.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.importCount - b.importCount;
  });

  return entries;
}

/**
 * Build context for a file: resolve its layout and imported component ASTs.
 */
function buildContext(ast, astMap, nameMap, target) {
  const context = {};

  // For HTML target, build a route-to-file map so the LLM generates correct links
  if (target === 'html') {
    const routeMap = {};
    for (const [, otherAst] of astMap) {
      const fm = otherAst.frontmatter;
      if (fm?.route && fm?.name) {
        // Convert route to filename: "/" → "home.html", "/about" → "about.html"
        const route = fm.route;
        const pageName = fm.name.replace(/Page$/i, '').toLowerCase();
        const fileName = route === '/' ? 'home.html' : pageName + '.html';
        routeMap[route] = fileName;
      }
    }
    if (Object.keys(routeMap).length > 0) {
      context.routeMap = routeMap;
    }
  }

  // Resolve layout if this is a page that extends one
  if (ast.frontmatter?.extends) {
    const layoutPath = ast.frontmatter.extends;
    // Try to find the layout AST in our parsed files
    for (const [file, layoutAst] of astMap) {
      if (file.includes(layoutPath.replace(/\//g, path.sep)) ||
          file.endsWith(layoutPath.replace(/\//g, path.sep))) {
        context.layoutAst = layoutAst;
        break;
      }
    }
    // Try by name
    if (!context.layoutAst) {
      const layoutName = path.basename(layoutPath, '.eng');
      const pascalName = layoutName[0].toUpperCase() + layoutName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      context.layoutAst = nameMap.get(pascalName) || nameMap.get(layoutName);
    }
  }

  // Resolve imported component ASTs
  if (ast.imports && ast.imports.length > 0) {
    const importedAsts = [];
    for (const imp of ast.imports) {
      const name = imp.alias || imp.name;
      const resolved = nameMap.get(name);
      if (resolved) {
        const clone = { ...resolved, _importName: name };
        importedAsts.push(clone);
      } else {
        // Try finding by path
        for (const [file, impAst] of astMap) {
          if (file.includes(imp.path.replace(/\//g, path.sep))) {
            importedAsts.push({ ...impAst, _importName: name });
            break;
          }
        }
      }
    }
    if (importedAsts.length > 0) {
      context.importedAsts = importedAsts;
    }
  }

  return context;
}
