// Reports MiniMax Code lifecycle to Herdr. Never writes stdout: mcode parses it as a hook decision.
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const SOURCE = 'minimax-code';
const AGENT = 'minimax';
const HERDR = 'herdr';
const STATES = {
  SessionStart: 'idle',
  UserPromptSubmit: 'working',
  PreToolUse: 'working',
  PostToolUse: 'working',
  PermissionRequest: 'blocked',
  Stop: 'idle',
};
const DATA = process.env.PLUGIN_DATA;

const run = (args) => execFileSync(HERDR, args, { encoding: 'utf8', timeout: 1500 });
const herdr = (...args) => JSON.parse(run(args)).result;
const dataFile = (name) => DATA && path.join(DATA, name.replace(/[^\w.-]/g, '_'));
const readData = (name) => {
  try {
    return readFileSync(dataFile(name), 'utf8');
  } catch {}
};
const writeData = (name, value) => {
  if (!DATA) return;
  mkdirSync(DATA, { recursive: true });
  writeFileSync(dataFile(name), String(value));
};
const detach = (cmd, args) => spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();

function ancestorPids() {
  const parent = new Map();
  for (const line of execFileSync('ps', ['-axo', 'pid=,ppid='], { encoding: 'utf8', timeout: 1500 }).split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (pid) parent.set(pid, ppid);
  }
  const pids = new Set();
  for (let pid = process.ppid; pid > 1 && !pids.has(pid); pid = parent.get(pid)) pids.add(pid);
  return pids;
}

const ownsPane = (pane, pids) => {
  try {
    return pids.has(herdr('pane', 'process-info', '--pane', pane).process_info.shell_pid);
  } catch {
    return false;
  }
};

// mcode gives hooks a whitelisted env without HERDR_PANE_ID, so find the pane whose shell is our ancestor.
function findPane(sessionId) {
  const pids = ancestorPids();
  const cached = sessionId && readData(`${sessionId}.pane`);
  if (cached && ownsPane(cached, pids)) return cached;
  const pane = herdr('pane', 'list').panes.map((p) => p.pane_id).find((id) => ownsPane(id, pids));
  if (pane && sessionId) writeData(`${sessionId}.pane`, pane);
  return pane;
}

const seq = () => String(Math.floor((performance.timeOrigin + performance.now()) * 1000));

const DIALOG = /enter confirm|esc deny|esc cancel|keep answering|use plan mode\?|ask ─|frozen runtime snapshot/i;
const status = (pane) => herdr('pane', 'get', pane).pane.agent_status;
const screen = (pane) => run(['pane', 'read', pane, '--source', 'visible', '--lines', '30']);
const reportState = (pane, state) =>
  run(['pane', 'report-agent', pane, '--source', SOURCE, '--agent', AGENT, '--seq', seq(), '--state', state]);

// mcode fires no Stop for an interrupted turn and no hook for plan dialogs, so watch the screen while working:
// the run footer means still working, dialog chrome means blocked, neither twice in a row means idle.
// Exits as soon as anything else moves the pane out of working.
async function watch(pane) {
  const lock = `${pane}.watch`;
  const owner = Number(readData(lock));
  try {
    if (owner && owner !== process.pid && process.kill(owner, 0)) return;
  } catch {}
  writeData(lock, process.pid);
  let state;
  for (let misses = 0; misses < 2; ) {
    await sleep(1000);
    if (status(pane) !== 'working') return;
    const text = screen(pane);
    state = DIALOG.test(text) ? 'blocked' : 'idle';
    misses = /esc stop|(?:running|loading) \d/i.test(text.split('\n').slice(-8).join('\n')) ? 0 : misses + 1;
  }
  if (status(pane) === 'working') reportState(pane, state);
}

// ask_user ends the turn (Stop) before its question dialog renders, so recheck the settled screen. Cancelling
// the question fires no hook, so hold blocked only while the dialog is on screen.
async function settle(pane) {
  await sleep(1000);
  if (!['idle', 'done'].includes(status(pane)) || !DIALOG.test(screen(pane))) return;
  reportState(pane, 'blocked');
  for (let misses = 0; misses < 2; ) {
    await sleep(1000);
    if (status(pane) !== 'blocked') return;
    misses = DIALOG.test(screen(pane)) ? 0 : misses + 1;
  }
  reportState(pane, 'idle');
}

function main() {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const event = input.hook_event_name;
  // clear / resume_other replace the session in the same process; SessionStart re-reports.
  if (event === 'SessionEnd' && ['clear', 'resume_other'].includes(input.reason)) return;
  if (event !== 'SessionEnd' && !STATES[event]) return;
  const pane = findPane(input.session_id);
  if (!pane) return;

  const common = ['--source', SOURCE, '--agent', AGENT, '--seq', seq()];
  const args =
    event === 'SessionEnd'
      ? ['pane', 'release-agent', pane, ...common]
      : ['pane', 'report-agent', pane, ...common, '--state', STATES[event]];
  if (event === 'PermissionRequest') args.push('--message', `Approval needed: ${input.tool_name ?? 'tool'}`);
  if (event !== 'SessionEnd' && input.session_id) {
    args.push('--agent-session-id', input.session_id, '--', 'mcode', '--session', input.session_id);
  }

  // Detached so mcode's hook timeout/process-group kill can't block or cancel the report.
  detach(HERDR, args);
  if (STATES[event] === 'working') detach(process.execPath, [process.argv[1], '--watch', pane]);
  if (event === 'Stop') detach(process.execPath, [process.argv[1], '--settle', pane]);
}

try {
  if (process.argv[2] === '--watch') await watch(process.argv[3]);
  else if (process.argv[2] === '--settle') await settle(process.argv[3]);
  else main();
} catch {
  // Herdr reporting must never break mcode.
}
