import { describe, it, expect } from 'vitest';
import { isFiniteNumber, isValidEmbeddingVector } from '../../utils/embedding';

describe('isFiniteNumber', () => {
  it('returns true for regular numbers', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(-1)).toBe(true);
    expect(isFiniteNumber(1.5)).toBe(true);
    expect(isFiniteNumber(1e10)).toBe(true);
  });

  it('returns false for NaN', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it('returns false for Infinity', () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it('returns false for null', () => {
    expect(isFiniteNumber(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isFiniteNumber(undefined)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isFiniteNumber('123')).toBe(false);
    expect(isFiniteNumber('')).toBe(false);
  });

  it('returns false for objects', () => {
    expect(isFiniteNumber({})).toBe(false);
    expect(isFiniteNumber([])).toBe(false);
  });

  it('returns false for booleans', () => {
    expect(isFiniteNumber(true)).toBe(false);
    expect(isFiniteNumber(false)).toBe(false);
  });
});

describe('isValidEmbeddingVector', () => {
  it('returns true for valid 1536-dim vector', () => {
    const vec = new Array(1536).fill(0.01);
    expect(isValidEmbeddingVector(vec)).toBe(true);
  });

  it('returns true for valid vector with custom dimension', () => {
    const vec = new Array(768).fill(0.1);
    expect(isValidEmbeddingVector(vec, 768)).toBe(true);
  });

  it('returns false for empty array', () => {
    expect(isValidEmbeddingVector([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isValidEmbeddingVector(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isValidEmbeddingVector(undefined)).toBe(false);
  });

  it('returns false for wrong dimension', () => {
    const vec = new Array(768).fill(0.1);
    expect(isValidEmbeddingVector(vec, 1536)).toBe(false);
  });

  it('returns false if vector contains NaN', () => {
    const vec = new Array(1536).fill(0.01);
    vec[100] = NaN;
    expect(isValidEmbeddingVector(vec)).toBe(false);
  });

  it('returns false if vector contains Infinity', () => {
    const vec = new Array(1536).fill(0.01);
    vec[200] = Infinity;
    expect(isValidEmbeddingVector(vec)).toBe(false);
  });

  it('returns false for zero-magnitude vector', () => {
    const vec = new Array(1536).fill(0);
    expect(isValidEmbeddingVector(vec)).toBe(false);
  });

  it('returns false for non-array input', () => {
    expect(isValidEmbeddingVector('not an array')).toBe(false);
    expect(isValidEmbeddingVector(123)).toBe(false);
    expect(isValidEmbeddingVector({})).toBe(false);
  });
});
