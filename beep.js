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
const adsr = (attack, decay, sustain, release) => ((start, length) => {
  const mslen = length * 1000;
  const amplAtEnd = (mslen < attack
                     ? (mslen / attack)
                     : (mslen < (attack + decay)
                        ? (1 - (1 - sustain) * ((mslen - attack) / decay))
                        : sustain));
  return (t) => {
    const at = (t - start) * 1000;
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

const decay = 500, env = adsr (200, 300, .6, decay);

const modulate = (wave1, wave2) => ((t) => wave1(t) * wave2(t));

const makeFloats = (waveFunction) => new Array(samples).fill(0).map ((_x,n) => waveFunction (n / sampleRate));
const makeSamples = (waveFunction) => makeFloats (waveFunction).map ((x) => Math.round (x * max));

const beepPitch = 441, beep = sawtoothWave (beepPitch);
const filename = 'beep.wav';

const beepEnv = env (0, secs - decay/1000);
const beepSamples = makeSamples (modulate (beep, beepEnv));
//console.log(makeFloats(beep).map((x,n)=>(1000*n/sampleRate)+': '+x+"\n").join(''));
//console.log(JSON.stringify(beepSamples));

wav.fromScratch (1, sampleRate, depth, beepSamples);
fs.writeFileSync(filename, wav.toBuffer());

exec (player + ' ' + filename);
