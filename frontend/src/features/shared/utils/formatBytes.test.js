import { describe, expect, it } from 'vitest';
import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
	it('formats zero and byte values', () => {
		expect(formatBytes(0)).toBe('0 B');
		expect(formatBytes(512)).toBe('512 B');
	});

	it('formats binary unit boundaries', () => {
		expect(formatBytes(1024)).toBe('1 KB');
		expect(formatBytes(1024 ** 2)).toBe('1 MB');
		expect(formatBytes(1024 ** 3)).toBe('1 GB');
		expect(formatBytes(1024 ** 4)).toBe('1 TB');
	});

	it('formats fractional values with configurable decimals', () => {
		expect(formatBytes(1536)).toBe('1.5 KB');
		expect(formatBytes(1536, { decimals: 2 })).toBe('1.5 KB');
		expect(formatBytes(1024 ** 3 * 12.34, { decimals: 2 })).toBe('12.34 GB');
	});

	it('returns null for missing or invalid values', () => {
		expect(formatBytes(null)).toBeNull();
		expect(formatBytes(undefined)).toBeNull();
		expect(formatBytes('')).toBeNull();
		expect(formatBytes(Number.NaN)).toBeNull();
		expect(formatBytes(Number.POSITIVE_INFINITY)).toBeNull();
		expect(formatBytes(-1)).toBeNull();
	});
});
