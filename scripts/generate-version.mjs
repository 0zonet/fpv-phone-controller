import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(version)) throw new Error('Unsupported product version');
await writeFile(new URL('shared/src/product-version.ts', root), '// Generated from root package.json.\nexport const PRODUCT_VERSION = ' + JSON.stringify(version) + ';\n');
