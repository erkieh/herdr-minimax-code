import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ancestorsOf, findPane, parseParentMap } from '../herdr-agent-state/scripts/lib/pane.mjs';

describe('parseParentMap', () => {
  it('parses padded ps output and skips blank lines', () =>
    assert.deepEqual(parseParentMap('    1     0\n  412     1\n 9001   412\n\n'), new Map([[1, 0], [412, 1], [9001, 412]])));
});

describe('ancestorsOf', () => {
  const parents = new Map([[30, 20], [20, 10], [10, 1], [1, 0]]);

  it('walks up to, but not including, init', () => assert.deepEqual(ancestorsOf(30, parents), new Set([30, 20, 10])));

  it('stops at an unknown parent', () => assert.deepEqual(ancestorsOf(99, parents), new Set([99])));

  it('survives a cycle', () => assert.deepEqual(ancestorsOf(5, new Map([[5, 6], [6, 5]])), new Set([5, 6])));
});

describe('findPane', () => {
  const shellPids = { 'w1:p1': 100, 'w1:p2': 200, 'w1:p3': 300 };
  const fakeHerdr = () => {
    const herdr = {
      scans: 0,
      listPaneIds: () => {
        herdr.scans++;
        return Object.keys(shellPids);
      },
      shellPid: (pane) => {
        if (!(pane in shellPids)) throw new Error('pane_not_found');
        return shellPids[pane];
      },
    };
    return herdr;
  };
  const ancestors = new Set([999, 200]); // hook → … → shell of w1:p2

  it('finds the pane whose shell is an ancestor', () =>
    assert.equal(findPane({ herdr: fakeHerdr(), ancestors }), 'w1:p2'));

  it('uses a valid hint without scanning every pane', () => {
    const herdr = fakeHerdr();
    assert.equal(findPane({ herdr, ancestors, hint: 'w1:p2' }), 'w1:p2');
    assert.equal(herdr.scans, 0);
  });

  it('rescans when the hint is stale or closed', () => {
    assert.equal(findPane({ herdr: fakeHerdr(), ancestors, hint: 'w1:p3' }), 'w1:p2');
    assert.equal(findPane({ herdr: fakeHerdr(), ancestors, hint: 'w9:gone' }), 'w1:p2');
  });

  it('returns undefined outside Herdr', () =>
    assert.equal(findPane({ herdr: fakeHerdr(), ancestors: new Set([999]) }), undefined));
});
