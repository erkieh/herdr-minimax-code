import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { planForHook } from '../herdr-agent-state/scripts/lib/hooks.mjs';

const SESSION = 'mvs_123';

describe('planForHook', () => {
  const cases = [
    ['SessionStart', 'idle', undefined],
    ['UserPromptSubmit', 'working', 'watch-turn'],
    ['PreToolUse', 'working', 'watch-turn'],
    ['PostToolUse', 'working', 'watch-turn'],
    ['PermissionRequest', 'blocked', undefined],
    ['Stop', 'idle', 'watch-dialog'],
  ];
  for (const [event, state, followUp] of cases) {
    it(`reports ${event} as ${state}`, () => {
      const plan = planForHook({ hook_event_name: event, session_id: SESSION, tool_name: 'bash' });
      assert.equal(plan.kind, 'report');
      assert.equal(plan.state, state);
      assert.equal(plan.sessionId, SESSION);
      assert.equal(plan.followUp, followUp);
    });
  }

  it('explains a permission block with the tool name', () => {
    const plan = planForHook({ hook_event_name: 'PermissionRequest', tool_name: 'bash' });
    assert.equal(plan.message, 'Approval needed: bash');
  });

  it('only sets a message for permission blocks', () =>
    assert.equal(planForHook({ hook_event_name: 'Stop' }).message, undefined));

  it('releases the pane when the session really ends', () =>
    assert.deepEqual(planForHook({ hook_event_name: 'SessionEnd', reason: 'other' }), { kind: 'release' }));

  for (const reason of ['clear', 'resume_other']) {
    it(`keeps the pane on SessionEnd(${reason}), because a new session follows`, () =>
      assert.equal(planForHook({ hook_event_name: 'SessionEnd', reason }), null));
  }

  for (const event of ['PreCompact', 'SubagentStart', undefined]) {
    it(`ignores ${event}`, () => assert.equal(planForHook({ hook_event_name: event }), null));
  }
});
