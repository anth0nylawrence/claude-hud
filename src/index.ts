import { readStdin } from './stdin.js';
import { parseTranscript } from './transcript.js';
import { render } from './render/index.js';
import { countConfigs } from './config-reader.js';
import { getGitStatus } from './git.js';
import { getUsage } from './usage-api.js';
import { loadConfig } from './config.js';
import type { RenderContext } from './types.js';
import { fileURLToPath } from 'node:url';

export type MainDeps = {
  readStdin: typeof readStdin;
  parseTranscript: typeof parseTranscript;
  countConfigs: typeof countConfigs;
  getGitStatus: typeof getGitStatus;
  getUsage: typeof getUsage;
  loadConfig: typeof loadConfig;
  render: typeof render;
  now: () => number;
  log: (...args: unknown[]) => void;
};

export async function main(overrides: Partial<MainDeps> = {}): Promise<void> {
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

  try {
    const stdin = await deps.readStdin();

    if (!stdin) {
      deps.log('[claude-hud] Initializing...');
      return;
    }

    const transcriptPath = stdin.transcript_path ?? '';
    const transcript = await deps.parseTranscript(transcriptPath);

    const { claudeMdCount, rulesCount, mcpCount, hooksCount } = await deps.countConfigs(stdin.cwd);

    const config = await deps.loadConfig();
    const gitStatus = config.gitStatus.enabled
      ? await deps.getGitStatus(stdin.cwd)
      : null;

    // Only fetch usage if enabled in config (replaces env var requirement)
    const usageData = config.display.showUsage !== false
      ? await deps.getUsage()
      : null;

    const sessionDuration = formatSessionDuration(transcript.sessionStart, deps.now);

    const ctx: RenderContext = {
      stdin,
      transcript,
      claudeMdCount,
      rulesCount,
      mcpCount,
      hooksCount,
      sessionDuration,
      gitStatus,
      usageData,
      config,
    };

    deps.render(ctx);
  } catch (error) {
    deps.log('[claude-hud] Error:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export function formatSessionDuration(sessionStart?: Date, now: () => number = () => Date.now()): string {
  if (!sessionStart) {
    return '';
  }

  const ms = now() - sessionStart.getTime();
  const mins = Math.floor(ms / 60000);

  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Test mode: render mock data to preview grid layout
  if (process.argv.includes('--test')) {
    const mockCtx = {
      stdin: { cwd: '/test/project', model: { id: 'opus' }, session_id: 'test' },
      transcript: {
        tools: [],
        todos: [],
        mainSession: { completedTodos: 3, totalTodos: 8, todos: [], currentTask: 'Fix auth module', contextPercent: 59 },
        agents: [
          { id: '1', type: 'scout', model: 'sonnet', status: 'running', startTime: new Date(), completedTodos: 0, totalTodos: 0, currentTask: 'Exploring...' },
          { id: '2', type: 'kraken', model: 'sonnet', status: 'completed', startTime: new Date(), completedTodos: 5, totalTodos: 5, currentTask: 'Done', contextPercent: 87 },
          { id: '3', type: 'oracle', model: 'sonnet', status: 'running', startTime: new Date(), completedTodos: 1, totalTodos: 3, currentTask: 'Web search', contextPercent: 34 },
          { id: '4', type: 'spark', model: 'haiku', status: 'error', startTime: new Date(), completedTodos: 0, totalTodos: 2, currentTask: 'Type error', contextPercent: 91 },
          { id: '5', type: 'phoenix', model: 'sonnet', status: 'running', startTime: new Date(), completedTodos: 2, totalTodos: 4, currentTask: 'Refactoring...', contextPercent: 45 },
          { id: '6', type: 'arbiter', model: 'sonnet', status: 'pending', startTime: new Date(), completedTodos: 0, totalTodos: 0, currentTask: 'Waiting' },
          { id: '7', type: 'sleuth', model: 'sonnet', status: 'completed', startTime: new Date(), completedTodos: 3, totalTodos: 3, currentTask: 'Found root cause', contextPercent: 78 },
          { id: '8', type: 'architect', model: 'opus', status: 'running', startTime: new Date(), completedTodos: 1, totalTodos: 6, currentTask: 'Planning phase 2', contextPercent: 23 },
          { id: '9', type: 'herald', model: 'sonnet', status: 'warning', startTime: new Date(), completedTodos: 1, totalTodos: 2, currentTask: 'Changelog issue', contextPercent: 82 },
          { id: '10', type: 'critic', model: 'sonnet', status: 'completed', startTime: new Date(), completedTodos: 4, totalTodos: 4, currentTask: 'Review complete', contextPercent: 65 },
          { id: '11', type: 'profiler', model: 'sonnet', status: 'running', startTime: new Date(), completedTodos: 0, totalTodos: 1, currentTask: 'Profiling...', contextPercent: 8 },
          { id: '12', type: 'atlas', model: 'sonnet', status: 'blocked', startTime: new Date(), completedTodos: 0, totalTodos: 5, currentTask: 'Blocked on API', contextPercent: 15 },
          { id: '13', type: 'liaison', model: 'sonnet', status: 'running', startTime: new Date(), completedTodos: 2, totalTodos: 3, currentTask: 'API review', contextPercent: 56 },
          { id: '14', type: 'surveyor', model: 'sonnet', status: 'completed', startTime: new Date(), completedTodos: 2, totalTodos: 2, currentTask: 'Done', contextPercent: 72 },
          { id: '15', type: 'scribe', model: 'sonnet', status: 'running', startTime: new Date(), completedTodos: 0, totalTodos: 1, currentTask: 'Writing docs', contextPercent: 19 },
        ],
      },
      claudeMdCount: 1,
      rulesCount: 5,
      mcpCount: 3,
      hooksCount: 8,
      sessionDuration: '1h 30m',
      gitStatus: { branch: 'main', isDirty: true, ahead: 2, behind: 0, additions: 150, deletions: 45 },
      usageData: { fiveHour: 45, sevenDay: 23, planName: 'test', fiveHourResetAt: '', sevenDayResetAt: '' },
      config: { layout: 'grid' as const, display: {}, gitStatus: { enabled: true } },
    } as unknown as RenderContext;
    render(mockCtx);
  } else {
    void main();
  }
}
