// Screen watchers for transitions that fire no mcode hook. Each returns as soon as a hook report
// moves the pane to a state the watcher does not own, so hooks always take precedence.

import { showsDialog, showsRunFooter } from './screen.mjs';

export const POLL_MS = 1000;
const MISSES_TO_SETTLE = 2; // tolerate one redraw without the chrome
const SETTLED_STATUSES = new Set(['idle', 'done']); // Herdr shows `done` for idle after a turn

/**
 * @typedef {{
 *   herdr: {
 *     agentStatus(pane: string): string,
 *     readScreen(pane: string): string,
 *     report(pane: string, report: { state: string }): void,
 *   },
 *   pane: string,
 *   sleep: (ms: number) => Promise<unknown>,
 * }} MonitorOptions
 */

/**
 * Pressing Esc ends a turn without Stop, and plan dialogs fire no hook. While the pane is `working`,
 * wait until mcode's run footer is gone, then report `blocked` if a dialog is showing, else `idle`.
 * @param {MonitorOptions} options
 */
export async function watchTurn({ herdr, pane, sleep }) {
  let screen = '';
  for (let misses = 0; misses < MISSES_TO_SETTLE; ) {
    await sleep(POLL_MS);
    if (herdr.agentStatus(pane) !== 'working') return;
    screen = herdr.readScreen(pane);
    misses = showsRunFooter(screen) ? 0 : misses + 1;
  }
  if (herdr.agentStatus(pane) !== 'working') return;
  herdr.report(pane, { state: showsDialog(screen) ? 'blocked' : 'idle' });
}

/**
 * ask_user ends the turn (Stop fires) before its question dialog renders, and cancelling the question
 * fires nothing. Report `blocked` while the dialog is on screen and `idle` once it closes.
 * @param {MonitorOptions} options
 */
export async function watchDialog({ herdr, pane, sleep }) {
  await sleep(POLL_MS);
  if (!SETTLED_STATUSES.has(herdr.agentStatus(pane))) return;
  if (!showsDialog(herdr.readScreen(pane))) return;
  herdr.report(pane, { state: 'blocked' });

  for (let misses = 0; misses < MISSES_TO_SETTLE; ) {
    await sleep(POLL_MS);
    if (herdr.agentStatus(pane) !== 'blocked') return;
    misses = showsDialog(herdr.readScreen(pane)) ? 0 : misses + 1;
  }
  herdr.report(pane, { state: 'idle' });
}
