# Herdr agent state for MiniMax Code

Show [MiniMax Code](https://github.com/MiniMax-AI/minimax-code) (`mcode`) sessions in [Herdr](https://herdr.dev) as **working**, **blocked** or **idle**, just like the agents Herdr supports natively.

This is a small mcode plugin. It needs no changes to Herdr or mcode: mcode's hooks report each state change to the Herdr pane they run in, using Herdr's public `herdr pane report-agent` API.

```text
you type a prompt      →  working
mcode asks to run curl →  blocked   "Approval needed: bash"
mcode asks a question  →  blocked
turn finishes          →  idle
you quit mcode         →  pane released
```

## Requirements

- macOS or Linux
- [Herdr](https://herdr.dev) 0.9.2 or later, with `herdr` on your `PATH`
- [MiniMax Code](https://github.com/MiniMax-AI/minimax-code) (tested with 0.6.2)
- Node.js 20 or later (mcode already needs it)

## Install

Copy the plugin folder into mcode's local plugin directory:

```bash
git clone https://github.com/erkieh/herdr-minimax-code.git
cp -R herdr-minimax-code/herdr-agent-state ~/.minimax/plugins/
```

Check that mcode found it:

```bash
mcode plugin list --marketplace local
# [*] herdr-agent-state@local	enabled
```

A few things to know:
- Copy the folder rather than symlinking it, because mcode ignores symlinked plugins.
- If your plugin directory is somewhere else, `mcode plugin marketplace list` shows the right path.
- mcode sessions that are already running pick the plugin up on their next hook event.

## Usage

Run `mcode` in any Herdr pane, as usual. The pane shows up as `minimax` once you send the first prompt, and its state follows the session from then on.

When mcode reports a session, it also tells Herdr how to reopen it (`mcode --session <id>`). Herdr can use that to resume the session after a server restart.

### What gets reported

| In mcode | In Herdr |
|---|---|
| A prompt is sent, or a tool runs | `working` |
| A tool needs your approval | `blocked`, with "Approval needed: *tool*" |
| A question or plan-mode dialog is open | `blocked` |
| The turn finishes, or you interrupt it with Esc | `idle` |
| You quit mcode | the pane is released |

## Uninstall

```bash
mcode plugin remove herdr-agent-state@local
```

You can also just delete `~/.minimax/plugins/herdr-agent-state`.

## How it works

mcode runs [hooks](https://github.com/MiniMax-AI/minimax-code/blob/main/docs/hooks.md) on session, prompt, tool and stop events. The plugin's hook script turns each event into a Herdr report. Two parts of mcode needed workarounds.

**Finding the pane.** Herdr gives every pane a `HERDR_PANE_ID` variable, but mcode starts hooks with a cut-down environment that drops it. Instead, the script looks at its own parent processes and picks the Herdr pane whose shell is one of them (`herdr pane process-info`). It remembers the pane per session, so later hooks skip the search.

**Changes that fire no hook.** A few state changes never reach a hook, so a short-lived background watcher reads the pane's screen instead:

- **Interrupting a turn with Esc** doesn't fire `Stop`. While a turn runs, a watcher waits for mcode's `Esc stop` footer to disappear, then reports `idle`, or `blocked` if a dialog is showing.
- **Question dialogs** open only after the turn has ended, and cancelling one fires nothing. After each turn, a watcher reports `blocked` while a dialog is on screen and `idle` once it closes.

The watchers recognise dialogs by their labels (*Enter confirm*, *Esc cancel*, the *Ask* border and so on). These labels come from the detection rules in [Herdr PR #2883](https://github.com/herdrdev/herdr/pull/2883). The watchers exit as soon as a real hook report takes over.

The script never slows mcode down or breaks it:
- Reports are sent from a detached process.
- Every error is ignored.
- Nothing is written to stdout, because mcode would read that as a hook decision.

## Known limitations

- The pane shows up only after your first prompt, because mcode starts the session lazily.
- After you deny an approval, the pane stays `blocked` for a few seconds until mcode finishes its reply.
- The plan-mode dialog (*Use Plan mode?*) is recognised but hasn't been tested live.
- Resuming after a Herdr server restart hasn't been tested end to end. Herdr accepts the resume command, and `mcode --session <id>` does reopen the session.
- Watcher reports don't include the resume command. Only reports sent by hooks do.
- `herdr agent start --kind minimax` doesn't work, because that would need native support in Herdr itself.

## Development

The tests use Node's built-in test runner and need no dependencies:

```bash
npm test
```

They cover each module on its own, the plugin package rules mcode enforces when loading a plugin, and an end-to-end run of the hook script against a fake `herdr` binary. The screen fixtures are text captured from real mcode sessions.

After changing the plugin, copy it into place again and restart mcode:

```bash
rm -rf ~/.minimax/plugins/herdr-agent-state && cp -R herdr-agent-state ~/.minimax/plugins/
```

### Project layout

```text
herdr-agent-state/              the plugin; this folder is what you install
├── .minimax-plugin/plugin.json plugin manifest
├── hooks/herdr.json            which mcode hooks run the script
├── assets/icon.png
└── scripts/
    ├── herdr-report.mjs        hook entry point; connects the modules below
    └── lib/
        ├── hooks.mjs           hook event → what to tell Herdr
        ├── herdr.mjs           herdr CLI arguments and JSON client
        ├── pane.mjs            finds the pane from the process tree
        ├── screen.mjs          recognises mcode footers and dialogs
        ├── monitors.mjs        screen watchers for changes without a hook
        └── io.mjs              everything that touches processes and files
test/                           tests; not shipped with the plugin
```

Only `io.mjs` and the entry point touch the outside world. Every other module takes its dependencies as arguments, so tests can pass in fakes.

## License

[MIT](LICENSE)
