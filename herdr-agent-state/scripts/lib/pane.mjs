// Finds the Herdr pane an mcode hook belongs to. mcode runs hooks with a whitelisted environment that
// drops HERDR_PANE_ID, so match the pane whose shell is one of the hook's ancestor processes instead.

/** Parses `ps -axo pid=,ppid=` output into child pid → parent pid. */
export function parseParentMap(psOutput) {
  const parents = new Map();
  for (const line of psOutput.split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (pid) parents.set(pid, ppid);
  }
  return parents;
}

/** `pid` and its ancestors, stopping below init and on cycles. */
export function ancestorsOf(pid, parents) {
  const ancestors = new Set();
  for (let current = pid; current > 1 && !ancestors.has(current); current = parents.get(current)) {
    ancestors.add(current);
  }
  return ancestors;
}

/**
 * @param {{
 *   herdr: { listPaneIds(): string[], shellPid(pane: string): number },
 *   ancestors: Set<number>,
 *   hint?: string, // last pane found for this session; checked first to skip the full scan
 * }} options
 */
export function findPane({ herdr, ancestors, hint }) {
  const ownsPane = (pane) => {
    try {
      return ancestors.has(herdr.shellPid(pane));
    } catch {
      return false; // pane closed meanwhile
    }
  };
  if (hint && ownsPane(hint)) return hint;
  return herdr.listPaneIds().find(ownsPane);
}
