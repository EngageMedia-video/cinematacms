import { describe, expect, it } from 'vitest';
import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
	it('formats zero seconds as a valid duration', () => {
		expect(formatDuration(0)).toBe('0:00');
	});

	it('formats minute and hour durations', () => {
		expect(formatDuration(65)).toBe('1:05');
		expect(formatDuration(3661)).toBe('1:01:01');
	});

	it('floors fractional seconds', () => {
		expect(formatDuration(65.9)).toBe('1:05');
	});

	it('returns an empty string for missing or invalid values', () => {
		expect(formatDuration(null)).toBe('');
		expect(formatDuration(undefined)).toBe('');
		expect(formatDuration('')).toBe('');
		expect(formatDuration(Number.NaN)).toBe('');
		expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('');
		expect(formatDuration(-1)).toBe('');
	});
});
