class AudioSystem {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
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

  startEngine(altitude: number) {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      if (this.engineOsc) {
        this.updateEnginePitch(altitude);
        return;
      }

      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = 'triangle';
      
      // Calculate frequency: low altitude = lower frequency, high altitude = higher frequency hum!
      const targetFreq = 60 + (altitude / 100) * 40; // 60Hz to 100Hz
      this.engineOsc.frequency.setValueAtTime(targetFreq, this.ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.03, this.ctx.currentTime); // Low volume background hum

      // Lowpass filter to make it sound like a real distant propeller engine
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(150, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start(0);
    } catch (e) {
      console.error("Failed to start engine hum:", e);
    }
  }

  updateEnginePitch(altitude: number) {
    if (this.isMuted || !this.engineOsc || !this.ctx) return;
    const targetFreq = 60 + (altitude / 100) * 40;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.5);
  }

  stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch (e) {}
      this.engineGain = null;
    }
  }

  playLaser() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playExplosion() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
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
    
    noise.start(now);
    noise.stop(now + 0.4);
  }

  speakText(text: string, langCode: string = 'ar-SA', audioUrl?: string | null) {
    if (this.isMuted) return;
    try {
      window.speechSynthesis.cancel(); // Stop any ongoing speech

      if (audioUrl) {
        const audioObj = new Audio(audioUrl);
        audioObj.play().catch(e => {
          console.error("Audio playback failed:", e);
        });
      }
    } catch (e) {
      console.error("Speech synthesis/audio failed:", e);
    }
  }

}

export const audio = new AudioSystem();
