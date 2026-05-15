/**
 * Architecture-contract tests for the home feature.
 *
 * These tests fail if:
 * - forwardRef is introduced into any home component
 * - MediaPlayer is imported eagerly (not behind React.lazy)
 * - homepage playlist constants are defined inside the HomePage render function
 * - SectionRow or Carousel gain boolean-mode props (show*, hide*, is*Mode, as*)
 */
import { describe, it, expect } from 'vitest';

const HOME_SOURCES = import.meta.glob('./components/*.jsx', { eager: true, query: '?raw', import: 'default' });
const allSourceText = Object.entries(HOME_SOURCES).map(([path, src]) => ({ path, src }));

function findSource(name) {
	return allSourceText.find(({ path }) => path.includes(name));
}

describe('Architecture contract — no forwardRef', () => {
	it('no component in the home feature uses forwardRef', () => {
		const violations = allSourceText.filter(({ src }) => /forwardRef/.test(src) || /React\.forwardRef/.test(src));
		if (violations.length > 0) {
			const names = violations.map(({ path }) => path).join(', ');
			throw new Error(`forwardRef found in: ${names}. Use ref as a plain prop instead (React 19).`);
		}
	});
});

describe('Architecture contract — lazy MediaPlayer', () => {
	it('HeroSection.jsx imports MediaPlayer via React.lazy dynamic import', () => {
		const { src } = findSource('HeroSection') ?? {};
		expect(src).toBeDefined();
		expect(src).toMatch(/lazy\(\s*\(\)\s*=>\s*import\(['"]\.\/HeroVideoPlayer['"]\)/);
	});

	it('HeroSection.jsx does not contain a top-level static import of HeroVideoPlayer', () => {
		const { src } = findSource('HeroSection') ?? {};
		expect(src).toBeDefined();
		// No top-level import for HeroVideoPlayer (lazy is the only reference)
		const staticImportMatch = src.match(/^import\s+.*HeroVideoPlayer/m);
		expect(staticImportMatch).toBeNull();
	});
});

describe('Architecture contract — module-scope homepage playlist constants', () => {
	it('HOME_PLAYLIST_ITEM_LIMIT is declared at module scope in HomePage.jsx', () => {
		const { src } = findSource('HomePage') ?? {};
		expect(src).toBeDefined();
		// The constant must appear as a top-level declaration (starts at line start, not inside a function body).
		expect(src).toMatch(/^const HOME_PLAYLIST_ITEM_LIMIT/m);
	});

	it('HOME_PLAYLIST_ITEM_LIMIT is not declared inside the HomePage function body', () => {
		const { src } = findSource('HomePage') ?? {};
		expect(src).toBeDefined();
		// Verify the declaration line is NOT indented (module-level).
		const lines = src.split('\n');
		const declLine = lines.find((l) => l.includes('HOME_PLAYLIST_ITEM_LIMIT') && l.includes('='));
		expect(declLine).toBeDefined();
		expect(declLine).toMatch(/^const HOME_PLAYLIST_ITEM_LIMIT/);
	});
});

describe('Architecture contract — no boolean-mode props on SectionRow or Carousel', () => {
	const BOOLEAN_MODE_PATTERN = /\b(show[A-Z]|hide[A-Z]|is[A-Z][a-z]*Mode|as[A-Z])/;

	function findDestructuredPropNames(src, componentName) {
		const match = src.match(new RegExp(`function\\s+${componentName}\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`));
		if (!match) return [];

		return match[1]
			.split(',')
			.map((part) => part.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|=|$)/)?.[1])
			.filter(Boolean);
	}

	function findBooleanModeProp(src, componentName) {
		return findDestructuredPropNames(src, componentName).find((prop) => BOOLEAN_MODE_PATTERN.test(prop));
	}

	it('SectionRow.jsx has no boolean-mode prop names', () => {
		const { src } = findSource('SectionRow') ?? {};
		expect(src).toBeDefined();
		const match = findBooleanModeProp(src, 'SectionRow');
		if (match) {
			throw new Error(`Boolean-mode prop "${match}" found in SectionRow.jsx. Use compound components instead.`);
		}
	});

	it('Carousel.jsx has no boolean-mode prop names', () => {
		const { src } = findSource('Carousel') ?? {};
		expect(src).toBeDefined();
		const match = findBooleanModeProp(src, 'Carousel');
		if (match) {
			throw new Error(`Boolean-mode prop "${match}" found in Carousel.jsx. Use compound components instead.`);
		}
	});
});
