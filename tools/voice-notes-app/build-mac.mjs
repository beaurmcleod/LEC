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

// The production dependency tree, as npm resolves it ("/node_modules/@anthropic-ai/sdk", "/node_modules/standardwebhooks", ...).
const runtimeDeps = execFileSync('npm', ['ls', '--omit=dev', '--parseable', '--all'], { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim().replace(process.cwd(), ''))
  .filter((rel) => rel.startsWith('/node_modules/'));
// A node_modules path is kept when it is one of those packages, inside one, or a folder on the way to one.
const keepInBundle = (file) => runtimeDeps.some((dep) => file === dep || file.startsWith(`${dep}/`) || dep.startsWith(`${file}/`));
// Setup shows this, so you can tell which update is installed.
const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
fs.writeFileSync('src/build.js', `export default ${JSON.stringify({ commit, built: new Date().toISOString() })};\n`);
const [outDir] = await packager({
  dir: '.',
  out: 'dist',
  overwrite: true,
  platform: 'darwin',
  arch: process.arch,
  name: NAME,
  appBundleId: 'com.torreylabs.voicenotes',
  extendInfo: { NSMicrophoneUsageDescription: 'Records your personal line for each voice note.' },
  // node_modules only keeps what the app needs at runtime: the Anthropic SDK (replies) and what it loads.
  // Everything else in there is build tooling.
  ignore: (file) => /^\/dist($|\/)/.test(file) || /^\/build-mac\.mjs$/.test(file) || (/^\/node_modules\//.test(file) && !keepInBundle(file)),
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
console.log(`\nInstalled build ${commit}: ${dest}\nOpen it from Launchpad or Spotlight ("${NAME}"). Setup shows the build at the bottom.`);
