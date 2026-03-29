#!/usr/bin/env node

import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Command } from 'commander';
import { parseCommand, lintCommand, buildCommand, initCommand } from '../src/cli/commands.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('doteng')
  .description('doteng — English as a Programming Language')
  .version(pkg.version);

program
  .command('parse <file>')
  .description('Parse a .eng file and output the JSON AST')
  .option('-o, --output <path>', 'Write AST to file instead of stdout')
  .option('-v, --validate', 'Run validation on the AST', false)
  .action(parseCommand);

program
  .command('lint [dir]')
  .description('Validate all .eng files in a directory')
  .option('--verbose', 'Show passing files too', false)
  .action(lintCommand);

program
  .command('build [dir]')
  .description('Compile .eng files to target framework')
  .option('-t, --target <target>', 'Compilation target (react, laravel-blade, html)', 'react')
  .option('-m, --model <model>', 'LLM model to use (e.g. claude-sonnet-4-20250514, gpt-4o, gemini-2.5-pro)')
  .option('--dry-run', 'Show what would be generated without calling the API', false)
  .option('--serve', 'Start a dev server after building', false)
  .option('--cli', 'Use local Claude Code CLI instead of API (no API key needed)', false)
  .action(buildCommand);

program
  .command('init <name>')
  .description('Scaffold a new .eng project')
  .action(initCommand);

program.parse();
