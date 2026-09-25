// Windows speechSynthesis does not expose its audio samples. Keep the jaw
// moving between boundary events instead of leaving it fixed at one level.
export function nativeSpeechLevel(elapsedMs, charIndex = 0, text = '') {
  const index = Math.max(0, Math.min(text.length - 1, Math.floor(charIndex) || 0));
  const character = text[index] || 'a';
  const punctuation = /[,.!?;:]/.test(character) ? 0.5 : 1;
  const phase = elapsedMs * 0.0105 + index * 0.19;
  const syllable = Math.max(0, Math.sin(phase)) ** 1.35;
  const variation = 0.82 + 0.18 * Math.sin(elapsedMs * 0.0023 + index * 0.7);
  return Math.max(0, Math.min(1, (0.09 + syllable * 0.86 * variation) * punctuation));
}
