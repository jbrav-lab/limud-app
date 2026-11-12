import { getData } from './store';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur);
}

export function play(kind: 'correct' | 'wrong' | 'levelup' | 'finish') {
  if (!getData().sound) return;
  try {
    ctx ??= new AudioContext();
    if (kind === 'correct') {
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.2);
    } else if (kind === 'wrong') {
      tone(220, 0, 0.25, 'triangle', 0.12);
    } else if (kind === 'levelup') {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.2));
    } else {
      [523, 659, 784, 659, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25));
    }
  } catch {
    /* audio not available */
  }
}
