import { createHash } from 'node:crypto';

/** Deterministic JSON: object keys sorted recursively so the same data always hashes the same. */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

export const sha256 = (input: string): string => createHash('sha256').update(input).digest('hex');
export const hashObject = (value: unknown): string => sha256(canonicalize(value));
