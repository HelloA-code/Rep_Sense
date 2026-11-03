// Spoken cues with the Web Speech API (built into browsers, works offline, no audio files).
// iOS only lets a page speak after a user gesture, so call unlockVoice() from a tap.

const VOICE_KEY = "repsense.voice";

export function voiceSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function loadVoiceOn(): boolean {
  try {
    return window.localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function saveVoiceOn(on: boolean) {
  try {
    window.localStorage.setItem(VOICE_KEY, on ? "on" : "off");
  } catch {
    // storage blocked
  }
}

export function speak(text: string) {
  if (!voiceSupported()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.lang = "en-US";
  window.speechSynthesis.cancel(); // a new cue replaces an old one rather than queueing
  window.speechSynthesis.speak(u);
}

/** Call from a click/tap handler once, before the first real cue. */
export function unlockVoice() {
  if (!voiceSupported()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

export function stopVoice() {
  if (voiceSupported()) window.speechSynthesis.cancel();
}
