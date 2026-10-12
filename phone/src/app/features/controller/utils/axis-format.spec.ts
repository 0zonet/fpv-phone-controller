import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatAxis } from './axis-format';

test('lecturas por eje con signo y dos decimales', () => {
  assert.equal(formatAxis(0), '+0.00');
  assert.equal(formatAxis(.426), '+0.43');
  assert.equal(formatAxis(-1), '\u22121.00');
  assert.equal(formatAxis(-0.001), '+0.00');
  assert.equal(formatAxis(NaN), '+0.00');
});
