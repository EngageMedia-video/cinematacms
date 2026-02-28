#!/usr/bin/env node

/**
 * Build script for @mediacms/vjs-plugin-font-icons
 *
 * Replaces the Grunt pipeline with three direct steps:
 *   1. Generate icon fonts (woff/ttf/svg) + SCSS via fantasticon
 *   2. Embed the woff font as base64 into scss/_icons.scss
 *   3. Compile scss/videojs-icons.scss → dist/css/mediacms-vjs-icons.css
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateFonts } from 'fantasticon';
import * as sass from 'sass';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── Helpers ──────────────────────────────────────────────────────────

function ensureDir(dir) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function cleanDir(dir) {
	if (fs.existsSync(dir)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}

// ── Step 0: Clean previous build artifacts ───────────────────────────

cleanDir(path.join(ROOT, 'dist'));
cleanDir(path.join(ROOT, 'build'));

// ── Step 1: Generate icon fonts via fantasticon ──────────────────────

const iconConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'icons.json'), 'utf8'));

const svgRootDir = path.resolve(ROOT, iconConfig['root-dir']);
const icons = iconConfig.icons;

// Prepare temp directory with SVGs renamed to icon names
const tempDir = path.join(ROOT, '.temp-icons');
cleanDir(tempDir);
ensureDir(tempDir);

const outputDir = path.join(ROOT, 'build', 'fonts');
ensureDir(outputDir);
ensureDir(path.join(ROOT, 'dist'));

// Sort icons alphabetically to ensure consistent codepoint assignment
const sortedIcons = [...icons].sort((a, b) => a.name.localeCompare(b.name));
const svgCache = {};

for (const icon of sortedIcons) {
	const sourcePath = icon['root-dir']
		? path.resolve(ROOT, icon['root-dir'], icon.svg)
		: path.join(svgRootDir, icon.svg);

	const destPath = path.join(tempDir, icon.name + '.svg');

	if (!svgCache[sourcePath]) {
		if (fs.existsSync(sourcePath)) {
			svgCache[sourcePath] = fs.readFileSync(sourcePath);
		} else {
			console.warn(`Warning: SVG file not found: ${sourcePath}`);
			continue;
		}
	}

	fs.writeFileSync(destPath, svgCache[sourcePath]);
}

// Generate custom codepoints starting from the private use area
const customCodepoints = {};
const codepointStart = 0xf101;
const sortedNames = icons.map((i) => i.name).sort();
sortedNames.forEach((name, index) => {
	customCodepoints[name] = codepointStart + index;
});

try {
	await generateFonts({
		inputDir: tempDir,
		outputDir: './',
		name: iconConfig['font-name'],
		fontTypes: ['woff', 'ttf', 'svg'],
		assetTypes: ['scss', 'html'],
		templates: {
			scss: path.join(ROOT, 'templates', 'scss.hbs'),
			html: path.join(ROOT, 'templates', 'html.hbs'),
		},
		pathOptions: {
			woff: path.join(outputDir, iconConfig['font-name'] + '.woff'),
			ttf: path.join(outputDir, iconConfig['font-name'] + '.ttf'),
			svg: path.join(outputDir, iconConfig['font-name'] + '.svg'),
			scss: path.join(ROOT, 'scss', '_icons.scss'),
			html: path.join(ROOT, 'dist', 'fonts-preview.html'),
		},
		codepoints: customCodepoints,
		fontHeight: 1000,
		normalize: true,
	});

	console.log('✓ Fonts generated');
} catch (error) {
	cleanDir(tempDir);
	console.error('Font generation failed:', error);
	process.exit(1);
}

// ── Step 1b: Post-process SCSS — convert decimal codepoints to hex ──

const scssFile = path.join(ROOT, 'scss', '_icons.scss');
let scssContent = fs.readFileSync(scssFile, 'utf8');

scssContent = scssContent.replace(/(\w+):\s*'(\d+)'/g, (_match, name, decimal) => {
	const hex = parseInt(decimal, 10).toString(16);
	return `${name}: '${hex}'`;
});

fs.writeFileSync(scssFile, scssContent);
console.log('✓ Codepoints converted to hex');

// ── Step 2: Embed woff as base64 in _icons.scss ─────────────────────

const fontName = iconConfig['font-name'];
const woffPath = path.join(outputDir, fontName + '.woff');
const woffContent = fs.readFileSync(woffPath);
const base64Woff = woffContent.toString('base64');

scssContent = fs.readFileSync(scssFile, 'utf8');

const woffRegex = new RegExp(`(url.*font-woff.*base64,)([^\\s]+)(\\).*)`);
scssContent = scssContent.replace(woffRegex, `$1${base64Woff}$3`);

fs.writeFileSync(scssFile, scssContent);
console.log('✓ Base64 woff embedded in _icons.scss');

// ── Step 3: Compile SCSS → CSS ──────────────────────────────────────

ensureDir(path.join(ROOT, 'dist', 'css'));

const result = sass.compile(path.join(ROOT, 'scss', 'videojs-icons.scss'));

fs.writeFileSync(path.join(ROOT, 'dist', 'css', 'mediacms-vjs-icons.css'), result.css);

console.log('✓ SCSS compiled to dist/css/mediacms-vjs-icons.css');

// ── Cleanup ─────────────────────────────────────────────────────────

cleanDir(tempDir);
console.log('✓ Build complete');
