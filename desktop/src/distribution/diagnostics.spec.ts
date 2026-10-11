import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { userIssue } from './user-errors.js';
import { StructuredLogger } from './structured-logger.js';
test('actionable startup errors never expose technical stacks', () => {
  const cases: [unknown, string][] = [
    [Object.assign(new Error('listen stack secret'), {code:'EADDRINUSE'}), 'PORT_BUSY'],
    [new Error('vJoy device 1 is not free.'), 'DEVICE_BUSY'],
    [new Error('vJoyInterface.dll not found'), 'DRIVER_MISSING'],
    [new Error('vJoy device 1 is missing.'), 'DEVICE_UNAVAILABLE'],
    [new Error('vJoy axis roll is missing.'), 'DEVICE_UNAVAILABLE'],
    [new Error('vJoy driver and SDK DLL versions do not match.'), 'DRIVER_MISMATCH'],
    [Object.assign(new Error('private details'), {code:'EACCES'}), 'NETWORK_PERMISSION'],
    [new Error('private details'), 'STARTUP_FAILED']
  ];
  for (const [error, code] of cases) {
    assert.equal(userIssue(error).code, code);
    assert.doesNotMatch(userIssue(error).message, /stack secret|private details/);
  }
});
test('structured logs redact tokens and rotate with bounded retention', () => {
  const base = fileURLToPath(new URL('../../../work/', import.meta.url));
  mkdirSync(base, {recursive:true});
  const directory = mkdtempSync(join(base, 'fpv-logs-'));
  try {
    const logger = new StructuredLogger(directory, '0.4.0-beta.1', 180);
    logger.write('startup', {endpoint:'ws://192.168.1.2/?token=' + 'a'.repeat(48)});
    const first = readFileSync(join(logger.directory, 'companion.jsonl'), 'utf8');
    assert.equal(JSON.parse(first).version, '0.4.0-beta.1'); assert.doesNotMatch(first, /a{48}/);
    for (let i=0;i<20;i++) logger.write('phone_connected', {detail:'b'.repeat(100)});
    assert.ok(readdirSync(logger.directory).length <= 5);
    assert.equal(logger.available, true, logger.failure);
  } finally {
    assert.ok(directory.startsWith(base), 'Test cleanup must remain in the workspace work directory');
    rmSync(directory, {recursive:true,force:true});
  }
});
