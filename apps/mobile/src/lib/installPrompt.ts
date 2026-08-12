import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 7-10: prompting a guest to add this to their home screen serves two
// purposes at once — it makes navigator.storage.persist() (see
// storagePersistence.ts) more likely to be granted, and it raises the
// chance they come back within Safari's 7-day eviction window in the first
// place. Shown once a guest has a few records worth protecting, not at
// launch (see maybeShowInstallPrompt).

const DISMISSED_AT_STORAGE_KEY = 'pokelids_install_prompt_dismissed_at';
// "しばらく" (7-10) rather than never-again — a guest who dismissed this
// with 3 records might feel differently with 20. Two weeks, not e.g. a
// day, so it doesn't feel like nagging.
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const RECORD_COUNT_THRESHOLD = 3;

export type InstallPromptKind = 'native' | 'ios-manual' | 'unavailable';

// Not in TS's DOM lib (still a draft/non-standard event in most specs).
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-scope, not component state: Chrome fires `beforeinstallprompt` at
// most once per page load, and only shows its own default mini-infobar if
// nothing called preventDefault() on it in time. Capturing it here — as
// early as this module is first imported, which app/_layout.tsx does at
// the app's root — means it's ready and deferred *before* any component
// decides whether/when to actually show this app's own prompt UI.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    installedThisSession = true;
    deferredPrompt = null;
  });
}

function isRunningStandalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  // iOS Safari's own (non-standard, but the only signal it gives) flag for
  // "launched from the home screen icon."
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return installedThisSession || iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

// There's no feature-detection alternative for "is this iOS Safari":
// beforeinstallprompt simply never fires there, which on its own is
// indistinguishable from "Chrome hasn't decided this is installable yet."
// UA sniffing is the only way to tell those two apart, which is exactly
// why this is the one place in the app that does it.
//
// iPadOS 13+ reports a desktop "Macintosh" UA by default (no "iPad" in the
// string at all) unless the user has switched to "Request Mobile
// Website" — maxTouchPoints > 1 is the standard way to tell an iPad apart
// from an actual Mac in that case, since Macs don't have a touchscreen.
function isIOSSafari(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIPhoneOrIPod = /iPhone|iPod/.test(ua);
  const isMasqueradingIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isIPhoneOrIPod || /iPad/.test(ua) || isMasqueradingIPad;
}

// Which variant of the install-prompt UI to show, if any — the caller
// (InstallPrompt.tsx) branches its whole render on this.
export function getInstallPromptKind(): InstallPromptKind {
  if (Platform.OS !== 'web' || isRunningStandalone()) return 'unavailable';
  if (deferredPrompt) return 'native';
  if (isIOSSafari()) return 'ios-manual';
  // Android/desktop Chrome before beforeinstallprompt has fired yet, or a
  // browser (Firefox, non-Safari-non-Chrome) with no installable-PWA
  // concept at all — nothing to offer either way.
  return 'unavailable';
}

// Only valid to call when getInstallPromptKind() === 'native'. Returns
// whether the user accepted, purely for the caller's own UI/analytics
// purposes — the actual install (if accepted) happens without further
// action needed here.
export async function triggerNativeInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const event = deferredPrompt;
  // A captured beforeinstallprompt event can only be prompted once.
  deferredPrompt = null;
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome === 'accepted';
}

export async function dismissInstallPrompt(): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_AT_STORAGE_KEY, String(Date.now()));
}

async function isDismissedRecently(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(DISMISSED_AT_STORAGE_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
}

// Mirrors toast.ts's single-listener pattern: exactly one <InstallPrompt />
// is mounted, at the app root (see app/_layout.tsx).
type ShowListener = () => void;
let listener: ShowListener | null = null;

export function setInstallPromptListener(fn: ShowListener | null): void {
  listener = fn;
}

// Called after a guest record is created or updated (poke-lids/[id].tsx),
// passing the fresh guest-collection count from right after that write —
// not on a timer or an app-launch check, so this only ever runs right
// after an action that could plausibly have just crossed the threshold,
// matching "案内する" being tied to *reaching* 3 records, not merely
// *having* 3 on some unrelated screen visit.
export async function maybeShowInstallPrompt(guestRecordCount: number): Promise<void> {
  if (guestRecordCount < RECORD_COUNT_THRESHOLD) return;
  if (getInstallPromptKind() === 'unavailable') return;
  if (await isDismissedRecently()) return;
  listener?.();
}
