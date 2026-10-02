// Side effects: the herdr and ps binaries, detached processes, and the plugin's data directory.

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const COMMAND_TIMEOUT_MS = 1500;

const run = (command, args) => execFileSync(command, args, { encoding: 'utf8', timeout: COMMAND_TIMEOUT_MS });

export const runHerdr = (args) => run('herdr', args);

export const readProcessTable = () => run('ps', ['-axo', 'pid=,ppid=']);

/** Fire and forget in a new process group, so mcode's hook timeout can neither wait on it nor kill it. */
export function spawnDetached(command, args) {
  spawn(command, args, { detached: true, stdio: 'ignore' })
    .on('error', () => {})
    .unref();
}

export function processIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM'; // exists, owned by someone else
  }
}

/** Small string values under `dir` (mcode's PLUGIN_DATA). A missing `dir` turns it into a no-op. */
export function createStore(dir) {
  const file = (key) => path.join(dir, key.replace(/[^\w.-]/g, '_'));
  return {
    read(key) {
      if (!dir) return undefined;
      try {
        return readFileSync(file(key), 'utf8');
      } catch {
        return undefined;
      }
    },
    write(key, value) {
      if (!dir) return;
      mkdirSync(dir, { recursive: true });
      writeFileSync(file(key), String(value));
    },
  };
}

/** Single-instance guard: takes `key` unless another live process already holds it. */
export function claim(store, key, { pid = process.pid, isAlive = processIsAlive } = {}) {
  const holder = Number(store.read(key));
  if (holder && holder !== pid && isAlive(holder)) return false;
  store.write(key, pid);
  return true;
}
