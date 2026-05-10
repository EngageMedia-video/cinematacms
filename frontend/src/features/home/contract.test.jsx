/**
 * Architecture-contract tests for the home feature.
 *
 * These tests fail if:
 * - forwardRef is introduced into any home component
 * - MediaPlayer is imported eagerly (not behind React.lazy)
 * - PROVISIONAL_CATEGORIES is defined inside the HomePage render function
 * - SectionRow or Carousel gain boolean-mode props (show*, hide*, is*Mode, as*)
 */
import { describe, it, expect } from 'vitest';

const HOME_SOURCES = import.meta.glob('./components/*.jsx', { eager: true, as: 'raw' });
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

describe('Architecture contract — module-scope PROVISIONAL_CATEGORIES', () => {
	it('PROVISIONAL_CATEGORIES is declared at module scope in HomePage.jsx', () => {
		const { src } = findSource('HomePage') ?? {};
		expect(src).toBeDefined();
		// The constant must appear as a top-level declaration (starts at line start, not inside a function body)
		expect(src).toMatch(/^const PROVISIONAL_CATEGORIES/m);
	});

	it('PROVISIONAL_CATEGORIES is not declared inside the HomePage function body', () => {
		const { src } = findSource('HomePage') ?? {};
		expect(src).toBeDefined();
		// Verify the function body does not contain PROVISIONAL_CATEGORIES = [
		// by checking that the declaration line is NOT indented (module-level)
		const lines = src.split('\n');
		const declLine = lines.find((l) => l.includes('PROVISIONAL_CATEGORIES') && l.includes('=') && l.includes('['));
		expect(declLine).toBeDefined();
		// Module-level declarations are not indented with tabs or multiple spaces
		expect(declLine).toMatch(/^const PROVISIONAL_CATEGORIES/);
	});
});

describe('Architecture contract — no boolean-mode props on SectionRow or Carousel', () => {
	const BOOLEAN_MODE_PATTERN = /\b(show[A-Z]|hide[A-Z]|is[A-Z][a-z]*Mode|as[A-Z])/;

	it('SectionRow.jsx has no boolean-mode prop names', () => {
		const { src } = findSource('SectionRow') ?? {};
		expect(src).toBeDefined();
		const matches = src.match(BOOLEAN_MODE_PATTERN);
		if (matches) {
			throw new Error(
				`Boolean-mode prop "${matches[0]}" found in SectionRow.jsx. Use compound components instead.`
			);
		}
	});

	it('Carousel.jsx has no boolean-mode prop names', () => {
		const { src } = findSource('Carousel') ?? {};
		expect(src).toBeDefined();
		const matches = src.match(BOOLEAN_MODE_PATTERN);
		if (matches) {
			throw new Error(
				`Boolean-mode prop "${matches[0]}" found in Carousel.jsx. Use compound components instead.`
			);
		}
	});
});
