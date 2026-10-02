import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createHerdrClient, nextSeq, releaseArgs, reportArgs } from '../herdr-agent-state/scripts/lib/herdr.mjs';

const IDENTITY = ['--source', 'minimax-code', '--agent', 'minimax', '--seq', '42'];

describe('reportArgs', () => {
  it('reports a bare state', () =>
    assert.deepEqual(reportArgs('w1:p2', { state: 'idle' }, 42), [
      'pane', 'report-agent', 'w1:p2', ...IDENTITY, '--state', 'idle',
    ]));

  it('adds the message and a resume command for the session', () =>
    assert.deepEqual(reportArgs('w1:p2', { state: 'blocked', message: 'Approval needed: bash', sessionId: 'mvs_1' }, 42), [
      'pane', 'report-agent', 'w1:p2', ...IDENTITY, '--state', 'blocked',
      '--message', 'Approval needed: bash',
      '--agent-session-id', 'mvs_1', '--', 'mcode', '--session', 'mvs_1',
    ]));
});

describe('releaseArgs', () => {
  it('releases with the same identity', () =>
    assert.deepEqual(releaseArgs('w1:p2', 42), ['pane', 'release-agent', 'w1:p2', ...IDENTITY]));
});

describe('nextSeq', () => {
  it('strictly increases between calls', () => {
    const first = nextSeq();
    let second = nextSeq();
    while (second === first) second = nextSeq();
    assert.ok(second > first);
  });
});

describe('createHerdrClient', () => {
  const responses = {
    'pane list': { panes: [{ pane_id: 'w1:p1' }, { pane_id: 'w1:p2' }] },
    'pane process-info --pane w1:p2': { process_info: { shell_pid: 777 } },
    'pane get w1:p2': { pane: { agent_status: 'working' } },
  };
  const calls = [];
  const herdr = createHerdrClient((args) => {
    calls.push(args);
    const response = responses[args.join(' ')];
    return response ? JSON.stringify({ result: response }) : 'screen text';
  });

  it('lists pane ids', () => assert.deepEqual(herdr.listPaneIds(), ['w1:p1', 'w1:p2']));
  it('reads the shell pid', () => assert.equal(herdr.shellPid('w1:p2'), 777));
  it('reads the agent status', () => assert.equal(herdr.agentStatus('w1:p2'), 'working'));
  it('returns the visible screen as text', () => assert.equal(herdr.readScreen('w1:p2'), 'screen text'));

  it('sends reports through report-agent', () => {
    herdr.report('w1:p2', { state: 'idle' });
    const args = calls.at(-1);
    assert.deepEqual(args.slice(0, 3), ['pane', 'report-agent', 'w1:p2']);
    assert.deepEqual(args.slice(-2), ['--state', 'idle']);
  });
});
