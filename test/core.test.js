import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeAttributes,
  sanitizeAttribute,
  isAttributeKeyValid,
  coerceValue
} from '../src/index.js';

test('isAttributeKeyValid: accepts printable non-space ASCII', () => {
  assert.equal(isAttributeKeyValid('http.method'), true);
  assert.equal(isAttributeKeyValid('A!@#$%^&*()_+'), true);
});

test('isAttributeKeyValid: rejects empty and non-strings', () => {
  assert.equal(isAttributeKeyValid(''), false);
  assert.equal(isAttributeKeyValid(123), false);
  assert.equal(isAttributeKeyValid(null), false);
});

test('isAttributeKeyValid: rejects space and control characters', () => {
  assert.equal(isAttributeKeyValid('with space'), false);
  assert.equal(isAttributeKeyValid('tab\there'), false);
});

test('isAttributeKeyValid: rejects non-ASCII unicode', () => {
  assert.equal(isAttributeKeyValid('café'), false);
  assert.equal(isAttributeKeyValid('日本語'), false);
});

test('coerceValue: passes through finite numbers, strings, booleans', () => {
  assert.equal(coerceValue(42), 42);
  assert.equal(coerceValue('hi'), 'hi');
  assert.equal(coerceValue(true), true);
});

test('coerceValue: rejects non-finite numbers', () => {
  assert.equal(coerceValue(NaN), null);
  assert.equal(coerceValue(Infinity), null);
  assert.equal(coerceValue(-Infinity), null);
});

test('coerceValue: coerces in-range BigInt to Number', () => {
  assert.equal(coerceValue(BigInt(5)), 5);
  assert.equal(coerceValue(BigInt(-5)), -5);
});

test('coerceValue: rejects out-of-range BigInt', () => {
  assert.equal(coerceValue(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)), null);
});

test('sanitizeAttribute: scalar happy path', () => {
  assert.deepEqual(sanitizeAttribute('count', 10), 10);
  assert.deepEqual(sanitizeAttribute('name', 'x'), 'x');
  assert.deepEqual(sanitizeAttribute('ok', true), true);
});

test('sanitizeAttribute: homogeneous array passes', () => {
  assert.deepEqual(sanitizeAttribute('tags', ['a', 'b']), ['a', 'b']);
  assert.deepEqual(sanitizeAttribute('nums', [1, 2, 3]), [1, 2, 3]);
});

test('sanitizeAttribute: heterogeneous array dropped', () => {
  assert.equal(sanitizeAttribute('mixed', [1, 'two']), null);
});

test('sanitizeAttribute: empty array dropped (no element type)', () => {
  assert.equal(sanitizeAttribute('empty', []), null);
});

test('sanitizeAttribute: array containing NaN is dropped', () => {
  assert.equal(sanitizeAttribute('bad', [1, NaN]), null);
});

test('sanitizeAttribute: BigInt mixed with Number counts as homogeneous', () => {
  // BigInt coerces to number; arrays of mixed BigInt/Number are homogeneous.
  assert.deepEqual(sanitizeAttribute('k', [BigInt(1), 2]), [1, 2]);
});

test('sanitizeAttribute: invalid key returns null', () => {
  assert.equal(sanitizeAttribute('with space', 1), null);
  assert.equal(sanitizeAttribute('', 1), null);
});

test('sanitizeAttribute: null and undefined values return null', () => {
  assert.equal(sanitizeAttribute('k', null), null);
  assert.equal(sanitizeAttribute('k', undefined), null);
});

test('sanitizeAttributes: drops invalid keys and values, keeps valid', () => {
  const out = sanitizeAttributes({
    'good': 1,
    'bad key': 2,
    'nan': NaN,
    'str': 'ok',
    'arr': [1, 2],
    'mixed': [1, 'x'],
  });
  assert.deepEqual(out, { good: 1, str: 'ok', arr: [1, 2] });
});

test('sanitizeAttributes: does not mutate input', () => {
  const input = { a: 1 };
  const out = sanitizeAttributes(input);
  out.a = 99;
  assert.equal(input.a, 1);
});

test('sanitizeAttributes: non-object input returns empty object', () => {
  assert.deepEqual(sanitizeAttributes(null), {});
  assert.deepEqual(sanitizeAttributes('x'), {});
});
