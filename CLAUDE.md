# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude HUD is a Claude Code plugin that displays a real-time multi-line statusline. It shows context health, tool activity, agent status, and todo progress.

## Build Commands

```bash
npm ci               # Install dependencies
npm run build        # Build TypeScript to dist/
npm run dev          # Watch mode compilation

# Manual stdin test
echo '{"model":{"display_name":"Opus"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000}}' | node dist/index.js

# Visual test with mock agent grid (16 agents)
npm run build && node dist/index.js --test
```

## Architecture

### Invocation Model

Claude Code invokes the statusline command every ~300ms. Each invocation is stateless:
1. Receives JSON via stdin (model, context, tokens)
2. Parses the transcript JSONL for tools, agents, todos
3. Renders multi-line output to stdout
4. Claude Code displays all lines

### Data Flow

```
Claude Code → stdin JSON → parse → render lines → stdout
           ↘ transcript_path → parse JSONL → tools/agents/todos
```

### Key Modules

| Module | Purpose |
|--------|---------|
| `stdin.ts` | Parses stdin JSON (model, tokens, transcript_path) |
| `transcript.ts` | Streams JSONL, extracts tool_use/tool_result/TodoWrite/Task blocks |
| `config.ts` | Loads `~/.claude/plugins/claude-hud/config.json`, validates, merges with defaults |
| `config-reader.ts` | Counts CLAUDE.md files, rules, MCPs, hooks |
| `usage-api.ts` | Fetches 5h/7d usage from Anthropic OAuth API (cached 60s) |
| `render/index.ts` | Coordinates layout (default, separators, grid) |

### Dependency Injection

`main()` in `index.ts` accepts a `Partial<MainDeps>` for testing:

```typescript
const deps: MainDeps = {
  readStdin,
  parseTranscript,
  countConfigs,
  getGitStatus,
  getUsage,
  loadConfig,
  render,
  now: () => Date.now(),
  log: console.log,
  ...overrides,
};
```

### Layouts

- **default**: All info on first line, activity lines below
- **separators**: Adds visual separator between header and activity
- **grid**: 4x4 box-drawing grid for multi-agent orchestration (max 16 slots)

### Context Thresholds

| Threshold | Color | Behavior |
|-----------|-------|----------|
| <70% | Green | Normal display |
| 70-85% | Yellow | Warning state |
| >85% | Red | Shows token breakdown |

## Plugin Configuration

Plugin manifest: `.claude-plugin/plugin.json` (metadata only).

StatusLine config: Added to user's `~/.claude/settings.json` via `/claude-hud:setup`.

User preferences: `~/.claude/plugins/claude-hud/config.json`

## Debugging

Enable debug output:
```bash
DEBUG=claude-hud node dist/index.js
```

Creates namespaced loggers via `createDebug('namespace')` in `debug.ts`.
