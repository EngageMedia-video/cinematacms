import { describe, expect, it } from 'vitest';
import { cn } from './classNames';

describe('cn', () => {
	it('composes conditional class names', () => {
		expect(cn('flex', false && 'hidden', ['items-center', { 'justify-center': true }])).toBe(
			'flex items-center justify-center'
		);
	});

	it('lets later conflicting Tailwind classes win', () => {
		expect(cn('px-2 py-1', 'p-4')).toBe('p-4');
		expect(cn('text-cinemata-pacific-deep-700', 'text-[var(--sunset-horizon-200,#F6A474)]')).toBe(
			'text-[var(--sunset-horizon-200,#F6A474)]'
		);
	});

	it('merges design-system spacing and radius tokens with standard utilities', () => {
		expect(cn('px-space-base py-size-10', 'p-0')).toBe('p-0');
		expect(cn('rounded-sm', 'rounded-ds-8')).toBe('rounded-ds-8');
		expect(cn('gap-space-xs', 'gap-1')).toBe('gap-1');
		expect(cn('p-0', 'px-space-base')).toBe('p-0 px-space-base');
		expect(cn('rounded-ds-8 sm:rounded-ds-12', 'sm:rounded-none')).toBe('rounded-ds-8 sm:rounded-none');
		expect(cn('px-space-base hover:px-space-lg', 'hover:px-2')).toBe('px-space-base hover:px-2');
		expect(cn('text-text-primary bg-bg-surface', 'p-size-12 rounded-ds-8')).toBe(
			'text-text-primary bg-bg-surface p-size-12 rounded-ds-8'
		);
	});
});
