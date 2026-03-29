/**
 * Provider abstraction — resolves a model string like "claude-sonnet-4-20250514"
 * or "gpt-codex-5-3" to the correct SDK, API key env var, and call convention.
 *
 * Adding a new provider:
 *   1. Add an entry to PROVIDERS with a `match` regex for its model names.
 *   2. Implement `createClient(apiKey)` and `call(client, { model, system, user, maxTokens })`.
 *   3. `call` must return { text: string, usage: { input: number, output: number } }.
 */

// ── Provider definitions ──

const PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    // Matches: claude-*, claude-sonnet-*, claude-opus-*, claude-haiku-*, etc.
    match: /^claude-/i,
    envKey: 'ANTHROPIC_API_KEY',
    async createClient(apiKey) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      return new Anthropic({ apiKey });
    },
    async call(client, { model, system, user, maxTokens }) {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      });
      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('');
      return {
        text,
        usage: {
          input: response.usage?.input_tokens || 0,
          output: response.usage?.output_tokens || 0,
        },
      };
    },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    // Matches: gpt-*, o1-*, o3-*, o4-*, chatgpt-*, codex-*, etc.
    match: /^(gpt-|o[134]-|chatgpt-|codex-)/i,
    envKey: 'OPENAI_API_KEY',
    async createClient(apiKey) {
      const { default: OpenAI } = await import('openai');
      return new OpenAI({ apiKey });
    },
    async call(client, { model, system, user, maxTokens }) {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const text = response.choices?.[0]?.message?.content || '';
      return {
        text,
        usage: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
        },
      };
    },
  },
  {
    id: 'google',
    name: 'Google Gemini',
    // Matches: gemini-*, gemini-2.5-*, etc.
    match: /^gemini-/i,
    envKey: 'GOOGLE_API_KEY',
    async createClient(apiKey) {
      // Uses OpenAI-compatible endpoint that Gemini supports
      const { default: OpenAI } = await import('openai');
      return new OpenAI({
        apiKey,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    },
    async call(client, { model, system, user, maxTokens }) {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const text = response.choices?.[0]?.message?.content || '';
      return {
        text,
        usage: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
        },
      };
    },
  },
  {
    id: 'openai-compat',
    name: 'OpenAI-Compatible',
    // Catch-all for custom base URLs — matches anything when OPENAI_COMPAT_BASE_URL is set,
    // or models starting with known providers that use OpenAI-compatible APIs.
    // Matches: mistral-*, deepseek-*, groq-*, llama-*, together-*, etc.
    match: /^(mistral-|deepseek-|groq-|llama-|together-|qwen-)/i,
    envKey: 'OPENAI_COMPAT_API_KEY',
    async createClient(apiKey) {
      const { default: OpenAI } = await import('openai');
      const baseURL = process.env.OPENAI_COMPAT_BASE_URL;
      if (!baseURL) {
        throw new Error(
          'Set OPENAI_COMPAT_BASE_URL for OpenAI-compatible providers.\n' +
          '  Example: export OPENAI_COMPAT_BASE_URL=https://api.together.xyz/v1'
        );
      }
      return new OpenAI({ apiKey, baseURL });
    },
    async call(client, { model, system, user, maxTokens }) {
      const response = await client.chat.completions.create({
        model,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });
      const text = response.choices?.[0]?.message?.content || '';
      return {
        text,
        usage: {
          input: response.usage?.prompt_tokens || 0,
          output: response.usage?.completion_tokens || 0,
        },
      };
    },
  },
  {
    id: 'claude-cli',
    name: 'Claude Code CLI',
    match: /^cli$/i,
    envKey: '_CLI_NO_KEY_NEEDED',
    async createClient() {
      // Verify claude CLI is available
      const { execSync } = await import('child_process');
      try {
        execSync('claude --version', { stdio: 'pipe' });
      } catch {
        throw new Error(
          'Claude Code CLI not found on PATH.\n' +
          '  Install it from: https://docs.anthropic.com/en/docs/claude-code'
        );
      }
      return null; // no SDK client needed
    },
    async call(client, { model, system, user, maxTokens }) {
      const { spawn } = await import('child_process');

      // Combine system + user into a single prompt
      const prompt = `${system}\n\n---\n\n${user}`;

      // Strip ANTHROPIC_API_KEY from env so CLI uses Max subscription auth, not API key
      const cliEnv = { ...process.env };
      delete cliEnv.ANTHROPIC_API_KEY;

      return new Promise((resolve, reject) => {
        const child = spawn('claude', ['-p', '--output-format', 'text'], {
          env: cliEnv,
          shell: true,
          stdio: ['pipe', 'pipe', 'inherit'],  // stderr goes to terminal for live progress
        });

        let stdout = '';
        child.stdout.on('data', d => { stdout += d; });

        child.on('close', code => {
          if (code !== 0) reject(new Error(`CLI exited with code ${code}`));
          else resolve({ text: stdout, usage: { input: 0, output: 0 } });
        });

        child.on('error', err => reject(new Error(`Failed to start claude CLI: ${err.message}`)));

        // Write prompt to stdin and close
        child.stdin.write(prompt);
        child.stdin.end();

        // Timeout after 3 minutes
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('CLI timeout — no response after 180 seconds'));
        }, 180000);

        child.on('close', () => clearTimeout(timer));
      });
    },
  },
];

// ── Public API ──

/**
 * Resolve a model string to its provider definition.
 * Returns the provider object or throws if no match.
 */
export function resolveProvider(model) {
  for (const provider of PROVIDERS) {
    if (provider.match.test(model)) {
      return provider;
    }
  }

  // If nothing matched, check if OPENAI_COMPAT_BASE_URL is set — use openai-compat as fallback
  if (process.env.OPENAI_COMPAT_BASE_URL) {
    return PROVIDERS.find(p => p.id === 'openai-compat');
  }

  throw new Error(
    `Unknown model "${model}". Cannot determine provider.\n` +
    `  Known prefixes: claude-* (Anthropic), gpt-*/o1-*/o3-*/o4-* (OpenAI), gemini-* (Google),\n` +
    `                  mistral-*/deepseek-*/groq-*/llama-* (OpenAI-compatible)\n` +
    `  For custom providers, set OPENAI_COMPAT_BASE_URL and OPENAI_COMPAT_API_KEY.`
  );
}

/**
 * Create a ready-to-use provider instance: { provider, client, call(system, user) }.
 */
export async function createProviderClient(model) {
  const provider = resolveProvider(model);

  // CLI provider doesn't need an API key
  let apiKey = null;
  if (provider.id !== 'claude-cli') {
    apiKey = process.env[provider.envKey];
    if (!apiKey) {
      throw new Error(
        `Missing API key for ${provider.name}.\n` +
        `  Set ${provider.envKey} in your .env file, or:\n` +
        `  export ${provider.envKey}=your-api-key`
      );
    }
  }

  const client = await provider.createClient(apiKey);

  return {
    provider,
    client,
    async call({ system, user, maxTokens = 8192 }) {
      return provider.call(client, { model, system, user, maxTokens });
    },
  };
}

/**
 * List all supported providers for display.
 */
export function listProviders() {
  return PROVIDERS.map(p => ({
    id: p.id,
    name: p.name,
    envKey: p.envKey,
    pattern: p.match.source,
  }));
}
