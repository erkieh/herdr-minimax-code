// Translates mcode hook events into what Herdr should be told.

const STATE_BY_EVENT = {
  SessionStart: 'idle',
  UserPromptSubmit: 'working',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PermissionRequest: 'blocked',
  Stop: 'idle',
};

// mcode swaps sessions inside the same process for these; the next SessionStart reports again.
const SESSION_SWAP_REASONS = new Set(['clear', 'resume_other']);

/**
 * @typedef {{ kind: 'release' }} ReleasePlan
 * @typedef {{
 *   kind: 'report',
 *   state: 'idle' | 'working' | 'blocked',
 *   message?: string,
 *   sessionId?: string,
 *   followUp?: 'watch-turn' | 'watch-dialog',
 * }} ReportPlan
 */

/**
 * Decides what a hook event means for Herdr.
 * @param {Record<string, any>} input the JSON mcode writes to the hook's stdin
 * @returns {ReleasePlan | ReportPlan | null} null when the event needs no report
 */
export function planForHook(input) {
  const event = input.hook_event_name;
  if (event === 'SessionEnd') {
    return SESSION_SWAP_REASONS.has(input.reason) ? null : { kind: 'release' };
  }

  const state = STATE_BY_EVENT[event];
  if (!state) return null;

  const plan = { kind: 'report', state };
  if (event === 'PermissionRequest') plan.message = `Approval needed: ${input.tool_name ?? 'tool'}`;
  if (input.session_id) plan.sessionId = input.session_id;
  // Some transitions fire no hook, so a screen watcher covers them (see monitors.mjs).
  if (state === 'working') plan.followUp = 'watch-turn';
  if (event === 'Stop') plan.followUp = 'watch-dialog';
  return plan;
}
