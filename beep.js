const fs = require('fs');
const { exec } = require('child_process');
const { WaveFile } = require('wavefile');

const player = 'afplay';

let wav = new WaveFile();
 
// Create a mono wave file, 44.1 kHz, 32-bit signed
const sampleRate = 44100, samplePeriod = 1 / sampleRate;
const depth = '32', max = 1 << 31;
const secs = 0.1, samples = sampleRate * secs;

// The actual frequency of the square wave function this generates is (sampleRate/period) where period=Math.round(sampleRate/freq)
// This keeps the implementation simple for this little test
const squareWave = (freq) => {
  const period = Math.round (sampleRate / freq);
  const halfPeriod = period / 2;
  return (n) => (((n % period) > halfPeriod) ? max : -max);
};

const beepPitch = 441, beep = squareWave (beepPitch);
const filename = 'beep.wav';

const beepSamples = new Array(samples).fill(0).map ((_x,n) => beep(n));
// console.log(JSON.stringify(beepSamples));

wav.fromScratch (1, sampleRate, depth, beepSamples);
fs.writeFileSync(filename, wav.toBuffer());

exec (player + ' ' + filename);
