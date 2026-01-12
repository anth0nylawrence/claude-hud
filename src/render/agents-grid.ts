import type { RenderContext, AgentEntry, AgentStatus } from '../types.js';
import { dim, green, yellow, red, cyan } from './colors.js';
import stringWidth from 'string-width';

// Status icons
const STATUS_ICONS: Record<AgentStatus | 'main', string> = {
  main: '🎯',
  running: '⚙️',
  completed: '✅',
  pending: '⏳',
  error: '❌',
  warning: '⚠️',
  blocked: '🔒',
};

// Model icons
const MODEL_ICONS: Record<string, string> = {
  opus: '🧠',
  sonnet: '🎭',
  haiku: '⚡',
};

function getModelIcon(model?: string): string {
  if (!model) return '';
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return MODEL_ICONS.opus;
  if (lower.includes('sonnet')) return MODEL_ICONS.sonnet;
  if (lower.includes('haiku')) return MODEL_ICONS.haiku;
  return '';
}

function truncate(str: string, maxLen: number): string {
  // Use string-width for accurate visual truncation
  let result = '';
  let width = 0;
  for (const char of str) {
    const charWidth = stringWidth(char);
    if (width + charWidth > maxLen - 1) {
      return result + '…';
    }
    result += char;
    width += charWidth;
  }
  return str;
}

function padRight(str: string, targetWidth: number): string {
  const currentWidth = stringWidth(str);
  const padding = Math.max(0, targetWidth - currentWidth);
  return str + ' '.repeat(padding);
}

function formatContextPercent(percent?: number): string {
  if (percent === undefined || percent === null) return '';
  return `(${percent}%)`;
}

interface GridCell {
  line1: string; // Header: icon + name + progress + context% (raw, no colors)
  line2: string; // Detail: current task (raw, no colors)
  status: AgentStatus | 'main';
}

function formatMainSession(ctx: RenderContext): GridCell {
  const { mainSession } = ctx.transcript;
  const icon = STATUS_ICONS.main;
  const progress = `(${mainSession.completedTodos}/${mainSession.totalTodos})`;
  const ctxPct = formatContextPercent(mainSession.contextPercent);
  const task = truncate(mainSession.currentTask || 'No active task', 22);

  return {
    line1: `${icon} MAIN ${progress}${ctxPct}`,
    line2: `  └─ ${task}`,
    status: 'main',
  };
}

function formatAgent(agent: AgentEntry): GridCell {
  const icon = STATUS_ICONS[agent.status] || STATUS_ICONS.running;
  const modelIcon = getModelIcon(agent.model);
  const name = truncate(agent.type, 8);
  const progress = `(${agent.completedTodos}/${agent.totalTodos})`;
  const ctxPct = formatContextPercent(agent.contextPercent);
  const task = truncate(agent.currentTask || agent.description || 'Working...', 22);

  return {
    line1: `${icon} ${name}${modelIcon} ${progress}${ctxPct}`,
    line2: `  └─ ${task}`,
    status: agent.status,
  };
}

function colorize(text: string, status: AgentStatus | 'main', isDetail: boolean = false): string {
  switch (status) {
    case 'completed':
      return isDetail ? dim(text) : green(text);
    case 'error':
      return red(text);
    case 'warning':
      return yellow(text);
    case 'pending':
    case 'blocked':
      return dim(text);
    case 'main':
      return isDetail ? text : cyan(text);
    default:
      return text;
  }
}

// Box drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  topT: '┬',
  bottomT: '┴',
  leftT: '├',
  rightT: '┤',
  cross: '┼',
};

/**
 * Renders a 4x4 grid of agents with box drawing
 * Total width: 4 cols × 30 chars + 5 borders = 125 chars
 */
export function renderAgentsGrid(ctx: RenderContext): string[] {
  const { agents } = ctx.transcript;
  const display = ctx.config?.display;

  if (display?.showAgents === false && display?.showTodos === false) {
    return [];
  }

  const COLS = 4;
  const COL_WIDTH = 30; // Increased from 24 for more space

  // Build cells: main session first, then agents
  const cells: GridCell[] = [];

  const mainCell = formatMainSession(ctx);
  cells.push(mainCell);

  for (const agent of agents.slice(0, 15)) {
    cells.push(formatAgent(agent));
  }

  if (cells.length === 1 && ctx.transcript.mainSession.totalTodos === 0) {
    return [];
  }

  // Calculate rows needed
  const rowCount = Math.ceil(cells.length / COLS);
  const lines: string[] = [];

  // Build horizontal border
  const cellBorder = BOX.horizontal.repeat(COL_WIDTH);

  // Top border
  const topBorder = dim(
    BOX.topLeft +
    Array(COLS).fill(cellBorder).join(BOX.topT) +
    BOX.topRight
  );
  lines.push(topBorder);

  for (let row = 0; row < rowCount; row++) {
    const rowStart = row * COLS;

    // Get cells for this row, padding with empty if needed
    const rowCells: (GridCell | null)[] = [];
    for (let col = 0; col < COLS; col++) {
      const idx = rowStart + col;
      rowCells.push(idx < cells.length ? cells[idx] : null);
    }

    // Line 1: headers
    const line1Parts = rowCells.map(cell => {
      if (!cell) return ' '.repeat(COL_WIDTH);
      const padded = padRight(cell.line1, COL_WIDTH);
      return colorize(padded, cell.status, false);
    });
    lines.push(dim(BOX.vertical) + line1Parts.join(dim(BOX.vertical)) + dim(BOX.vertical));

    // Line 2: details
    const line2Parts = rowCells.map(cell => {
      if (!cell) return ' '.repeat(COL_WIDTH);
      const padded = padRight(cell.line2, COL_WIDTH);
      return colorize(padded, cell.status, true);
    });
    lines.push(dim(BOX.vertical) + line2Parts.join(dim(BOX.vertical)) + dim(BOX.vertical));

    // Row separator (not after last row)
    if (row < rowCount - 1) {
      const midBorder = dim(
        BOX.leftT +
        Array(COLS).fill(cellBorder).join(BOX.cross) +
        BOX.rightT
      );
      lines.push(midBorder);
    }
  }

  // Bottom border
  const bottomBorder = dim(
    BOX.bottomLeft +
    Array(COLS).fill(cellBorder).join(BOX.bottomT) +
    BOX.bottomRight
  );
  lines.push(bottomBorder);

  return lines;
}

/**
 * Creates a horizontal separator line (kept for compatibility)
 */
export function renderGridSeparator(width: number = 100): string {
  return dim('─'.repeat(width));
}
