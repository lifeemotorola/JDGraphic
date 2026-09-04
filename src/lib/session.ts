/**
 * Session autosave — "continue where you left off".
 *
 * The studio quietly writes the current design to localStorage a moment after
 * it changes, and the home page offers to reopen it, so a half-finished carton
 * survives a refresh or an accidental tab close. Separate from the user
 * template library on purpose: a session is a *work in progress*, a saved
 * template is a deliberate, curated starting point.
 */
import { sanitizeDesign } from './library';
import type { Design } from './store';

export const SESSION_KEY = 'boxcraft.session.v1';

export interface SessionFile {
  savedAt: number;
  design: Design;
}

/** Persist the current design. Returns an error message, or null on success. */
export function saveSession(design: Design): string | null {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ savedAt: Date.now(), design }));
    return null;
  } catch {
    return 'Session autosave failed — browser storage is full or blocked.';
  }
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/** Latest autosaved session, sanitised so a stale/corrupt value can't crash the studio. */
export function readSession(): SessionFile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { savedAt?: unknown; design?: unknown };
    const design = sanitizeDesign(data?.design);
    if (!design) return null;
    return {
      savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
      design,
    };
  } catch {
    return null;
  }
}
