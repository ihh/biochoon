const fs = require('fs');
const { exec } = require('child_process');
const { WaveFile } = require('wavefile');

const player = 'afplay';

let wav = new WaveFile();
 
// Create a mono wave file, 44.1 kHz, 32-bit signed
const sampleRate = 44100, samplePeriod = 1 / sampleRate;
const depth = '32', max = 1 << 31;

const halfPeriod = Math.PI, period = 2 * halfPeriod;
const waveform = {
  'square': (phase) => phase > halfPeriod ? +1 : -1,
  'sawtooth': (phase) => 1 - (2 * phase / period),
  'sine': (phase) => Math.sin (phase)
};

const freqMod = (wave, freqEnv) => {
  let tLast = 0, phase = 0;
  return (t) => {
    if (t < tLast)
      throw new Error ("Frequency-modulated function must be called monotonically")
    if (t > tLast) {
      const freq = freqEnv (t);
      phase += period * freq * (t - tLast);
      while (phase > period)
        phase -= period;
      tLast = t;
    }
    return wave (phase);
  };
};

const fixedFreq = (wave, freq) => freqMod (wave, (t) => freq);

const semitoneMultiplier = Math.pow (2, 1/12);
const risingFreq = (wave, freq, semitonesPerSec) => freqMod (wave, (t) => freq * Math.pow (semitoneMultiplier, t * semitonesPerSec));

// attack, decay, length, release are in milliseconds
const adsr = (attack, decay, sustain, release) => ((length) => {
  const mslen = length * 1000;
  const amplAtEnd = (mslen < attack
                     ? (mslen / attack)
                     : (mslen < (attack + decay)
                        ? (1 - (1 - sustain) * ((mslen - attack) / decay))
                        : sustain));
  return (t) => {
    const at = t * 1000;
    if (at < 0) return 0;
    const dt = at - attack, rt = at - mslen;
    return (rt > 0
            ? (rt > release
               ? 0
               : (amplAtEnd * (1 - (rt / release))))
            : (at < 0
               ? 0
               : (dt < 0
                  ? (at / attack)
                  : (dt < decay
                     ? (1 - (1 - sustain) * (dt / decay))
                     : sustain))));
  };
});

const attack = 200, decay = 300, release = 500, env = adsr (attack, decay, .6, release);

const modulate = (wave1, wave2) => ((t) => wave1(t) * wave2(t));

const makeFloats = (waveFunction, nSamples) => {
  console.warn (`Creating ${nSamples} samples`);
  return new Array(nSamples).fill(0).map ((_x,n) => Math.max (-1, Math.min (1, waveFunction (n / sampleRate) || 0)));
};
const makeSamples = (waveFunction, nSamples) => makeFloats (waveFunction, nSamples).map ((x) => Math.round (x * max));

const mix = (notes) => makeSamples ((t) => notes.reduce ((x, note) => ((t >= note.start && t < note.start + note.length)
                                                                       ? (x + note.wave (t - note.start))
                                                                       : x), 0),
                                    Math.ceil (notes.reduce ((maxLen, note) => Math.max (maxLen, note.start + note.length), 0) * sampleRate));

const a4Pitch = 440, e4Pitch = 330, a3Pitch = 220;
const lengthWithoutRelease = attack + decay*2, length = (lengthWithoutRelease + release) / 1000, beepEnv = env (lengthWithoutRelease);
const notes = [{ start: 0, length, wave: modulate (fixedFreq (waveform.sine, a4Pitch), beepEnv) },
               { start: .5, length, wave: modulate (fixedFreq (waveform.sawtooth, e4Pitch), beepEnv) },
               { start: .75, length, wave: modulate (risingFreq (waveform.square, a3Pitch, 3 / length), beepEnv) }];

const beepSamples = mix (notes);
//console.log(makeFloats(beep).map((x,n)=>(1000*n/sampleRate)+': '+x+"\n").join(''));
//console.log(JSON.stringify(beepSamples));

wav.fromScratch (1, sampleRate, depth, beepSamples);

const filename = 'beep.wav';
fs.writeFileSync (filename, wav.toBuffer());
exec (player + ' ' + filename);
