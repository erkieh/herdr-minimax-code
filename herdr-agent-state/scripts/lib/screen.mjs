// Recognises mcode TUI chrome in a pane's visible text. Anchors come from Herdr PR #2883's
// minimax detection manifest; they are UI labels, so chat prose is unlikely to match them.

const DIALOG_CHROME = [
  'enter confirm', // permission dialog footer
  'esc deny',
  'esc cancel', // ask_user question footer
  'keep answering', // "cancel question?" confirmation
  'use plan mode?',
  'ask ─', // ask_user dialog border: "╭─ Ask ───"
  'frozen runtime snapshot',
];

// Shown only while a turn runs: "⠧ Running 4s · … · Esc stop".
const RUN_FOOTER = /esc stop|(?:running|loading) \d/i;
const FOOTER_LINES = 8;

export const showsDialog = (screen) => {
  const text = screen.toLowerCase();
  return DIALOG_CHROME.some((chrome) => text.includes(chrome));
};

export const showsRunFooter = (screen) => RUN_FOOTER.test(screen.split('\n').slice(-FOOTER_LINES).join('\n'));
