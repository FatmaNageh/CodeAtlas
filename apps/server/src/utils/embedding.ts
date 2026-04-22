export function isFiniteNumber(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

export function isValidEmbeddingVector(
  vec: number[] | null | undefined,
  expectedDim?: number,
): vec is number[] {
  if (!Array.isArray(vec)) return false;
  if (vec.length === 0) return false;
  if (vec.some((v) => !isFiniteNumber(v))) return false;
  if (typeof expectedDim === 'number' && vec.length !== expectedDim) return false;
  const l2 = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
  if (!Number.isFinite(l2) || l2 <= 0) return false;
  return true;
}
