import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_EXTENSIONS = new Set(['.css', '.scss', '.js', '.jsx', '.ts', '.tsx']);
const IGNORED_PATHS = [
	/static\/lib\//,
	/\/build\//,
	/\/storybook-static\//,
	/\.test\./,
	/\.stories\./,
	/\/modern-demo\//,
	/DemoPage\.scss$/,
	/DemoComponent\//,
];

function walkSourceFiles(dir, files = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const filePath = path.join(dir, entry.name);

		if (IGNORED_PATHS.some((pattern) => pattern.test(filePath))) {
			continue;
		}

		if (entry.isDirectory()) {
			walkSourceFiles(filePath, files);
		} else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
			files.push(filePath);
		}
	}

	return files;
}

function stripComments(source) {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('CSS custom properties', () => {
	it('does not reference undefined variables without fallbacks', () => {
		const files = walkSourceFiles(SOURCE_ROOT);
		const definitions = new Set();

		for (const file of files) {
			const source = stripComments(fs.readFileSync(file, 'utf8'));

			for (const match of source.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
				definitions.add(match[1]);
			}
		}

		const missing = [];

		for (const file of files) {
			const source = stripComments(fs.readFileSync(file, 'utf8'));
			const lines = source.split(/\r?\n/);

			lines.forEach((line, index) => {
				for (const match of line.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)([^)]*)\)/g)) {
					const [, variableName, rest] = match;

					if (line.includes('${') || definitions.has(variableName) || rest.includes(',')) {
						continue;
					}

					missing.push(`${path.relative(SOURCE_ROOT, file)}:${index + 1} ${variableName}`);
				}
			});
		}

		expect(missing).toEqual([]);
	});
});
