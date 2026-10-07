import planeEngineSound from '../assets/plane3.mp3';
import bulletShotSound from '../assets/shoot.mpeg?url';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private engineAudio: HTMLAudioElement | null = null;
  private bulletShotAudio: HTMLAudioElement | null = null;
  private questionAudio: HTMLAudioElement | null = null;
  private explosionBuffer: AudioBuffer | null = null;
  private lastLaserAt = 0;
  private lastExplosionAt = 0;
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
    if (mute) {
      this.stopEngine();
      this.stopQuestionAudio();
    } else {
      this.startEngine(200);
    }
  }

  getMuted() {
    return this.isMuted;
  }

  playSuccess() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (ascending major triad)

    notes.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + index * 0.1);

      gain.gain.setValueAtTime(0, now + index * 0.1);
      gain.gain.linearRampToValueAtTime(0.15, now + index * 0.1 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.1 + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + index * 0.1);
      osc.stop(now + index * 0.1 + 0.5);
    });
  }

  playFailure() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now); // A3
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.5); // Slide down to A2

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    // Apply lowpass filter to make it softer and buzzier
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  playWin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const melodies = [
      { f: 523.25, d: 0.15 }, // C5
      { f: 587.33, d: 0.15 }, // D5
      { f: 659.25, d: 0.15 }, // E5
      { f: 698.46, d: 0.15 }, // F5
      { f: 783.99, d: 0.3 },  // G5
      { f: 783.99, d: 0.15 }, // G5
      { f: 880.00, d: 0.15 }, // A5
      { f: 987.77, d: 0.15 }, // B5
      { f: 1046.50, d: 0.6 }  // C6
    ];

    let timeOffset = 0;
    melodies.forEach((note) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.f, now + timeOffset);

      gain.gain.setValueAtTime(0, now + timeOffset);
      gain.gain.linearRampToValueAtTime(0.15, now + timeOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + note.d);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + timeOffset);
      osc.stop(now + timeOffset + note.d);

      timeOffset += note.d - 0.02;
    });
  }

  playLose() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [392.00, 349.23, 311.13, 293.66, 261.63]; // Descending (G4, F4, Eb4, D4, C4)

    notes.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + index * 0.2);
      osc.frequency.linearRampToValueAtTime(freq - 20, now + index * 0.2 + 0.2);

      gain.gain.setValueAtTime(0.1, now + index * 0.2);
      gain.gain.linearRampToValueAtTime(0.08, now + index * 0.2 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.2 + 0.25);

      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(500, now + index * 0.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + index * 0.2);
      osc.stop(now + index * 0.2 + 0.3);
    });
  }

  startEngine(_altitude: number) {
    if (this.isMuted) return;
    try {
      if (!this.engineAudio) {
        this.engineAudio = new Audio(planeEngineSound);
        this.engineAudio.loop = true;
        this.engineAudio.preload = 'auto';
        this.engineAudio.volume = 0.14;
      }

      if (!this.engineAudio.paused) return;
      void this.engineAudio.play().catch(() => {
        // Browsers can defer playback until the next user gesture.
      });
    } catch (e) {
      console.error("Failed to start plane engine sound:", e);
    }
  }

  updateEnginePitch(_altitude: number) {
    // The recorded engine sound keeps a consistent pitch during flight.
  }

  stopEngine() {
    if (this.engineAudio) {
      this.engineAudio.pause();
      this.engineAudio.currentTime = 0;
    }
  }

  playBulletShot() {
    if (this.isMuted) return;

    try {
      if (!this.bulletShotAudio) {
        this.bulletShotAudio = new Audio(bulletShotSound);
        this.bulletShotAudio.preload = 'auto';
        this.bulletShotAudio.volume = 0.45;
      }

      this.bulletShotAudio.currentTime = 0;
      void this.bulletShotAudio.play().catch(() => {
        // Audio playback may be blocked until the browser receives a gesture.
      });
    } catch (error) {
      console.error('Failed to play bullet shot sound:', error);
    }
  }

  playLaser() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - this.lastLaserAt < 0.1) return;
    this.lastLaserAt = now;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playExplosion() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (now - this.lastExplosionAt < 0.12) return;
    this.lastExplosionAt = now;

    if (!this.explosionBuffer) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.4);
      this.explosionBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.explosionBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.explosionBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(10, now + 0.35);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    noise.start(now);
    noise.stop(now + 0.4);
  }

  // speakText removed

  stopQuestionAudio() {
    window.speechSynthesis?.cancel();
    if (this.questionAudio) {
      this.questionAudio.pause();
      this.questionAudio.currentTime = 0;
      this.questionAudio = null;
    }
  }

}

export const audio = new AudioSystem();
