import { hapticError, hapticSuccess } from './haptics';

export type ToastType = 'success' | 'error';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

// Single active listener rather than a subscriber list: exactly one <Toast />
// host is mounted, in the root layout (see api.ts's setTokensChangedListener
// for the same pattern).
type ToastListener = (toast: ToastMessage) => void;
let listener: ToastListener | null = null;
let nextId = 0;

export function setToastListener(fn: ToastListener | null): void {
  listener = fn;
}

// Plain function rather than a context/hook so it can be called from
// non-component code too (e.g. auth.tsx's guest-sync failure notice).
//
// Also fires the matching haptic (6-7) here, rather than at each of the
// ~10 call sites — every existing showToast('エラー', ...) call already
// gets an error buzz for free this way, and any new one will too without
// having to remember it.
export function showToast(title: string, message: string, type: ToastType = 'error'): void {
  if (type === 'success') hapticSuccess();
  else hapticError();
  listener?.({ id: ++nextId, type, title, message });
}
