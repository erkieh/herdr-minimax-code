import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { showsDialog, showsRunFooter } from '../herdr-agent-state/scripts/lib/screen.mjs';
import * as screens from './fixtures/screens.mjs';

describe('showsRunFooter', () => {
  it('sees a running turn', () => assert.equal(showsRunFooter(screens.RUNNING_TURN), true));

  it('sees a running turn whose "Esc stop" is cut off', () =>
    assert.equal(showsRunFooter(screens.RUNNING_TURN_TRUNCATED), true));

  for (const name of ['IDLE_AFTER_TURN', 'INTERRUPTED_TURN', 'PERMISSION_DIALOG', 'QUESTION_DIALOG']) {
    it(`sees no running turn in ${name}`, () => assert.equal(showsRunFooter(screens[name]), false));
  }

  it('only looks at the bottom of the screen', () => {
    const footerScrolledUp = `${screens.RUNNING_TURN}\n${'\n'.repeat(8)}`;
    assert.equal(showsRunFooter(footerScrolledUp), false);
  });
});

describe('showsDialog', () => {
  for (const name of ['PERMISSION_DIALOG', 'QUESTION_DIALOG', 'QUESTION_CANCEL_CONFIRM']) {
    it(`sees ${name}`, () => assert.equal(showsDialog(screens[name]), true));
  }

  for (const name of ['RUNNING_TURN', 'IDLE_AFTER_TURN', 'INTERRUPTED_TURN']) {
    it(`sees no dialog in ${name}`, () => assert.equal(showsDialog(screens[name]), false));
  }

  it('ignores chat prose that mentions asking or confirming', () =>
    assert.equal(showsDialog('Ask me anything. Press enter to confirm you read it.'), false));
});
