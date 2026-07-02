import { describe, expect, it } from 'vitest';
import { formatCount, formatCreatedDate, getPlaylistViews, isOwnerPlaylist, moveItem } from './playlist';

describe('playlist utils', () => {
	it('detects owner playlists using the existing username contract', () => {
		const config = { member: { username: 'curator', is: { anonymous: false } } };

		expect(isOwnerPlaylist(config, { user: 'curator' })).toBe(true);
		expect(isOwnerPlaylist(config, { user: 'visitor' })).toBe(false);
	});

	it('does not mark anonymous users as owners', () => {
		const config = { member: { username: 'curator', is: { anonymous: true } } };

		expect(isOwnerPlaylist(config, { user: 'curator' })).toBe(false);
	});

	it('moves playlist media without mutating the original list', () => {
		const original = ['one', 'two', 'three'];

		expect(moveItem(original, 0, 2)).toEqual(['two', 'three', 'one']);
		expect(original).toEqual(['one', 'two', 'three']);
	});

	it('formats counts with singular and plural labels', () => {
		expect(formatCount(1, 'video')).toBe('1 video');
		expect(formatCount(2, 'video')).toBe('2 videos');
	});

	it('sums media views defensively', () => {
		expect(getPlaylistViews([{ views: 10 }, { views: '5' }, { views: null }])).toBe(15);
	});

	it('formats the created date relative to now, matching the design copy', () => {
		const now = new Date('2026-07-02T00:00:00Z');

		expect(formatCreatedDate('2026-01-02T00:00:00Z', now)).toBe('Created 6 months ago');
		expect(formatCreatedDate('2026-06-30T00:00:00Z', now)).toBe('Created 2 days ago');
		expect(formatCreatedDate('2026-07-01T23:59:30Z', now)).toBe('Created just now');
		expect(formatCreatedDate(undefined, now)).toBe('Created recently');
		expect(formatCreatedDate('not-a-date', now)).toBe('Created recently');
	});
});
