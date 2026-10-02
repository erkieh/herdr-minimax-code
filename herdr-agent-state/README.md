# herdr-agent-state for MiniMax Code

A MiniMax Code (`mcode`) plugin that reports its state to [Herdr](https://herdr.dev) through `herdr pane report-agent`, so Herdr shows `minimax` panes as working, blocked or idle. No Herdr changes needed.

## Install

```bash
cp -R herdr-agent-state ~/.minimax/plugins/
mcode plugin list --marketplace local   # should list herdr-agent-state, enabled
```

Copy the directory itself; mcode ignores symlinks. Find the local plugin directory with `mcode plugin marketplace list` if yours differs. Running mcode sessions pick it up on their next hook event.

Requires `node` and `herdr` on `PATH`, macOS or Linux.

## What it reports

| Trigger | Herdr state |
|---|---|
| `UserPromptSubmit`, `PreToolUse`, `PostToolUse` | `working` |
| `PermissionRequest` | `blocked` ("Approval needed: <tool>") |
| `SessionStart`, `Stop` | `idle` |
| `SessionEnd` (exit) | `release-agent` |
| Question / plan dialog on screen | `blocked` |
| Turn interrupted with Esc | `idle` |

Every report carries the resume command `mcode --session <id>`. Herdr accepts it, and `mcode --session <id>` reopens the session. A full Herdr server restart was not tested.

## How it works

- **Finding the pane.** mcode runs hooks with a whitelisted environment, so `HERDR_PANE_ID` isn't visible. The script walks its ancestor processes and picks the Herdr pane whose `shell_pid` (`herdr pane process-info`) is one of them. It caches the result per session under the plugin data dir.
- **Screen fallbacks.** Some transitions fire no hook, so a detached helper reads the pane footer:
  - **Interrupted turns.** mcode fires no `Stop` when you press Esc. While the pane is `working`, a watcher (one per pane) reports `idle` once the `Esc stop` / `Running` footer has been gone for 2 seconds.
  - **Question dialogs.** `ask_user` ends the turn before its dialog appears. After `Stop`, a one-shot check reports `blocked` while the dialog is on screen and `idle` once it closes. Cancelling a question fires no hook either.
  - **Matching.** The dialog strings are the ones from Herdr PR #2883's detection manifest.
- **Never blocking mcode.** Reports run detached and every error is swallowed. The script never writes to stdout, because mcode would read that as a hook decision.

## Known limits

- Herdr shows the pane only after the first prompt, because mcode fires `SessionStart` lazily.
- After you deny an approval, the pane stays `blocked` until the model finishes its reply (a few seconds).
- The plan-mode dialog (`Use Plan mode?`) is matched but was not tested live.
- The pane label is `minimax`, but `herdr agent start --kind minimax` needs native Herdr support.
