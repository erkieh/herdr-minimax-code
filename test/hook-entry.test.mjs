// Runs the real hook script the way mcode does, against a fake `herdr` binary on PATH.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../herdr-agent-state/scripts/herdr-report.mjs', import.meta.url));

// Pane w1:p2's shell is this test process, which is an ancestor of the hook script.
const FAKE_HERDR = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_HERDR_LOG, JSON.stringify(args) + '\\n');
const shellPids = { 'w1:p1': 1, 'w1:p2': Number(process.env.FAKE_SHELL_PID) };
const results = {
  list: () => ({ panes: Object.keys(shellPids).map((pane_id) => ({ pane_id })) }),
  'process-info': () => ({ process_info: { shell_pid: shellPids[args[3]] } }),
  get: () => ({ pane: { agent_status: 'idle' } }),
};
const result = results[args[1]];
process.stdout.write(result ? JSON.stringify({ result: result() }) : '');
`;

function setup() {
  const dir = mkdtempSync(path.join(tmpdir(), 'herdr-hook-'));
  const bin = path.join(dir, 'bin');
  const log = path.join(dir, 'herdr.log');
  const data = path.join(dir, 'plugin-data');
  mkdirSync(bin);
  writeFileSync(path.join(bin, 'herdr'), FAKE_HERDR);
  chmodSync(path.join(bin, 'herdr'), 0o755);

  // mcode passes hooks only a whitelisted environment: no HERDR_* variables.
  const runHook = (input) =>
    spawnSync(process.execPath, [SCRIPT], {
      input: JSON.stringify(input),
      encoding: 'utf8',
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        HOME: process.env.HOME,
        PLUGIN_DATA: data,
        FAKE_HERDR_LOG: log,
        FAKE_SHELL_PID: String(process.pid),
      },
    });

  const calls = () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : []);
  // Reports go out from a detached process, so give them a moment to land.
  const waitForCall = async (command) => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const call = calls().find((args) => args[1] === command);
      if (call) return call;
      await sleep(50);
    }
    assert.fail(`herdr pane ${command} was never called; calls: ${JSON.stringify(calls())}`);
  };

  return { runHook, calls, waitForCall, data };
}

describe('hook entry point', () => {
  it('reports working with a resume command to the pane it runs in', async () => {
    const herdr = setup();
    const result = herdr.runHook({ hook_event_name: 'UserPromptSubmit', session_id: 'mvs_1', prompt: 'hi' });

    assert.equal(result.status, 0);
    assert.equal(result.stdout, '', 'stdout is a hook decision for mcode and must stay empty');
    const report = await herdr.waitForCall('report-agent');
    const seq = report[report.indexOf('--seq') + 1];
    assert.match(seq, /^\d+$/);
    assert.deepEqual(report, [
      'pane', 'report-agent', 'w1:p2',
      '--source', 'minimax-code', '--agent', 'minimax', '--seq', seq,
      '--state', 'working',
      '--agent-session-id', 'mvs_1', '--', 'mcode', '--session', 'mvs_1',
    ]);
    assert.equal(readFileSync(path.join(herdr.data, 'mvs_1.pane'), 'utf8'), 'w1:p2');
  });

  it('releases the pane when mcode exits', async () => {
    const herdr = setup();
    herdr.runHook({ hook_event_name: 'SessionEnd', session_id: 'mvs_1', reason: 'other' });
    assert.deepEqual((await herdr.waitForCall('release-agent')).slice(0, 3), ['pane', 'release-agent', 'w1:p2']);
  });

  it('stays silent for events it does not handle', async () => {
    const herdr = setup();
    const result = herdr.runHook({ hook_event_name: 'SessionEnd', session_id: 'mvs_1', reason: 'clear' });
    await sleep(300);
    assert.equal(result.status, 0);
    assert.deepEqual(herdr.calls(), []);
  });

  it('never fails the hook, even on garbage input', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { input: 'not json', encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, '');
  });
});
