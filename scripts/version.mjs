#!/usr/bin/env node
// Single source of truth is the VERSION file; every manifest below is synced from it.
// Usage: node scripts/version.mjs patch | set <x.y.z> | sync
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (p) => join(root, p);
const SEMVER = /^\d+\.\d+\.\d+$/;

const jsonManifests = ['package.json', 'frontend/package.json', 'src-tauri/tauri.conf.json'];
const jsonLocks = ['package-lock.json', 'frontend/package-lock.json'];
const cargoManifests = ['backend/Cargo.toml', 'src-tauri/Cargo.toml'];
const cargoLocks = [
  ['backend/Cargo.lock', 'respulse-api'],
  ['src-tauri/Cargo.lock', 'app'],
];

function replaceOnce(file, regex, version) {
  const src = readFileSync(path(file), 'utf8');
  if (!regex.test(src)) throw new Error(`version field not found in ${file}`);
  writeFileSync(path(file), src.replace(regex, `$1${version}$2`));
}

function sync(version) {
  for (const f of jsonManifests) replaceOnce(f, /("version":\s*")[^"]+(")/, version);
  for (const f of jsonLocks) {
    const lock = JSON.parse(readFileSync(path(f), 'utf8'));
    lock.version = version;
    lock.packages[''].version = version;
    writeFileSync(path(f), `${JSON.stringify(lock, null, 2)}\n`);
  }
  for (const f of cargoManifests) replaceOnce(f, /(^version\s*=\s*")[^"]+(")/m, version);
  for (const [f, name] of cargoLocks) {
    replaceOnce(f, new RegExp(`(name = "${name}"\\nversion = ")[^"]+(")`), version);
  }
  writeFileSync(path('VERSION'), `${version}\n`);
}

const current = readFileSync(path('VERSION'), 'utf8').trim();
const [cmd, arg] = process.argv.slice(2);
let next = current;
if (cmd === 'patch') {
  const [maj, min, pat] = current.split('.').map(Number);
  next = `${maj}.${min}.${pat + 1}`;
} else if (cmd === 'set') {
  next = arg;
} else if (cmd !== 'sync') {
  console.error('usage: version.mjs patch | set <x.y.z> | sync');
  process.exit(1);
}
if (!SEMVER.test(next)) throw new Error(`invalid version: ${next}`);
sync(next);
console.log(next);
