import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';

/**
 * Parse the .env file and return values for the requested keys.
 * Does NOT load anything into process.env — callers decide what to
 * do with the values. This keeps secrets out of the process environment
 * so they don't leak to child processes.
 */
export function readEnvFile(keys: string[]): Record<string, string> {
  const envFile = path.join(process.cwd(), '.env');
  let content: string;
  try {
    content = fs.readFileSync(envFile, 'utf-8');
  } catch (err) {
    logger.debug({ err }, '.env file not found, using defaults');
    return {};
  }

  const result: Record<string, string> = {};
  const wanted = new Set(keys);

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!wanted.has(key)) continue;
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (value) result[key] = value;
  }

  return result;
}

export function updateEnvFile(patch: Record<string, string | null | undefined>): void {
  const envFile = path.join(process.cwd(), '.env');
  let lines: string[] = [];

  try {
    lines = fs.readFileSync(envFile, 'utf-8').split('\n');
  } catch {
    lines = [];
  }

  const remaining = new Map(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );

  const nextLines = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return line;

      const key = line.slice(0, eqIdx).trim();
      if (!remaining.has(key)) return line;

      const value = remaining.get(key);
      remaining.delete(key);
      if (value === null) return null;
      return `${key}=${value}`;
    })
    .filter((line): line is string => line !== null);

  for (const [key, value] of remaining.entries()) {
    if (value === null) continue;
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(envFile, `${nextLines.join('\n').replace(/\n+$/g, '')}\n`);
}
