import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), '../static/js/cinemata-analytics.js'), 'utf8');
const mediaId = '12345678-1234-4234-8234-123456789abc';

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function loadTracker(overrides = {}) {
	document.body.innerHTML = `<script id="cinemata-analytics-config" type="application/json">${JSON.stringify({
		url: 'https://analytics.example.org',
		website_id: 'site-id',
		path: '/media/view',
		media_id: mediaId,
		media_type: 'video',
		context: 'page',
		nonpublic: true,
		...overrides,
	})}</script>`;
	const track = vi.fn();
	window.umami = { track };
	new Function('window', 'document', 'Element', source)(window, document, Element);
	return track;
}

describe('Cinemata Umami privacy boundary', () => {
	it('strips private URLs, titles, referrers, identifiers, and arbitrary event data', () => {
		loadTracker();
		const payload = window.cinemataAnalyticsBeforeSend('event', {
			website: 'wrong',
			url: '/view?m=secret&token=secret',
			title: 'Private title',
			referrer: '/view?token=secret',
			id: 'visitor',
			name: 'play',
			tag: `media:${mediaId}`,
			data: { media_type: 'video', context: 'page', password: 'secret' },
		});

		expect(payload).toEqual({
			website: 'site-id',
			hostname: window.location.hostname,
			url: '/media/view',
			title: 'Media',
			referrer: '',
			tag: `media:${mediaId}`,
			name: 'play',
			data: { media_id: mediaId, media_type: 'video', context: 'page' },
		});
		expect(window.cinemataAnalyticsBeforeSend('event', { name: 'unknown:secret', url: '/secret' })).toBe(false);
	});

	it('does not count a seek as watched progress', () => {
		const track = loadTracker();
		const listeners = {};
		let currentTime = 0;
		const player = {
			on: (event, callback) => {
				listeners[event] = callback;
			},
			muted: () => false,
			isFullscreen: () => false,
			duration: () => 100,
			currentTime: () => currentTime,
			ended: () => false,
		};
		window.CinemataAnalytics.attachPlayer(player);
		listeners.play();
		currentTime = 80;
		listeners.seeking();
		listeners.timeupdate();
		listeners.timeupdate();

		const names = track.mock.calls.map(([value]) => value({}).name);
		expect(names.filter((name) => name === 'playback_start')).toHaveLength(1);
		expect(names).not.toContain('progress_25');
		expect(names).not.toContain('progress_50');
		expect(names).not.toContain('progress_75');
	});

	it('accepts a new feature event while dropping arbitrary properties', () => {
		const track = loadTracker();
		window.CinemataAnalytics.track('annotation_created', { email: 'secret@example.org' });
		const proposed = track.mock.lastCall[0]({});

		expect(window.cinemataAnalyticsBeforeSend('event', proposed)).toEqual({
			website: 'site-id',
			hostname: window.location.hostname,
			url: '/media/view',
			title: 'Media',
			referrer: '',
			tag: `media:${mediaId}`,
			name: 'annotation_created',
			data: { media_id: mediaId, media_type: 'video', context: 'page' },
		});
		window.CinemataAnalytics.track('annotation:secret');
		expect(track).toHaveBeenCalledTimes(1);
	});

	it('keeps only the public referring domain in a URL Umami can parse', () => {
		Object.defineProperty(document, 'referrer', {
			configurable: true,
			value: 'https://publisher.example/secret/film?token=private',
		});
		loadTracker({ nonpublic: false });
		const payload = window.cinemataAnalyticsBeforeSend('event', {
			name: 'media_view',
			tag: `media:${mediaId}`,
			data: { source_domain: 'publisher.example' },
		});
		expect(payload.referrer).toBe('https://publisher.example/');
		expect(payload.data.source_domain).toBe('publisher.example');
		expect(JSON.stringify(payload)).not.toContain('/secret/film');
	});

	it('counts an explicitly approved SPA page without sending its browser URL', () => {
		const track = loadTracker({ media_id: null, path: '/future' });
		window.CinemataAnalytics.pageview('future_feature');
		window.CinemataAnalytics.pageview('private/token');

		expect(track).toHaveBeenCalledTimes(1);
		expect(window.cinemataAnalyticsBeforeSend('pageview', track.mock.lastCall[0])).toMatchObject({
			url: '/page/future_feature',
			title: 'Page',
			referrer: '',
		});
	});

	it('counts only foreground time on text pages in coarse reading milestones', () => {
		vi.useFakeTimers();
		vi.spyOn(document, 'hasFocus').mockReturnValue(true);
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
		const track = loadTracker({ media_id: null, path: '/article-one', text_page: true });

		vi.advanceTimersByTime(20000);
		expect(track.mock.calls.map(([value]) => value({}).name)).toContain('text_read_15s');
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
		document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(30000);
		expect(track.mock.calls.map(([value]) => value({}).name)).not.toContain('text_read_30s');
		Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
		document.dispatchEvent(new Event('visibilitychange'));
		vi.advanceTimersByTime(10000);
		expect(track.mock.calls.map(([value]) => value({}).name)).toContain('text_read_30s');
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({})).url).toBe('/article-one');
		window.dispatchEvent(new Event('pagehide'));
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('sends role-free public event counts to the CMS even before Umami loads', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		loadTracker({ media_id: null, path: '/story', segment_grant: 'signed-grant' });
		window.CinemataAnalytics.track('text_read_15s', { email: 'private@example.org' });

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ grant: 'signed-grant', event: 'page_view' });
		expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ grant: 'signed-grant', event: 'text_read_15s' });
		expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'same-origin', keepalive: true });
	});

	it('collects CMS activity without loading or calling Umami when unconfigured', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		const track = loadTracker({ url: '', website_id: '', media_id: null, segment_grant: 'signed-grant' });
		window.CinemataAnalytics.track('annotation_created');
		window.CinemataAnalytics.pageview('future_feature');
		expect(document.querySelector('script[data-website-id=""]')).toBeNull();
		expect(track).not.toHaveBeenCalled();
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('honors a browser Do Not Track value of yes for CMS segment counts', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: 'yes' });
		try {
			loadTracker({ media_id: null, path: '/story', segment_grant: 'signed-grant' });
			window.CinemataAnalytics.track('text_read_15s');
			expect(fetch).not.toHaveBeenCalled();
		} finally {
			delete navigator.doNotTrack;
		}
	});

	it.each([true, false])('records qualified viewing with Umami configured: %s', async (configured) => {
		const beacon = vi.fn();
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
		Object.defineProperty(globalThis.crypto, 'randomUUID', {
			configurable: true,
			value: () => '12345678-1234-4234-8234-123456789abd',
		});
		const now = vi.spyOn(performance, 'now');
		let clock = 0;
		now.mockImplementation(() => clock);
		loadTracker({ measurement_token: 'signed-grant', ...(configured ? {} : { url: '', website_id: '' }) });
		const listeners = {};
		let currentTime = 0;
		const player = {
			on: (event, callback) => {
				listeners[event] = callback;
			},
			muted: () => false,
			isFullscreen: () => false,
			duration: () => 100,
			currentTime: () => currentTime,
			paused: () => false,
			seeking: () => false,
			readyState: () => 4,
			ended: () => false,
		};
		window.CinemataAnalytics.attachPlayer(player);
		listeners.play();
		clock = 1000;
		currentTime = 1;
		listeners.timeupdate();
		listeners.pause();
		const body = JSON.parse(
			await new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result);
				reader.readAsText(beacon.mock.lastCall[1]);
			})
		);
		expect(body.coverage).toEqual([[0, 1000]]);
		expect(Object.values(body.watch_days)).toEqual([1000]);
		expect(body.play_id).toBe('12345678-1234-4234-8234-123456789abd');
		now.mockRestore();
	});
});
