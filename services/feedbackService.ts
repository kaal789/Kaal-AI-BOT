
/**
 * Feedback Service for Sound and Haptics
 */

class FeedbackService {
  private audioCtx: AudioContext | null = null;

  private initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  // Haptic Feedback
  public vibrate(ms: number = 15) {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        // Silent catch for unsupported browsers/devices
      }
    }
  }

  // Synthesized UI Sounds
  public playSound(type: 'send' | 'receive' | 'click' | 'startup') {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (type === 'send') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'receive') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.15);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'startup') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.8);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.4);
        gain.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      }
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  }
}

export const feedback = new FeedbackService();
