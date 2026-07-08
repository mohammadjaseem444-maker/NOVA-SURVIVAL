/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Procedural audio synthesizer for offline 3D Battle Royale using Web Audio API

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const SOUND_SYSTEM = {
  setVolume(vol: number): void {
    const ctx = getAudioContext();
    if (masterGain) {
      masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, vol)), ctx.currentTime);
    }
  },

  playClick(): void {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      if (masterGain) gain.connect(masterGain);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Ignored if browser blocks audio
    }
  },

  playShot(weaponType: string): void {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Bullet white noise burst
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';

      const noiseGain = ctx.createGain();

      // Sharp sine transient for weapon crack
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      if (weaponType === 'Sniper') {
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        oscGain.gain.setValueAtTime(1.0, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      } else if (weaponType === 'Shotgun') {
        noiseFilter.frequency.setValueAtTime(800, now);
        noiseGain.gain.setValueAtTime(1.0, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        oscGain.gain.setValueAtTime(1.2, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      } else if (weaponType === 'RPG') {
        noiseFilter.frequency.setValueAtTime(400, now);
        noiseGain.gain.setValueAtTime(1.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(20, now + 0.4);
        oscGain.gain.setValueAtTime(1.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      } else { // AR or SMG
        noiseFilter.frequency.setValueAtTime(1500, now);
        noiseGain.gain.setValueAtTime(0.5, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
        oscGain.gain.setValueAtTime(0.6, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      }

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      if (masterGain) noiseGain.connect(masterGain);

      osc.connect(oscGain);
      if (masterGain) oscGain.connect(masterGain);

      noiseNode.start(now);
      osc.start(now);

      noiseNode.stop(now + 0.5);
      osc.stop(now + 0.5);
    } catch (e) {
      // Audio context might be suspended
    }
  },

  playReload(): void {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Double-click sound to mimic inserting magazine
      const playClickAt = (time: number, freq: number, length: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(freq, time);
        osc.frequency.exponentialRampToValueAtTime(freq / 2, time + length);

        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + length);

        osc.connect(gain);
        if (masterGain) gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + length);
      };

      playClickAt(now, 1200, 0.08);
      playClickAt(now + 0.18, 1400, 0.08);
      playClickAt(now + 0.35, 1000, 0.1);
    } catch (e) {}
  },

  playHitMarker(isHeadshot: boolean): void {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = isHeadshot ? 1500 : 900;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.setValueAtTime(freq * 1.2, ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      if (masterGain) gain.connect(masterGain);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  },

  playHeal(): void {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.4);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

      osc.connect(gain);
      if (masterGain) gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {}
  },

  playExplosion(): void {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Heavy brown-noise/red-noise explosion block
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Filter white to brown/red noise (weighted low pass)
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Amplify
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.6);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.8, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

      noiseNode.connect(filter);
      filter.connect(gain);
      if (masterGain) gain.connect(masterGain);

      // Low end boom oscillator
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.frequency.setValueAtTime(90, now);
      boom.frequency.linearRampToValueAtTime(10, now + 0.4);

      boomGain.gain.setValueAtTime(1.5, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      boom.connect(boomGain);
      if (masterGain) boomGain.connect(masterGain);

      noiseNode.start(now);
      boom.start(now);

      noiseNode.stop(now + 0.8);
      boom.stop(now + 0.8);
    } catch (e) {}
  },

  playStormWarning(): void {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(120, now);
      osc1.frequency.linearRampToValueAtTime(110, now + 1.0);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(122, now);
      osc2.frequency.linearRampToValueAtTime(112, now + 1.0);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.3);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      if (masterGain) gain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);

      osc1.stop(now + 1.0);
      osc2.stop(now + 1.0);
    } catch (e) {}
  },
};
