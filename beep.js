const fs = require('fs');
const { exec } = require('child_process');
const { WaveFile } = require('wavefile');

const player = 'afplay';

let wav = new WaveFile();
 
// Create a mono wave file, 44.1 kHz, 32-bit signed
const sampleRate = 44100, samplePeriod = 1 / sampleRate;
const depth = '32', max = 1 << 31;
const secs = 1, millisecs = secs * 1000, samples = sampleRate * secs;

// The actual frequency of the square wave function this generates is (sampleRate/period) where period=Math.round(sampleRate/freq)
// This keeps the implementation simple for this little test
const squareWave = (freq) => {
  const period = Math.round (sampleRate / freq);
  const halfPeriod = period / 2;
  return (t) => (((Math.round (t * sampleRate) % period) > halfPeriod) ? +1 : -1);
};

const sawtoothWave = (freq) => {
  const period = Math.round (sampleRate / freq);
  return (t) => 2 * (Math.round (t * sampleRate) % period) / period - 1;
};

const sineWave = (freq) => {
  const mul = 2 * Math.PI * freq;
  return (t) => Math.sin (mul * t);
};

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

const attack = 200, decay = 300, release = 500, env = adsr (attack, decay, .6, release), len = attack + decay + release;

const modulate = (wave1, wave2) => ((t) => wave1(t) * wave2(t));

const makeFloats = (waveFunction, nSamples) => {
  console.warn (`Creating ${nSamples} samples`);
  return new Array(nSamples).fill(0).map ((_x,n) => Math.max (-1, Math.min (1, waveFunction (n / sampleRate) || 0)));
};
const makeSamples = (waveFunction, nSamples) => makeFloats (waveFunction, nSamples).map ((x) => Math.round (x * max));

const mix = (notes) => makeSamples ((t) => notes.reduce ((x, note) => ((t >= note.start && t < note.start + note.length)
                                                                       ? (x + note.wave (t - note.start))
                                                                       : x), 0),
                                    notes.reduce ((maxLen, note) => Math.max (maxLen, note.start + note.length), 0) * sampleRate);

const a4Pitch = 440, e4Pitch = 330;
const beepEnv = env (secs - release/1000);
const notes = [{ start: 0, length: len/1000, wave: modulate (sawtoothWave (a4Pitch), beepEnv) },
               { start: .5, length: len/1000, wave: modulate (sawtoothWave (e4Pitch), beepEnv) }];

const beepSamples = mix (notes);
//console.log(makeFloats(beep).map((x,n)=>(1000*n/sampleRate)+': '+x+"\n").join(''));
//console.log(JSON.stringify(beepSamples));

wav.fromScratch (1, sampleRate, depth, beepSamples);

const filename = 'beep.wav';
fs.writeFileSync (filename, wav.toBuffer());
exec (player + ' ' + filename);
