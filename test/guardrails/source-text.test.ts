import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const DIRS = ['src', 'build', 'scripts', 'e2e', 'test', 'display', 'fleet'];
const EXTENSIONS = /\.(ts|tsx|js|json|css|html|md)$/u;

/**
 * Bidi controls are invisible and can make source read differently from how
 * it runs ("Trojan Source", CVE-2021-42574). Write them as \u escapes.
 */
const BIDI_CONTROLS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/u;

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (EXTENSIONS.test(entry.name)) yield path;
  }
}

describe('source text', () => {
  it('contains no literal bidi control characters', async () => {
    const offenders: string[] = [];
    const files = [join(root, 'index.html'), join(root, 'README.md')];
    for (const dir of DIRS) for await (const f of walk(join(root, dir))) files.push(f);
    for (const file of files) {
      let text: string;
      try {
        text = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      text.split('\n').forEach((line, i) => {
        if (BIDI_CONTROLS.test(line)) offenders.push(`${relative(root, file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
