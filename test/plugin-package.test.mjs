// Guards the plugin package against the constraints mcode's MiniMax plugin reader enforces.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../herdr-agent-state/', import.meta.url));
const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, file), 'utf8'));
const manifest = readJson('.minimax-plugin/plugin.json');

describe('plugin manifest', () => {
  it('has the fields mcode requires', () => {
    assert.equal(manifest.schemaVersion, 1);
    assert.match(manifest.name, /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    for (const field of ['description', 'author', 'category']) assert.ok(manifest[field], field);
    for (const field of ['exampleQueries', 'apps', 'mcpServers', 'skills']) assert.deepEqual(manifest[field], []);
  });

  it('points at files that exist', () => {
    assert.match(manifest.icon, /\.(png|jpe?g|webp)$/);
    for (const file of [manifest.icon, ...manifest.hooks]) assert.ok(existsSync(path.join(ROOT, file)), file);
  });

  it('ships no package.json, which mcode would read as a MiniApp', () =>
    assert.equal(existsSync(path.join(ROOT, 'package.json')), false));
});

describe('hook registration', () => {
  const { hooks } = readJson(manifest.hooks[0]);
  const HANDLED = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'Stop', 'SessionEnd'];
  const TOOL_EVENTS = ['PreToolUse', 'PermissionRequest', 'PostToolUse'];

  it('registers every event the script handles', () => assert.deepEqual(Object.keys(hooks).sort(), [...HANDLED].sort()));

  it('matches every tool', () => {
    for (const event of TOOL_EVENTS) assert.equal(hooks[event][0].matcher, '*', event);
  });

  it('runs the reporter synchronously with a short timeout', () => {
    for (const [event, [group]] of Object.entries(hooks)) {
      const [handler] = group.hooks;
      assert.equal(handler.type, 'command', event);
      assert.equal(handler.async, undefined, `${event}: mcode rejects async hooks`);
      assert.equal(handler.command, 'node "${PLUGIN_ROOT}/scripts/herdr-report.mjs"', event);
      assert.ok(handler.timeout <= 5, event);
    }
  });
});
