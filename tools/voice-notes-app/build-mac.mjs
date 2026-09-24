// Builds "Torrey Voice Notes.app" for this Mac and installs it in Applications.
import { packager } from '@electron/packager';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'darwin') {
  console.error('Run this on your Mac.');
  process.exit(1);
}

const NAME = 'Torrey Voice Notes';
const [outDir] = await packager({
  dir: '.',
  out: 'dist',
  overwrite: true,
  platform: 'darwin',
  arch: process.arch,
  name: NAME,
  appBundleId: 'com.torreylabs.voicenotes',
  extendInfo: { NSMicrophoneUsageDescription: 'Records your personal line for each voice note.' },
  // No runtime dependencies, so node_modules only holds build tools.
  ignore: [/^\/dist($|\/)/, /^\/node_modules($|\/)/, /^\/build-mac\.mjs$/],
});
const bundle = path.join(outDir, `${NAME}.app`);
execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'inherit' });

let dest = path.join('/Applications', `${NAME}.app`);
try {
  fs.rmSync(dest, { recursive: true, force: true });
  execFileSync('ditto', [bundle, dest]);
} catch {
  dest = path.join(os.homedir(), 'Applications', `${NAME}.app`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.rmSync(dest, { recursive: true, force: true });
  execFileSync('ditto', [bundle, dest]);
}
console.log(`\nInstalled: ${dest}\nOpen it from Launchpad or Spotlight ("${NAME}").`);
