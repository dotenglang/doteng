# eng-lang

**English as a Programming Language**

Write UI components in structured English. Compile to React, Laravel Blade, or HTML with a single command. The same `.eng` file produces production-ready code for any framework — powered by LLM-based code generation.

---

## What does it look like?

Write this `.eng` file:

```eng
---
type: component
name: FeatureCard
props:
  - name: icon
    type: string
    required: true
  - name: title
    type: string
    required: true
  - name: description
    type: string
    required: true
---

Create a card container, padding large, rounded corners, border thin light gray, background white:
  Style this with hover shadow medium, transition all 200ms
  Create an icon circle, background light primary, width 48px, height 48px, rounded circle, centered, margin bottom medium:
    Icon {icon} size 24px, color primary
  Show {title} as a heading, font size 1.25rem, font bold, margin bottom small
  Show {description} as paragraph text, color muted, line height relaxed
```

Compile to **React** (`eng build . --target=react`):

```jsx
import React from 'react';
import { LayoutDashboard, Clock, BarChart2, Star } from 'lucide-react';

const iconMap = {
  'layout-dashboard': LayoutDashboard,
  'clock': Clock,
  'bar-chart-2': BarChart2,
};

export default function FeatureCard({ icon, title, description }) {
  const IconComponent = iconMap[icon] || Star;

  return (
    <div className="p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 mb-4">
        <IconComponent size={24} className="text-indigo-600" />
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
```

Same file compiled to **Laravel Blade** (`eng build . --target=laravel-blade`):

```blade
<article class="p-6 rounded-lg border border-gray-200 bg-white hover:shadow-md transition-all duration-200">
    <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        @switch($icon)
            @case('layout-dashboard')
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                @break
            @case('clock')
                <svg class="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                @break
        @endswitch
    </div>
    <h3 class="text-xl font-bold mb-2">{{ $title }}</h3>
    <p class="text-gray-500 leading-relaxed">{{ $description }}</p>
</article>
```

One source file. Multiple frameworks. Real, production-ready output.

---

## Quick Start

```bash
# Install globally
npm install -g eng-lang

# Create a new project
eng init my-app
cd projects/my-app

# Add your API key (or use --cli for free with Claude Code Max plan)
cp .env.example .env

# Build and preview
eng build . --target=react --serve
eng build . --target=html --serve
eng build . --target=laravel-blade --serve
```

### Free builds with Claude Code CLI

If you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed with a Max subscription, use `--cli` to compile without API costs:

```bash
eng build . --target=react --cli --serve
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `eng init <name>` | Scaffold a new `.eng` project |
| `eng parse <file>` | Parse a `.eng` file and output the JSON AST |
| `eng lint [dir]` | Validate all `.eng` files in a directory |
| `eng build [dir]` | Compile `.eng` files to target framework |

### Build Flags

| Flag | Description |
|------|-------------|
| `--target=<target>` | Compilation target: `react`, `html`, `laravel-blade` |
| `--model=<model>` | LLM model to use (e.g., `claude-sonnet-4-20250514`, `gpt-4o`) |
| `--cli` | Use local Claude Code CLI instead of API (free for Max plan) |
| `--serve` | Start a dev server after building |
| `--dry-run` | Show what would be generated without calling the API |

---

## Supported Targets

| Target | Output | Dev Server |
|--------|--------|------------|
| `html` | Static HTML + Tailwind CDN + vanilla JS | `npx serve` |
| `react` | React components (JSX) + Tailwind + Vite | `vite dev` |
| `laravel-blade` | Blade templates + routes + controllers | `php artisan serve` |

Vue, Svelte, Next.js, Angular, and more targets are planned. See the [Language Spec](LANGUAGE_SPEC.md) for the full target mapping table.

---

## Supported LLM Providers

| Provider | Models | Env Variable |
|----------|--------|-------------|
| Anthropic | `claude-sonnet-4-20250514`, `claude-opus-4-6`, etc. | `ANTHROPIC_API_KEY` |
| OpenAI | `gpt-4o`, `gpt-codex-5-3`, `o1-*`, etc. | `OPENAI_API_KEY` |
| Google | `gemini-2.5-pro`, etc. | `GOOGLE_API_KEY` |
| OpenAI-Compatible | `deepseek-*`, `mistral-*`, etc. | `OPENAI_COMPAT_API_KEY` |
| Claude Code CLI | Uses your subscription | No key needed |

---

## How It Works

```
  .eng files          Parser            LLM Compiler         Output
 ┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────┐
 │  Write    │    │  Lexer →     │    │  AST + target │    │  React   │
 │  English  │ →  │  Parser →    │ →  │  + theme →    │ →  │  Blade   │
 │  code     │    │  Validator   │    │  LLM API call │    │  HTML    │
 └──────────┘    └──────────────┘    └───────────────┘    └──────────┘
                  Deterministic        Claude / GPT /       Ready to
                  JSON AST             Gemini / CLI         run code
```

1. **Parse** — The lexer tokenizes `.eng` files, the parser builds a deterministic JSON AST. Same file always produces the same AST.
2. **Compile** — The AST + target framework + theme config are sent to an LLM with framework-specific instructions. The LLM generates real code.
3. **Output** — Generated files are written to `dist/<target>/`. With `--serve`, a dev server starts automatically.

Compilation results are cached in `.eng-cache/` — unchanged files skip the API call on subsequent builds.

---

## Language Syntax

See [LANGUAGE_SPEC.md](LANGUAGE_SPEC.md) for the complete grammar specification, including:

- Frontmatter schema (type, name, props, route, extends, auth)
- All 40+ keywords (Create, Show, Loop, If, Set, Bind, Fetch, On, Navigate, etc.)
- Variables, conditions, and natural language operators
- Components, layouts, slots, and imports
- Forms, validation, events, and state management
- Styling directives and responsive design
- Animations and transitions

---

## Project Structure

```
my-app/
├── eng.config.yaml      # Project config (target, theme, API settings)
├── .env                  # API keys
├── hello.eng             # Your .eng files (organize however you want)
└── dist/                 # Compiled output
    ├── html/
    ├── react/
    └── laravel-blade/
```

No forced directory structure — put `.eng` files wherever you want. The frontmatter `type` field (component, page, layout) tells the compiler what each file is.

---

## VS Code Extension

Syntax highlighting for `.eng` files is available in the `eng-vscode/` directory. Install it locally:

```bash
cp -r eng-vscode ~/.vscode/extensions/eng-language
```

Then reload VS Code. Provides keyword highlighting, variable coloring, comment toggling, and frontmatter support.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/vue-target`)
3. Make your changes
4. Run the tests (`npm test`)
5. Submit a pull request

Areas that need help:
- Additional compilation targets (Vue, Svelte, Next.js, Angular)
- Parser improvements (better error messages, edge case handling)
- VS Code extension enhancements (autocomplete, diagnostics)
- Documentation and examples

---

## License

MIT
