/**
 * Comprueba que src/core no depende de Electron.
 *
 * El core tiene que poder ejecutarse con Node a secas (y, llegado el caso,
 * portarse a otro runtime), así que no puede importar "electron" ni
 * librerías que solo funcionan dentro de Electron.
 *
 * Uso: npm run check:core
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '..', 'src', 'core');
const FORBIDDEN = ['electron', 'electron-log', 'electron-updater', 'electron-squirrel-startup'];

function listJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJsFiles(fullPath);
    return entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

const problems = [];

for (const file of listJsFiles(CORE_DIR)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const imports = [...line.matchAll(/(?:require\(|from\s+)['"]([^'"]+)['"]/g)].map((match) => match[1]);

    for (const specifier of imports) {
      const isForbiddenPackage = FORBIDDEN.some((name) => specifier === name || specifier.startsWith(`${name}/`));
      // Tampoco puede importar nada de fuera de src/core (p. ej. ../electron/...)
      const leavesCore = specifier.startsWith('.')
        && path.relative(CORE_DIR, path.resolve(path.dirname(file), specifier)).startsWith('..');

      if (isForbiddenPackage || leavesCore) {
        problems.push(`${path.relative(process.cwd(), file)}:${index + 1}  ->  ${specifier}`);
      }
    }
  });
}

if (problems.length > 0) {
  console.error('src/core no puede depender de Electron ni de código fuera de src/core:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log('OK: src/core no depende de Electron.');
