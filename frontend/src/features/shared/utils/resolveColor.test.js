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
		expect(resolveColor('border-border-subtle')).toBe('var(--border-subtle)');
		expect(resolveColor('ring-ring-focus')).toBe('var(--ring-focus)');
	});

	it('drops the default variant the way tokens.json names its CSS variables', () => {
		expect(resolveColor('text/default')).toBe('var(--text)');
		expect(resolveColor('bg/surface/default')).toBe('var(--bg-surface)');
		expect(resolveColor('bg/surface/raised')).toBe('var(--bg-surface-raised)');
		expect(resolveColor('text-text')).toBe('var(--text)');
		expect(resolveColor('border-border')).toBe('var(--border)');
	});

	it('resolves palette names', () => {
		expect(resolveColor('cinemata-pacific-deep-600p')).toBe('var(--cinemata-pacific-deep-600p)');
		expect(resolveColor('pacific-deep-600p')).toBe('var(--cinemata-pacific-deep-600p)');
		expect(resolveColor('--bg-tag')).toBe('var(--bg-tag)');
	});

	it('supports keyword colors used by shared components', () => {
		expect(resolveColor('transparent')).toBe('transparent');
		expect(resolveColor('currentColor')).toBe('currentColor');
		expect(resolveColor('inherit')).toBe('inherit');
	});
});
