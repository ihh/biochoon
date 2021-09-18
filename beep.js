const fs = require('fs');
const { exec } = require('child_process');
const { WaveFile } = require('wavefile');

const player = 'afplay';

let wav = new WaveFile();
 
// Create a mono wave file, 44.1 kHz, 32-bit
const rate = 44100, depth = '32', max = 1 << 31;
const secs = 0.1, samples = rate * secs;

const squareWave = (freq) => {
  const period = rate / freq;
  const halfPeriod = period / 2;
  return (n) => (((n % period) > halfPeriod) ? max : -max);
};
const beepPitch = 441, beep = squareWave (beepPitch);
const filename = 'beep.wav';

const beepSamples = new Array(samples).fill(0).map ((_x,n) => beep(n));
// console.log(JSON.stringify(beepSamples));

wav.fromScratch (1, rate, depth, beepSamples);
fs.writeFileSync(filename, wav.toBuffer());

exec (player + ' ' + filename);
