import { describe, expect, it } from 'vitest';
import { getMediaDurationLabel, normalizeMediaList } from './mediaList';

describe('normalizeMediaList', () => {
	it('returns bare arrays unchanged', () => {
		const items = [{ id: 1 }];
		expect(normalizeMediaList(items)).toBe(items);
	});

	it('returns playlist_media arrays from playlist envelopes', () => {
		expect(normalizeMediaList({ playlist_media: [{ id: 2 }] })).toEqual([{ id: 2 }]);
	});

	it('returns results arrays from paginated envelopes', () => {
		expect(normalizeMediaList({ results: [{ id: 3 }] })).toEqual([{ id: 3 }]);
	});

	it('returns an empty array for invalid shapes', () => {
		expect(normalizeMediaList({ results: { id: 4 } })).toEqual([]);
		expect(normalizeMediaList(null)).toEqual([]);
	});
});

describe('getMediaDurationLabel', () => {
	it('keeps zero seconds as a valid duration label', () => {
		expect(getMediaDurationLabel({ duration_in_seconds: 0 })).toBe('0:00');
	});
});
