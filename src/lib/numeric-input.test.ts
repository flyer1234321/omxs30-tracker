import assert from 'node:assert/strict';
import test from 'node:test';
import { formatNumericInput, parseNumericInput } from './numeric-input';

test('accepts Swedish decimal commas', () => {
  assert.equal(parseNumericInput('3,5'), 3.5);
  assert.equal(parseNumericInput('3.5'), 3.5);
});

test('treats incomplete input as no value instead of NaN', () => {
  assert.equal(parseNumericInput(''), undefined);
  assert.equal(parseNumericInput('3,'), undefined);
  assert.equal(parseNumericInput('-'), undefined);
  assert.equal(parseNumericInput('abc'), undefined);
});

test('formats numbers back with a comma', () => {
  assert.equal(formatNumericInput(3.5), '3,5');
  assert.equal(formatNumericInput(undefined), '');
});
