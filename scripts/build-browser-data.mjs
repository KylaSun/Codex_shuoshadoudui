import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// The committed JS file runs in A's dependency-free browser app. Regenerate it
// after changing catalog.ts; the source of truth remains catalog.ts.
const source = readFileSync(new URL('../src/data/catalog.ts', import.meta.url), 'utf8');
const output = `// Generated from catalog.ts by scripts/build-browser-data.mjs. Do not edit by hand.\n${stripTypeScriptTypes(source, { mode: 'strip' })}`.replace(/[ \t]+$/gm, '');
writeFileSync(new URL('../src/data/catalog.js', import.meta.url), output);
