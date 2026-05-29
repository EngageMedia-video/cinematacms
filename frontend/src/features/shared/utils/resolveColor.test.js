import { describe, expect, it } from 'vitest';
import { resolveColor } from './resolveColor';

describe('resolveColor', () => {
	it('returns raw CSS color values as-is', () => {
		expect(resolveColor('#0c5273')).toBe('#0c5273');
		expect(resolveColor('rgb(12, 82, 115)')).toBe('rgb(12, 82, 115)');
		expect(resolveColor('var(--bg-chrome)')).toBe('var(--bg-chrome)');
	});

	it('resolves modern semantic color tokens into CSS variables', () => {
		expect(resolveColor('bg/primary')).toBe('var(--bg-primary)');
		expect(resolveColor('bg-primary')).toBe('var(--bg-primary)');
		expect(resolveColor('bg-bg-primary')).toBe('var(--bg-primary)');
		expect(resolveColor('bg/danger-strong')).toBe('var(--bg-danger-strong)');
		expect(resolveColor('text-text-strong')).toBe('var(--text-strong)');
		expect(resolveColor('border-border-default')).toBe('var(--border-default)');
		expect(resolveColor('ring-ring-focus')).toBe('var(--ring-focus)');
	});

	it('supports keyword colors used by shared components', () => {
		expect(resolveColor('transparent')).toBe('transparent');
		expect(resolveColor('currentColor')).toBe('currentColor');
		expect(resolveColor('inherit')).toBe('inherit');
	});
});
