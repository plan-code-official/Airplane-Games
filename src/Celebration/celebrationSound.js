// This sound module is intentionally independent so a recorded effect can be
// substituted later without touching the celebration UI or game code.
import fireworksSoundUrl from './fireworks.mp3';

export function createCelebrationSound({ muted = false, soundUrl } = {}) {
  let context;
  let externalAudio;
  const activeNodes = new Set();

  const stop = () => {
    activeNodes.forEach(({ oscillator, gain }) => {
      try { oscillator.stop(); } catch (_) { /* node has already ended */ }
      oscillator.disconnect();
      gain.disconnect();
    });
    activeNodes.clear();

    if (externalAudio) {
      externalAudio.pause();
      externalAudio.currentTime = 0;
      externalAudio = null;
    }

    if (context) {
      context.close().catch(() => {});
      context = null;
    }
  };

  const start = () => {
    if (muted) return;

    try {
      externalAudio = new Audio(soundUrl || fireworksSoundUrl);
      externalAudio.preload = 'auto';
      externalAudio.volume = 0.2;
      externalAudio.play().catch(() => {});
    } catch (_) {
      // Sound is optional; browser autoplay restrictions must not affect play.
    }
  };

  return { start, burst: () => {}, stop };
}
