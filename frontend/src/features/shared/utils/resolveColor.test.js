import { describe, expect, it } from 'vitest';
import { resolveColor } from './resolveColor';

describe('resolveColor', () => {
	it('returns raw CSS color values as-is', () => {
		expect(resolveColor('#0c5273')).toBe('#0c5273');
		expect(resolveColor('rgb(12, 82, 115)')).toBe('rgb(12, 82, 115)');
		expect(resolveColor('var(--cinemata-pacific-deep-800)')).toBe('var(--cinemata-pacific-deep-800)');
	});

	it('resolves cinemata tokens into CSS variables', () => {
		expect(resolveColor('pacific-deep-950')).toBe('var(--cinemata-pacific-deep-950)');
		expect(resolveColor('cinemata-pacific-deep-950')).toBe('var(--cinemata-pacific-deep-950)');
		expect(resolveColor('--cinemata-pacific-deep-950')).toBe('var(--cinemata-pacific-deep-950)');
	});

	it('supports keyword colors used by shared components', () => {
		expect(resolveColor('transparent')).toBe('transparent');
		expect(resolveColor('currentColor')).toBe('currentColor');
		expect(resolveColor('inherit')).toBe('inherit');
	});
});
