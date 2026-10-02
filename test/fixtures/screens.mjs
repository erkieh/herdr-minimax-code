// Visible-pane text captured from mcode 0.6.2 in Herdr, trimmed to the lines that matter.

export const RUNNING_TURN = `
   › run the shell command: ls
  ◐ Tasks · 1 background active · /tasks details
    ⠧ Running 4s · Option+Enter queue · Enter steer · Ctrl+O details · Esc stop
    ────────────────────────────────────────────────────────────────────────────
  ›  Ask Mcode to do anything
    ────────────────────────────────────────────────────────────────────────────

  …/scratchpad/mtest │ Ask │ ✦ M3.1-Flash-Preview · Effort max │ Context 1M`;

// Narrow pane: the footer's trailing "Esc stop" can be cut off.
export const RUNNING_TURN_TRUNCATED = `
    ⠇ Loading 1min33s · ⚡ 148 tok/s · Option+Enter queue · Ent
    ──────────────────────────────────────────────────────────
  ›  Ask Mcode to do anything
    ──────────────────────────────────────────────────────────
  ~/IdeaProjects/chatgptexports │ Full access │ ✦ M3.1-Flash`;

export const IDLE_AFTER_TURN = `
  ● The working directory is empty — ls returned no output.
    If you want me to ask you something, say so and I will ask.
    └ Completed in 4s · ⚡ 120 tok/s
    Message · Enter send · Shift+Enter newline
    ────────────────────────────────────────────────────────────────────────────
  ›  Ask Mcode to do anything
    ────────────────────────────────────────────────────────────────────────────
  /private/tmp/mtest │ Full access │ ✦ M3.1-Flash-Preview · Effort max │ Context 98% left`;

export const INTERRUPTED_TURN = `
   › write a 3000 word essay about shells, no tools
    └ Interrupted after 4s
    Prompt · Enter send · Shift+Enter newline
    ────────────────────────────────────────────────────────────────────────────
  ›  write a 3000 word essay about shells, no tools
    ────────────────────────────────────────────────────────────────────────────
  mtest │ ◇ Offer REA… │ Ask │ ✦ M3.1-Flash-Preview · Eff max │ Context 98% left`;

export const PERMISSION_DIALOG = `
  │ Run this command?
  │   $ curl -sI https://example.com
  │   Why · Needs confirmation: No matching permission rule
  │ › › 1 Allow for this conversation
  │   2 Always allow matching actions
  │   3 Deny and guide MCode
  ├─────────────────────────────────────────────────────────────
  │ ↑/↓ choose · Enter confirm · Esc deny · Ctrl+C stop
  ╰─────────────────────────────────────────────────────────────`;

export const QUESTION_DIALOG = `
  ╭─ Ask ───────────────────────────────────────────── 1 of 1 ─╮
  │ Which README title do you want?                            │
  │ › 1  mcode                                                 │
  │   2  MiniMax Code                                          │
  │   3  Other…                                                │
  ├────────────────────────────────────────────────────────────┤
  │ ↑↓ move · 1-3 select · Enter send · Esc cancel             │
  ╰────────────────────────────────────────────────────────────╯`;

export const QUESTION_CANCEL_CONFIRM = `
  │ The pending request and its unsent answers will be discarded.
  ├────────────────────────────────────────────────────────────┤
  │ Enter cancel question · Esc keep answering                 │
  ╰────────────────────────────────────────────────────────────╯`;
