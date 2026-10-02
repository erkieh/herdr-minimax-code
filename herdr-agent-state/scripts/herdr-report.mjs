// mcode hook entry point: reports MiniMax Code's state to the Herdr pane it runs in.
//
//   node herdr-report.mjs                      handle one hook event (JSON on stdin)
//   node herdr-report.mjs --watch-turn <pane>  follow-up watcher, see lib/monitors.mjs
//   node herdr-report.mjs --watch-dialog <pane>
//
// Must never write to stdout (mcode parses it as a hook decision) and never fail the hook.

import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { createHerdrClient, nextSeq, releaseArgs, reportArgs } from './lib/herdr.mjs';
import { planForHook } from './lib/hooks.mjs';
import { claim, createStore, readProcessTable, runHerdr, spawnDetached } from './lib/io.mjs';
import { watchDialog, watchTurn } from './lib/monitors.mjs';
import { ancestorsOf, findPane, parseParentMap } from './lib/pane.mjs';

const SCRIPT = fileURLToPath(import.meta.url);
const herdr = createHerdrClient(runHerdr);
const store = createStore(process.env.PLUGIN_DATA);

function handleHook(input) {
  const plan = planForHook(input);
  if (!plan) return;

  const pane = locatePane(input.session_id);
  if (!pane) return; // not running inside Herdr

  const seq = nextSeq();
  spawnDetached('herdr', plan.kind === 'release' ? releaseArgs(pane, seq) : reportArgs(pane, plan, seq));
  if (plan.followUp) spawnDetached(process.execPath, [SCRIPT, `--${plan.followUp}`, pane]);
}

function locatePane(sessionId) {
  const cacheKey = sessionId && `${sessionId}.pane`;
  const ancestors = ancestorsOf(process.ppid, parseParentMap(readProcessTable()));
  const pane = findPane({ herdr, ancestors, hint: cacheKey && store.read(cacheKey) });
  if (pane && cacheKey) store.write(cacheKey, pane);
  return pane;
}

async function main([mode, pane]) {
  switch (mode) {
    case '--watch-turn':
      // Every working report starts one; the first keeps watching, the rest exit.
      if (claim(store, `${pane}.watch`)) await watchTurn({ herdr, pane, sleep });
      return;
    case '--watch-dialog':
      await watchDialog({ herdr, pane, sleep });
      return;
    default:
      handleHook(JSON.parse(readFileSync(0, 'utf8') || '{}'));
  }
}

try {
  await main(process.argv.slice(2));
} catch {
  // Herdr reporting is best effort and must never break mcode.
}
