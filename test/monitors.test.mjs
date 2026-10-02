import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { watchDialog, watchTurn } from '../herdr-agent-state/scripts/lib/monitors.mjs';
import * as screens from './fixtures/screens.mjs';

/**
 * A pane that shows one { status, screen } frame per poll (each poll follows a sleep; the last frame
 * repeats) and applies reports to its status, like Herdr does.
 */
function scriptedPane(frames) {
  let index = -1;
  let reportedStatus;
  const frame = () => frames[Math.min(Math.max(index, 0), frames.length - 1)];
  const reports = [];
  const herdr = {
    agentStatus: () => reportedStatus ?? frame().status,
    readScreen: () => frame().screen,
    report: (_pane, { state }) => {
      reports.push(state);
      reportedStatus = state;
    },
  };
  const sleep = async () => {
    index++;
    reportedStatus = undefined; // a new frame's status wins, as if a hook reported meanwhile
  };
  return { reports, run: (monitor) => monitor({ herdr, pane: 'w1:p2', sleep }) };
}

const frame = (status, screen) => ({ status, screen });

describe('watchTurn', () => {
  it('reports idle once an interrupted turn has lost its run footer', async () => {
    const pane = scriptedPane([
      frame('working', screens.RUNNING_TURN),
      frame('working', screens.RUNNING_TURN),
      frame('working', screens.RUNNING_TURN),
      frame('working', screens.INTERRUPTED_TURN),
    ]);
    await pane.run(watchTurn);
    assert.deepEqual(pane.reports, ['idle']);
  });

  it('reports blocked when the turn stops at a dialog without a hook', async () => {
    const pane = scriptedPane([frame('working', screens.RUNNING_TURN), frame('working', screens.QUESTION_DIALOG)]);
    await pane.run(watchTurn);
    assert.deepEqual(pane.reports, ['blocked']);
  });

  it('tolerates a single redraw without the footer', async () => {
    const pane = scriptedPane([
      frame('working', screens.RUNNING_TURN),
      frame('working', screens.IDLE_AFTER_TURN),
      frame('working', screens.RUNNING_TURN),
      frame('idle', screens.IDLE_AFTER_TURN),
    ]);
    await pane.run(watchTurn);
    assert.deepEqual(pane.reports, []);
  });

  it('stops without reporting once a hook moves the pane out of working', async () => {
    const pane = scriptedPane([frame('working', screens.RUNNING_TURN), frame('blocked', screens.PERMISSION_DIALOG)]);
    await pane.run(watchTurn);
    assert.deepEqual(pane.reports, []);
  });
});

describe('watchDialog', () => {
  it('holds blocked while a question is open, then idle once it closes', async () => {
    const pane = scriptedPane([
      frame('done', screens.QUESTION_DIALOG),
      frame('blocked', screens.QUESTION_DIALOG),
      frame('blocked', screens.QUESTION_CANCEL_CONFIRM),
      frame('blocked', screens.IDLE_AFTER_TURN),
    ]);
    await pane.run(watchDialog);
    assert.deepEqual(pane.reports, ['blocked', 'idle']);
  });

  it('does nothing when the turn ended without a dialog', async () => {
    const pane = scriptedPane([frame('idle', screens.IDLE_AFTER_TURN)]);
    await pane.run(watchDialog);
    assert.deepEqual(pane.reports, []);
  });

  it('does nothing when a new turn already started', async () => {
    const pane = scriptedPane([frame('working', screens.QUESTION_DIALOG)]);
    await pane.run(watchDialog);
    assert.deepEqual(pane.reports, []);
  });

  it('hands over to hooks once the answer starts a new turn', async () => {
    const pane = scriptedPane([frame('done', screens.QUESTION_DIALOG), frame('working', screens.RUNNING_TURN)]);
    await pane.run(watchDialog);
    assert.deepEqual(pane.reports, ['blocked']);
  });
});
