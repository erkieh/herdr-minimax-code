import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { claim, createStore, processIsAlive } from '../herdr-agent-state/scripts/lib/io.mjs';

const tempDir = () => mkdtempSync(path.join(tmpdir(), 'herdr-agent-state-'));

describe('createStore', () => {
  it('round-trips values and makes keys safe as file names', () => {
    const store = createStore(path.join(tempDir(), 'nested'));
    store.write('w1:p2.watch', 123);
    assert.equal(store.read('w1:p2.watch'), '123');
    assert.equal(store.read('missing'), undefined);
  });

  it('is a no-op without a directory', () => {
    const store = createStore(undefined);
    store.write('key', 'value');
    assert.equal(store.read('key'), undefined);
  });
});

describe('claim', () => {
  const alive = (pids) => (pid) => pids.includes(pid);

  it('takes a free key', () => {
    const store = createStore(tempDir());
    assert.equal(claim(store, 'lock', { pid: 10, isAlive: alive([]) }), true);
    assert.equal(store.read('lock'), '10');
  });

  it('refuses a key held by another live process', () => {
    const store = createStore(tempDir());
    store.write('lock', 20);
    assert.equal(claim(store, 'lock', { pid: 10, isAlive: alive([20]) }), false);
  });

  it('takes over from a dead holder', () => {
    const store = createStore(tempDir());
    store.write('lock', 20);
    assert.equal(claim(store, 'lock', { pid: 10, isAlive: alive([]) }), true);
  });
});

describe('processIsAlive', () => {
  it('knows this process is alive', () => assert.equal(processIsAlive(process.pid), true));
  it('knows an unused pid is not', () => assert.equal(processIsAlive(2 ** 22 + 1), false));
});
