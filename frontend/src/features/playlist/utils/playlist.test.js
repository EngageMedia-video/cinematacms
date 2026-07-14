import { afterEach, describe, expect, it } from 'vitest';
import {
	addPlaylistParam,
	formatCount,
	formatCreatedDate,
	getMediaCountry,
	getMediaDescription,
	getPlaylistApiUrl,
	getPlaylistPageUrl,
	getPlaylistTokenFromLocation,
	getPlaylistViews,
	htmlToPlainText,
	isOwnerPlaylist,
	moveItem,
	orderedPlaylistMedia,
} from './playlist';

describe('playlist utils', () => {
	afterEach(() => {
		delete window.MediaCMS;
	});

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

	it('returns the original array when moveItem gets invalid indices', () => {
		const original = ['one', 'two', 'three'];

		expect(moveItem(original, -1, 1)).toBe(original);
		expect(moveItem(original, 0, 5)).toBe(original);
		expect(moveItem(original, 1, 1)).toBe(original);
	});

	it('prefers the configured playlist token over the URL path', () => {
		window.MediaCMS = { playlistId: 'cfgtoken1' };
		expect(getPlaylistTokenFromLocation({ pathname: '/playlist/urltoken1' })).toBe('cfgtoken1');

		window.MediaCMS = {};
		expect(getPlaylistTokenFromLocation({ pathname: '/playlist/urltoken1' })).toBe('urltoken1');
		expect(getPlaylistTokenFromLocation({ pathname: '' })).toBe('');
	});

	it('builds API and page URLs with encoding and fallbacks', () => {
		expect(getPlaylistApiUrl({ api: { playlists: 'https://x.test/api/v1/playlists/' } }, 'a b')).toBe(
			'https://x.test/api/v1/playlists/a%20b'
		);
		expect(getPlaylistApiUrl({}, 'tok')).toBe('/api/v1/playlists/tok');
		expect(getPlaylistPageUrl({ site: { url: 'https://x.test/' } }, 'tok')).toBe('https://x.test/playlist/tok');
		expect(getPlaylistPageUrl({}, 'tok')).toBe('/playlist/tok');
	});

	it('extracts country titles from list and object shapes', () => {
		expect(getMediaCountry({ media_country_info: [{ title: 'Philippines' }, { title: 'Indonesia' }] })).toBe(
			'Philippines, Indonesia'
		);
		expect(getMediaCountry({ media_country_info: { title: 'Philippines' } })).toBe('Philippines');
		expect(getMediaCountry({ media_country_info: [] })).toBe('');
		expect(getMediaCountry({})).toBe('');
	});

	it('falls back from summary to description for the synopsis', () => {
		expect(getMediaDescription({ summary: 'Summary', description: 'Description' })).toBe('Summary');
		expect(getMediaDescription({ description: 'Description' })).toBe('Description');
		expect(getMediaDescription({})).toBe('');
	});

	it('adds the playlist query param to media URLs', () => {
		expect(addPlaylistParam('https://x.test/view?m=abc', 'tok')).toBe('https://x.test/view?m=abc&pl=tok');
		expect(addPlaylistParam('/view?m=abc', 'tok')).toContain('pl=tok');
		expect(addPlaylistParam('', 'tok')).toBe('#');
		expect(addPlaylistParam('/view?m=abc', '')).toBe('/view?m=abc');
	});

	it('clones playlist media into a new array', () => {
		const media = [{ friendly_token: 'a' }];

		expect(orderedPlaylistMedia(media)).not.toBe(media);
		expect(orderedPlaylistMedia(media)).toEqual(media);
		expect(orderedPlaylistMedia(undefined)).toEqual([]);
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

describe('htmlToPlainText', () => {
	it('passes plain text through unchanged', () => {
		expect(htmlToPlainText('Community archivist.\n\nBased in Manila.')).toBe(
			'Community archivist.\n\nBased in Manila.'
		);
	});

	it('strips markup and keeps paragraph breaks', () => {
		expect(htmlToPlainText('<p>Filmmaker &amp; <strong>curator</strong>.</p><p>Based in Manila.</p>')).toBe(
			'Filmmaker & curator.\n\nBased in Manila.'
		);
	});

	it('converts line breaks and never executes markup', () => {
		expect(htmlToPlainText('one<br>two<img src=x onerror="window.__pwned = true">')).toBe('one\ntwo');
		expect(window.__pwned).toBeUndefined();
	});

	it('returns an empty string for empty input', () => {
		expect(htmlToPlainText('')).toBe('');
		expect(htmlToPlainText(null)).toBe('');
	});
});
