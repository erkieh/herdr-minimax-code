// Herdr CLI protocol: argument lists for agent reports, and a small client over `herdr` JSON output.

export const SOURCE = 'minimax-code';
export const AGENT = 'minimax';

export const resumeCommand = (sessionId) => ['mcode', '--session', sessionId];

/** Microsecond wall clock: Herdr drops reports whose seq is not higher than the last, across processes. */
export const nextSeq = () => Math.floor((performance.timeOrigin + performance.now()) * 1000);

const identity = (seq) => ['--source', SOURCE, '--agent', AGENT, '--seq', String(seq)];

/**
 * @param {string} pane
 * @param {{ state: string, message?: string, sessionId?: string }} report
 * @param {number} seq
 */
export function reportArgs(pane, { state, message, sessionId }, seq) {
  const args = ['pane', 'report-agent', pane, ...identity(seq), '--state', state];
  if (message) args.push('--message', message);
  if (sessionId) args.push('--agent-session-id', sessionId, '--', ...resumeCommand(sessionId));
  return args;
}

export const releaseArgs = (pane, seq) => ['pane', 'release-agent', pane, ...identity(seq)];

/**
 * @param {(args: string[]) => string} exec runs `herdr <args>` and returns stdout
 */
export function createHerdrClient(exec) {
  const result = (args) => JSON.parse(exec(args)).result;
  return {
    listPaneIds: () => result(['pane', 'list']).panes.map((pane) => pane.pane_id),
    shellPid: (pane) => result(['pane', 'process-info', '--pane', pane]).process_info.shell_pid,
    agentStatus: (pane) => result(['pane', 'get', pane]).pane.agent_status,
    readScreen: (pane) => exec(['pane', 'read', pane, '--source', 'visible', '--lines', '30']),
    report: (pane, report) => exec(reportArgs(pane, report, nextSeq())),
  };
}
