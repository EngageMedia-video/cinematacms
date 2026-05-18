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
});
