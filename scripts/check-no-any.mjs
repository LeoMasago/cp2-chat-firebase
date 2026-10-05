// Falha se encontrar `any` explícito no código TypeScript do app ou da API
// (requisito do enunciado: "É proibido utilizar any").
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['App.tsx', 'index.ts', 'app.config.js', 'src', 'server/src', 'server/test'];
const ignoredDirs = new Set(['node_modules', 'dist']);
const pattern = /(:\s*any\b|<any\b|\bas\s+any\b|\bany\[\]|Array<any>|\(\s*\w+\s*:\s*any\s*\)|@ts-ignore|@ts-nocheck|eslint-disable[^\n]*no-explicit-any)/;

function* walk(path) {
  const stat = statSync(path);
  if (stat.isFile()) {
    if (/\.(ts|tsx)$/.test(path)) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (!ignoredDirs.has(entry)) yield* walk(join(path, entry));
  }
}

const offenders = [];
for (const root of roots) {
  try {
    for (const file of walk(root)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          const code = line.replace(/\/\/.*$/, '').replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '""');
          if (pattern.test(code)) offenders.push(`${relative('.', file)}:${index + 1}: ${line.trim()}`);
        });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (offenders.length > 0) {
  console.error('Uso proibido de `any` (ou supressão de tipos) encontrado:\n' + offenders.join('\n'));
  process.exit(1);
}
console.log('OK: nenhum `any` encontrado.');
