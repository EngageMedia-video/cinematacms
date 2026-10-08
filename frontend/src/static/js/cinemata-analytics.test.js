import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(process.cwd(), '../static/js/cinemata-analytics.js'), 'utf8');
const mediaId = '12345678-1234-4234-8234-123456789abc';
const listeners = [];

afterEach(() => {
	for (const [target, name, callback, options] of listeners.splice(0))
		target.removeEventListener(name, callback, options);
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

function loadTracker(overrides = {}, clearCalls = true) {
	document.head
		.querySelectorAll('script[data-before-send="cinemataAnalyticsBeforeSend"]')
		.forEach((script) => script.remove());
	for (const target of [document, window]) {
		const add = target.addEventListener.bind(target);
		vi.spyOn(target, 'addEventListener').mockImplementation((name, callback, options) => {
			listeners.push([target, name, callback, options]);
			add(name, callback, options);
		});
	}
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
	if (clearCalls) track.mockClear();
	return track;
}

describe('Cinemata Umami privacy boundary', () => {
	it.each([null, mediaId])('counts a public load once in native Views and once as the audience event: %s', (id) => {
		const track = loadTracker({ media_id: id, nonpublic: false, audience_group: 'regular' }, false);
		document.querySelector('script[data-website-id="site-id"]').onload();
		const payloads = track.mock.calls.map(([build]) =>
			window.cinemataAnalyticsBeforeSend('event', typeof build === 'function' ? build({}) : build)
		);
		expect(payloads.filter((payload) => !payload.name)).toHaveLength(1);
		expect(payloads.filter((payload) => payload.name === 'page_view')).toHaveLength(1);
		expect(payloads.filter((payload) => payload.name === 'media_view')).toHaveLength(id ? 1 : 0);
		for (const payload of payloads) expect(payload.data.audience_group).toBe('regular');
	});
	it.each(['anonymous', 'regular', 'trusted', 'curator'])(
		'reports public activity as %s without an account identifier',
		(group) => {
			const track = loadTracker({ nonpublic: false, audience_group: group });
			window.CinemataAnalytics.track('like', { audience_group: 'forged', user_id: 'private-user' });
			const event = window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}));
			expect(event.data.audience_group).toBe(group);
			expect(JSON.stringify(event)).not.toMatch(/private-user|forged|user_id/);
			expect(window.cinemataAnalyticsBeforeSend('event', {}).data).toEqual({ audience_group: group });
		}
	);
	it.each([
		{ nonpublic: true, audience_group: 'regular' },
		{ nonpublic: false, audience_group: 'administrator' },
	])('omits audience labels for nonpublic or invalid configurations: %j', (config) => {
		loadTracker(config);
		expect(
			window.cinemataAnalyticsBeforeSend('event', { name: 'like', data: { audience_group: 'regular' } }).data
		).not.toHaveProperty('audience_group');
	});
	it('keeps public page and SPA views in Umami without posting duplicate CMS audience counts', () => {
		const fetch = vi.fn().mockResolvedValue({});
		vi.stubGlobal('fetch', fetch);
		const track = loadTracker({
			media_id: null,
			nonpublic: false,
			audience_group: 'trusted',
			segment_grant: 'legacy-grant',
		});
		window.CinemataAnalytics.pageview('future_feature');
		expect(track).toHaveBeenCalledTimes(2);
		expect(track.mock.calls.map(([payload]) => payload.name)).toEqual([undefined, 'page_view']);
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0])).toMatchObject({
			url: '/page/future_feature',
			data: { audience_group: 'trusted' },
		});
		expect(fetch).not.toHaveBeenCalled();
	});
	it('does not count queued owner edits as public audience activity after redirect', () => {
		const fetch = vi.fn().mockResolvedValue({});
		vi.stubGlobal('fetch', fetch);
		loadTracker({ segment_grant: 'public-media-grant', nonpublic: false, audience_group: 'regular' });
		fetch.mockClear();
		window.CinemataAnalytics.trackEvents([
			{ name: 'media_update', media: { id: mediaId, type: 'video', context: 'workflow' } },
			{ name: 'subtitle_add', media: { id: mediaId, type: 'video', context: 'workflow' } },
		]);
		expect(fetch).not.toHaveBeenCalled();
		for (const [build] of window.umami.track.mock.calls)
			expect(window.cinemataAnalyticsBeforeSend('event', build({})).data).not.toHaveProperty('audience_group');
	});
	it('keeps creator editing events separate from audience engagement queries', () => {
		const track = loadTracker({ path: '/page/media_edit', media_id: null });
		window.CinemataAnalytics.trackEvents([
			{ name: 'media_update', media: { id: mediaId, type: 'video', context: 'workflow' } },
		]);
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}))).toMatchObject({
			url: '/media/workflow',
			tag: `workflow:${mediaId}`,
			referrer: '',
			data: { context: 'workflow', media_id: mediaId },
		});
	});
	it('does not break a successful application action when the collector throws', () => {
		loadTracker();
		window.umami.track = () => {
			throw new Error('Collector unavailable');
		};
		expect(() => window.CinemataAnalytics.trackEvents([{ name: 'media_update' }])).not.toThrow();
	});
	it('counts upload transitions once without exposing the local file identifier', () => {
		const track = loadTracker({ media_id: null, path: '/page/upload', nonpublic: true });
		for (const action of ['start', 'error', 'error', 'retry', 'error', 'retry', 'complete', 'complete', 'error'])
			window.CinemataAnalytics.uploadEvent(action, 'private-filename');
		const payloads = track.mock.calls.map(([build]) => window.cinemataAnalyticsBeforeSend('event', build({})));
		expect(payloads.map((payload) => payload.name)).toEqual([
			'upload_start',
			'upload_error',
			'upload_retry',
			'upload_error',
			'upload_retry',
			'upload_complete',
		]);
		expect(JSON.stringify(payloads)).not.toContain('private-filename');
	});
	it.each([
		['/', '/view?m=secret', 'home_media_click', 'media'],
		['/media/view', '/user/private-name/', 'media_author_click', 'profile'],
		['/media/view', '/search?topic=sensitive', 'media_taxonomy_click', 'search'],
		['/media/view', '/accounts/signup/?next=secret', 'signup_click', 'other'],
		['/search', '/playlist/secret/', 'search_result_click', 'playlist'],
		['/user/profile/media', '/user/private-name/about/', 'profile_tab_click', 'profile'],
		['/user/profile/media', '/view?m=secret', 'navigation_click', 'media'],
	])('counts navigation from %s with only a destination category', (path, href, name, target) => {
		const track = loadTracker({ path, media_id: path === '/media/view' ? mediaId : null });
		const link = document.createElement('a');
		link.href = href;
		document.body.append(link);
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const payload = window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}));
		expect(payload.name).toBe(name);
		expect(track).toHaveBeenCalledTimes(1);
		expect(payload.data.target).toBe(target);
		expect(JSON.stringify(payload)).not.toMatch(/secret|sensitive|private-name/);
	});
	it('does not count clicks on search section headings as result selection', () => {
		const track = loadTracker();
		const section = document.createElement('section');
		section.dataset.analyticsAction = 'search_result_click';
		section.innerHTML = '<h3>Search results</h3>';
		document.body.append(section);
		section.firstChild.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(track).not.toHaveBeenCalled();
	});
	it('ignores inherited object keys when sanitizing events', () => {
		loadTracker();
		expect(window.cinemataAnalyticsBeforeSend('event', { name: 'constructor' }).url).toBe('/media/view');
	});
	it('attributes a playlist load using only an opaque UUID', () => {
		loadTracker({ media_id: null, playlist_id: mediaId, path: '/get_playlist' });
		expect(
			window.cinemataAnalyticsBeforeSend('event', { url: '/playlist/secret', title: 'Private title' })
		).toMatchObject({
			tag: `playlist:${mediaId}`,
			url: '/get_playlist',
			title: 'Page',
			data: { playlist_id: mediaId },
		});
	});
	it('does not substitute CMS audience counts when Umami is unconfigured', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		loadTracker({ url: '', website_id: '', nonpublic: false, segment_grant: 'signed-grant' });
		expect(fetch).not.toHaveBeenCalled();
	});
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
	it('attributes a playlist action to its media without using hero context or leaking a referrer', () => {
		const track = loadTracker({ media_id: null, path: '/playlist/view', nonpublic: false });
		window.CinemataAnalytics.track('playlist_remove', {}, { id: mediaId, type: 'video', context: 'playlist' });
		const payload = window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}));
		expect(payload).toMatchObject({
			url: '/media/playlist',
			referrer: '',
			tag: `media:${mediaId}`,
			data: { context: 'playlist', media_id: mediaId },
		});
	});
	it('keeps private activity out of film reports, referrers and public role aggregates', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		const track = loadTracker({ nonpublic: false, segment_grant: 'signed-grant', audience_group: 'regular' });
		fetch.mockClear();
		window.CinemataAnalytics.track('journal_create', { text: 'Secret note', timestamp: 12 });
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}))).toMatchObject({
			url: '/page/journal',
			referrer: '',
			title: 'Page',
			data: {},
		});
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}))).not.toHaveProperty('tag');
		expect(fetch).not.toHaveBeenCalled();
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
		vi.advanceTimersByTime(300000);
		expect(
			track.mock.calls.map(([value]) => value({}).name).filter((name) => name.startsWith('text_read_'))
		).toEqual(['text_read_15s', 'text_read_30s', 'text_read_60s', 'text_read_120s', 'text_read_300s']);
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({})).url).toBe('/article-one');
		window.dispatchEvent(new Event('pagehide'));
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it('queues public reading events until Umami loads, preserving only the coarse group', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		const track = loadTracker({ media_id: null, path: '/story', nonpublic: false, audience_group: 'regular' });
		delete window.umami;
		window.CinemataAnalytics.track('text_read_15s', { email: 'private@example.org' });
		expect(track).not.toHaveBeenCalled();
		window.umami = { track };
		document.querySelector('script[data-website-id="site-id"]').onload();
		expect(track).toHaveBeenCalledTimes(2);
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.calls[0][0]).data).toEqual({
			audience_group: 'regular',
		});
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.calls[1][0]({}))).toMatchObject({
			name: 'text_read_15s',
			data: { audience_group: 'regular' },
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it('does not load or call an unconfigured Umami collector', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		const track = loadTracker({ url: '', website_id: '', media_id: null, segment_grant: 'signed-grant' });
		window.CinemataAnalytics.track('annotation_created');
		window.CinemataAnalytics.pageview('future_feature');
		expect(document.querySelector('script[data-website-id=""]')).toBeNull();
		expect(track).not.toHaveBeenCalled();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('honors a browser Do Not Track value of yes for Umami activity', () => {
		const fetch = vi.fn(() => Promise.resolve({ ok: true }));
		vi.stubGlobal('fetch', fetch);
		Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: 'yes' });
		try {
			const track = loadTracker({ media_id: null, path: '/story', nonpublic: false, audience_group: 'regular' });
			window.CinemataAnalytics.track('text_read_15s');
			expect(fetch).not.toHaveBeenCalled();
			expect(track).not.toHaveBeenCalled();
		} finally {
			delete navigator.doNotTrack;
		}
	});

	describe('switching to the next playlist item without a page load', () => {
		const nextId = '87654321-4321-4321-8321-cba987654321';
		const nextRevision = '11111111-2222-4333-8444-555555555555';
		const site = () => `${window.location.protocol}//${window.location.hostname}/`;
		const sent = (track) =>
			track.mock.calls.map(([value]) =>
				window.cinemataAnalyticsBeforeSend('event', 'function' === typeof value ? value({}) : value)
			);

		function readBeacon(beacon) {
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = () => resolve(JSON.parse(reader.result));
				reader.readAsText(beacon.mock.lastCall[1]);
			});
		}

		it('counts the next item as a media view and attributes later playback to it', async () => {
			const fetch = vi.fn().mockResolvedValue({});
			vi.stubGlobal('fetch', fetch);
			const beacon = vi.fn();
			Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
			Object.defineProperty(globalThis.crypto, 'randomUUID', {
				configurable: true,
				value: () => '12345678-1234-4234-8234-123456789abd',
			});
			const track = loadTracker({ nonpublic: false, audience_group: 'regular', measurement_token: 'first' });

			window.CinemataAnalytics.switchMedia({
				id: nextId,
				type: 'video',
				state: 'public',
				revision: nextRevision,
				measurement_token: 'next',
				audience_group: 'regular',
			});

			expect(window.CinemataAnalytics.mediaId).toBe(nextId);
			const [pageview, ...events] = sent(track);
			expect(pageview).toMatchObject({
				url: '/media/view',
				title: 'Media',
				tag: `media:${nextId}`,
				data: { media_id: nextId, media_type: 'video', context: 'page', revision: nextRevision },
			});
			expect(events.map((event) => [event.name, event.tag, event.data.audience_group])).toEqual([
				['page_view', `media:${nextId}`, 'regular'],
				['media_view', `media:${nextId}`, 'regular'],
			]);
			expect(events[1].data.source_domain).toBe(window.location.hostname);

			const listeners = {};
			window.CinemataAnalytics.attachPlayer({
				on: (event, callback) => {
					listeners[event] = callback;
				},
				muted: () => false,
				isFullscreen: () => false,
				duration: () => 100,
				currentTime: () => 1,
				paused: () => false,
				seeking: () => false,
				readyState: () => 4,
				ended: () => false,
			});
			listeners.play();
			listeners.pause();
			expect((await readBeacon(beacon)).token).toBe('next');
			expect(sent(track).pop().tag).toBe(`media:${nextId}`);
			expect(fetch).not.toHaveBeenCalled();
		});

		it('carries the audience group of a public item reached from a non-public page', () => {
			const track = loadTracker({ nonpublic: true });

			window.CinemataAnalytics.switchMedia({
				id: nextId,
				type: 'video',
				state: 'public',
				revision: nextRevision,
				audience_group: 'regular',
			});
			window.CinemataAnalytics.track('play');

			expect(
				sent(track)
					.filter((event) => event.name)
					.map((event) => [event.name, event.data.audience_group])
			).toEqual([
				['page_view', 'regular'],
				['media_view', 'regular'],
				['play', 'regular'],
			]);
		});

		it('keeps what happened before Umami loaded on the item it happened on', () => {
			const track = loadTracker({ nonpublic: true });
			delete window.umami;

			window.CinemataAnalytics.track('play');
			window.CinemataAnalytics.switchMedia({
				id: nextId,
				type: 'video',
				state: 'public',
				revision: nextRevision,
				audience_group: 'regular',
			});
			window.CinemataAnalytics.track('play');
			window.umami = { track };
			[...document.head.querySelectorAll('script[data-before-send="cinemataAnalyticsBeforeSend"]')]
				.pop()
				.onload();

			expect(
				sent(track).map((event) => [
					event.name || 'pageview',
					event.tag,
					event.data.audience_group,
					event.referrer,
				])
			).toEqual([
				['pageview', `media:${mediaId}`, undefined, ''],
				['play', `media:${mediaId}`, undefined, ''],
				['pageview', `media:${nextId}`, 'regular', site()],
				['page_view', `media:${nextId}`, 'regular', site()],
				['media_view', `media:${nextId}`, 'regular', site()],
				['play', `media:${nextId}`, 'regular', site()],
			]);
		});

		it('drops the audience group and the referrer for a non-public next item', () => {
			const track = loadTracker({ nonpublic: false, audience_group: 'regular' });

			window.CinemataAnalytics.switchMedia({
				id: nextId,
				type: 'video',
				state: 'unlisted',
				revision: nextRevision,
				audience_group: 'regular',
			});
			window.CinemataAnalytics.track('play');

			const events = sent(track);
			expect(events.map((event) => event.name || 'pageview')).toEqual(['pageview', 'media_view', 'play']);
			for (const event of events) {
				expect(event.data).not.toHaveProperty('audience_group');
				expect(event.referrer).toBe('');
			}
			expect(events[1].data.source_domain).toBeUndefined();
		});
	});

	it.each([true, false])('splits watch time by minute with Umami: %s', async (configured) => {
		const beacon = vi.fn();
		Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
		Object.defineProperty(globalThis.crypto, 'randomUUID', {
			configurable: true,
			value: () => '12345678-1234-4234-8234-123456789abd',
		});
		const wallClock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-01T17:00:00.500Z'));
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
		expect(body.watch_days).toEqual({ '2026-10-01T16:59Z': 500, '2026-10-01T17:00Z': 500 });
		expect(body.play_id).toBe('12345678-1234-4234-8234-123456789abd');
		now.mockRestore();
		wallClock.mockRestore();
	});
});
