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
	sessionStorage.clear();
});

function loadTracker(overrides = {}, clearCalls = true) {
	document.head.querySelectorAll('script[data-website-id]').forEach((script) => script.remove());
	for (const target of [document, window]) {
		target.addEventListener.mockRestore?.();
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
		expect(track.mock.calls.map(([build]) => build({}).name)).toEqual([undefined, 'page_view']);
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({}))).toMatchObject({
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

	describe('Referring URL on public pages', () => {
		const referredEvent = () =>
			window.cinemataAnalyticsBeforeSend('event', {
				name: 'media_view',
				tag: `media:${mediaId}`,
				data: { source_domain: 'publisher.example' },
			});
		const referredBy = (value, config = {}) => {
			Object.defineProperty(document, 'referrer', { configurable: true, value });
			loadTracker({ nonpublic: false, ...config });
			return referredEvent();
		};
		afterEach(() => {
			delete document.referrer;
		});

		it('sends an external referrer with its path and query as the browser provided it', () => {
			const payload = referredBy('https://publisher.example/reviews/film?ref=newsletter#comments');
			expect(payload.referrer).toBe('https://publisher.example/reviews/film?ref=newsletter');
			expect(payload.data.source_domain).toBe('publisher.example');
		});
		it('reduces a Cinemata referrer to its origin, since internal URLs can hold usernames and tokens', () => {
			const payload = referredBy(`${window.location.origin}/user/someone/media?token=private`);
			expect(payload.referrer).toBe(`${window.location.protocol}//${window.location.hostname}/`);
			expect(JSON.stringify(payload)).not.toMatch(/someone|private/);
		});
		it.each([
			[
				'https://cinemata.org/view?m=private',
				'https://www.cinemata.org/user/someone/?token=private',
				'https://www.cinemata.org/',
			],
			[
				'https://www.cinemata.org/view?m=private',
				'https://CINEMATA.org/user/someone/?token=private',
				'https://cinemata.org/',
			],
		])('reduces a referrer from the www alias of the Cinemata host to its origin: on %s', (page, value, origin) => {
			const pageUrl = window.location.href;
			globalThis.jsdom.reconfigure({ url: page });
			try {
				const payload = referredBy(value);
				expect(payload.referrer).toBe(origin);
				expect(JSON.stringify(payload)).not.toMatch(/someone|private/);
			} finally {
				globalThis.jsdom.reconfigure({ url: pageUrl });
			}
		});
		it('sends no referrer for nonpublic media', () => {
			expect(referredBy('https://publisher.example/reviews/film', { nonpublic: true }).referrer).toBe('');
		});
		it.each(['javascript:alert(1)', 'data:text/html,<p>film</p>', 'not a url'])(
			'drops a referrer that is not an http or https URL: %s',
			(value) => {
				expect(referredBy(value).referrer).toBe('');
			}
		);
		it('sends a long referrer whole, since Umami cuts its domain, path and query separately', () => {
			const longReferrer = `https://publisher.example/reviews?q=${'a'.repeat(600)}&page=2`;
			expect(referredBy(`${longReferrer}#comments`).referrer).toBe(longReferrer);
		});
	});

	it.each([
		[false, '/media/view?utm_source=newsletter&utm_medium=email&utm_campaign=spring+2026'],
		[true, '/media/view'],
	])('passes only valid campaign parameters on the landing view (nonpublic: %s)', (nonpublic, url) => {
		window.history.replaceState(
			null,
			'',
			'/view?m=friendly&utm_source=newsletter&utm_medium=email&utm_campaign=spring%202026&utm_term=%3Cx%3E&token=private'
		);
		try {
			const track = loadTracker({ nonpublic }, false);
			document.querySelector('script[data-website-id="site-id"]').onload();
			const views = track.mock.calls
				.map(([build]) =>
					window.cinemataAnalyticsBeforeSend('pageview', typeof build === 'function' ? build({}) : build)
				)
				.filter((payload) => !payload.name);
			expect(views.map((payload) => payload.url)).toEqual([url]);
			expect(window.cinemataAnalyticsBeforeSend('event', { name: 'like', url }).url).toBe('/media/view');
			expect(window.cinemataAnalyticsBeforeSend('pageview', { url: '/media/view?utm_source=forged' }).url).toBe(
				'/media/view'
			);
		} finally {
			window.history.replaceState(null, '', '/');
		}
	});

	it('counts an explicitly approved SPA page without sending its browser URL', () => {
		const track = loadTracker({ media_id: null, path: '/future' });
		window.CinemataAnalytics.pageview('future_feature');
		window.CinemataAnalytics.pageview('private/token');

		expect(track).toHaveBeenCalledTimes(1);
		expect(window.cinemataAnalyticsBeforeSend('pageview', track.mock.lastCall[0]({}))).toMatchObject({
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
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.calls[0][0]({})).data).toEqual({
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

describe('Public media named in Umami page and event reports', () => {
	const nextId = '87654321-4321-4321-8321-cba987654321';
	const publicFilm = { nonpublic: false, path: '/media/view', title: 'Rivers of Java' };
	const tracker = () => document.querySelector('script[data-before-send="cinemataAnalyticsBeforeSend"]');
	const sent = (track) =>
		track.mock.calls.map(([value]) =>
			window.cinemataAnalyticsBeforeSend('event', 'function' === typeof value ? value({}) : value)
		);
	const report = (event) => [event.name || 'pageview', event.url, event.title, event.data.media_title];

	afterEach(() => window.history.replaceState(null, '', '/'));

	it.each([
		[publicFilm, '/media/view', 'Rivers of Java'],
		[{ ...publicFilm, path: '/media/embed', context: 'embed' }, '/media/embed', 'Rivers of Java'],
		[{ nonpublic: true }, '/media/view', 'Media'],
	])('names the page view and media view of %j', (config, url, title) => {
		const track = loadTracker(config, false);
		tracker().onload();

		const events = sent(track).filter((event) => !event.name || event.name === 'media_view');
		expect(events.map((event) => [event.name || 'pageview', event.url, event.title])).toEqual([
			['media_view', url, title],
			['pageview', url, title],
		]);
	});

	it('keeps a title out of nonpublic media even when the page supplies one', () => {
		const track = loadTracker({ nonpublic: true, path: '/media/view', title: 'Unlisted cut' });
		window.CinemataAnalytics.track('playback_start', { initiation: 'deliberate' });

		const [event] = sent(track);
		expect(event).toMatchObject({ url: '/media/view', title: 'Media' });
		expect(event.data).not.toHaveProperty('media_title');
		expect(JSON.stringify(event)).not.toContain('Unlisted cut');
	});

	it('ranks public plays by title in Event data', () => {
		const track = loadTracker(publicFilm);
		window.CinemataAnalytics.track('playback_start', { initiation: 'deliberate' });
		expect(sent(track)[0]).toMatchObject({
			name: 'playback_start',
			url: '/media/view',
			title: 'Rivers of Java',
			data: { media_id: mediaId, media_title: 'Rivers of Java', initiation: 'deliberate' },
		});
	});

	it('leaves nonpublic plays unnamed in Event data', () => {
		const track = loadTracker({ nonpublic: true });
		window.CinemataAnalytics.track('playback_start', { initiation: 'deliberate' });
		expect(sent(track)[0]).toMatchObject({ url: '/media/view', title: 'Media', data: { media_id: mediaId } });
		expect(sent(track)[0].data).not.toHaveProperty('media_title');
	});

	it('does not name hero, playlist, workflow or private activity', () => {
		const track = loadTracker(publicFilm);
		for (const context of ['hero', 'playlist', 'workflow'])
			window.CinemataAnalytics.track('play', {}, { id: mediaId, type: 'video', context });
		window.CinemataAnalytics.track('journal_create');
		const forged = window.cinemataAnalyticsBeforeSend('event', {
			name: 'play',
			url: '/media/hero',
			tag: `media:${mediaId}`,
			data: { context: 'hero', media_title: 'Forged' },
		});

		const events = [...sent(track), forged];
		expect(events.map((event) => [event.url, event.title])).toEqual([
			['/media/hero', 'Media'],
			['/media/playlist', 'Media'],
			['/media/workflow', 'Media'],
			['/page/journal', 'Page'],
			['/media/hero', 'Media'],
		]);
		for (const event of events) expect(event.data).not.toHaveProperty('media_title');
	});

	it.each([
		['public', { state: 'public', title: 'Hero film' }, 'Hero film'],
		['unlisted', { state: 'unlisted', title: 'Hero cut' }, undefined],
		['stateless', { title: 'Hero cut' }, undefined],
	])('names %s home hero plays only when the hero media is public', (_label, item, mediaTitle) => {
		const track = loadTracker({ path: '/', media_id: null, nonpublic: false });
		window.CinemataAnalytics.track(
			'playback_start',
			{ initiation: 'deliberate' },
			{ id: nextId, type: 'video', context: 'hero', revision: mediaId, ...item }
		);

		const [event] = sent(track);
		expect(event).toMatchObject({ name: 'playback_start', url: '/media/hero', title: 'Media' });
		expect(event.data.media_id).toBe(nextId);
		expect(event.data.media_title).toBe(mediaTitle);
	});

	it('keeps a hero title on hero events, not on playlist or workflow events of the same media', () => {
		const track = loadTracker({ path: '/', media_id: null, nonpublic: false });
		const hero = { id: nextId, type: 'video', revision: mediaId, state: 'public', title: 'Hero film' };
		window.CinemataAnalytics.track('play', {}, { ...hero, context: 'hero' });
		window.CinemataAnalytics.track('playlist_remove', {}, { ...hero, context: 'playlist' });
		window.CinemataAnalytics.track('play', {}, { ...hero, context: 'workflow' });

		expect(sent(track).map((event) => [event.url, event.data.media_title])).toEqual([
			['/media/hero', 'Hero film'],
			['/media/playlist', undefined],
			['/media/workflow', undefined],
		]);
	});

	it.each([
		['a non-string title', { title: 42 }, 'Media', undefined],
		['an empty title', { title: '' }, 'Media', undefined],
		['a long title', { title: 'x'.repeat(600) }, 'x'.repeat(500), 'x'.repeat(500)],
	])('bounds %s to what Umami stores', (_label, overrides, title, mediaTitle) => {
		const track = loadTracker({ ...publicFilm, ...overrides });
		window.CinemataAnalytics.track('playback_start');

		const [event] = sent(track);
		expect(event.title).toBe(title);
		expect(event.data.media_title).toBe(mediaTitle);
	});

	it.each([
		[
			'a public item from a nonpublic one',
			{ nonpublic: true },
			{ state: 'public', title: 'Second film' },
			['/media/view', 'Second film', 'Second film'],
		],
		[
			'a nonpublic item from a public one',
			publicFilm,
			{ state: 'unlisted', title: 'Unlisted cut' },
			['/media/view', 'Media', undefined],
		],
		[
			'a public embed item',
			{ ...publicFilm, path: '/media/embed', context: 'embed' },
			{ state: 'public', title: 'Second film' },
			['/media/embed', 'Second film', 'Second film'],
		],
	])('names %s played in place', (_label, config, item, [url, title, mediaTitle]) => {
		const track = loadTracker(config);

		window.CinemataAnalytics.switchMedia({ id: nextId, type: 'video', revision: mediaId, ...item });
		window.CinemataAnalytics.track('playback_start');

		const events = sent(track);
		expect(events.map((event) => event.name || 'pageview')).toEqual(['pageview', 'media_view', 'playback_start']);
		for (const event of events)
			expect([event.url, event.title, event.data.media_title]).toEqual([url, title, mediaTitle]);
		expect(JSON.stringify(events)).not.toContain('Unlisted cut');
	});

	it('keeps a play recorded before Umami loaded on the item it happened on', () => {
		window.history.replaceState(null, '', '/view?m=Ab3dE6gH9&utm_source=newsletter');
		const track = loadTracker({ ...publicFilm, audience_group: 'regular' });
		delete window.umami;

		window.CinemataAnalytics.track('playback_start', { initiation: 'deliberate' });
		window.CinemataAnalytics.switchMedia({
			id: nextId,
			type: 'video',
			state: 'public',
			revision: mediaId,
			audience_group: 'regular',
			title: 'Second film',
		});
		window.CinemataAnalytics.track('playback_start', { initiation: 'deliberate' });
		window.umami = { track };
		[...document.head.querySelectorAll('script[data-before-send="cinemataAnalyticsBeforeSend"]')].pop().onload();

		expect(sent(track).map(report)).toEqual([
			['pageview', '/media/view?utm_source=newsletter', 'Rivers of Java', 'Rivers of Java'],
			['playback_start', '/media/view', 'Rivers of Java', 'Rivers of Java'],
			['pageview', '/media/view', 'Second film', 'Second film'],
			['page_view', '/media/view', 'Second film', 'Second film'],
			['media_view', '/media/view', 'Second film', 'Second film'],
			['playback_start', '/media/view', 'Second film', 'Second film'],
		]);
	});
});

describe('Playlists and public profiles named in Umami page and event reports', () => {
	const playlistPage = {
		media_id: null,
		nonpublic: false,
		path: '/get_playlist',
		playlist_id: mediaId,
		page_title: 'Rivers of Java',
	};
	const profilePage = {
		media_id: null,
		nonpublic: false,
		path: '/user/profile/about',
		page_title: 'Ayu Lestari',
		profile_username: 'ayu.lestari',
	};
	const loadedPage = (config) => {
		const track = loadTracker(config, false);
		document.querySelector('script[data-website-id="site-id"]').onload();
		return track.mock.calls.map(([build]) =>
			window.cinemataAnalyticsBeforeSend('event', typeof build === 'function' ? build({}) : build)
		);
	};
	const pageView = (payloads) => payloads.find((payload) => !payload.name);

	it('titles a playlist page view with the playlist title and reports it as playlist_title', () => {
		expect(pageView(loadedPage(playlistPage))).toMatchObject({
			url: '/get_playlist',
			title: 'Rivers of Java',
			tag: `playlist:${mediaId}`,
			data: { playlist_id: mediaId, playlist_title: 'Rivers of Java' },
		});
		window.CinemataAnalytics.track('playlist_link_copy');
		expect(window.cinemataAnalyticsBeforeSend('event', window.umami.track.mock.lastCall[0]({}))).toMatchObject({
			name: 'playlist_link_copy',
			title: 'Rivers of Java',
			data: { playlist_title: 'Rivers of Java' },
		});
	});
	it('titles a public profile section with the display name and reports the username', () => {
		const payload = pageView(loadedPage(profilePage));
		expect(payload).toMatchObject({
			url: '/user/profile/about',
			title: 'Ayu Lestari',
			data: { profile_username: 'ayu.lestari' },
		});
		expect(payload).not.toHaveProperty('data.playlist_title');
	});
	it('keeps a username in any script that a profile URL accepts', () => {
		expect(pageView(loadedPage({ ...profilePage, profile_username: 'đặng_văn-ân@1' })).data.profile_username).toBe(
			'đặng_văn-ân@1'
		);
	});
	it.each(['ayu/../secret', '<script>', 'a'.repeat(151), '', ['ayu']])(
		'drops a username that no profile URL could carry: %j',
		(username) => {
			expect(pageView(loadedPage({ ...profilePage, profile_username: username }))).not.toHaveProperty(
				'data.profile_username'
			);
		}
	);
	it('cuts a page title to the 500 characters Umami stores', () => {
		const payload = pageView(loadedPage({ ...playlistPage, page_title: 'x'.repeat(600) }));
		expect(payload.title).toHaveLength(500);
		expect(payload.data.playlist_title).toHaveLength(500);
	});
	it('keeps private actions and media events on a named page generic', () => {
		loadedPage({ ...profilePage, playlist_id: mediaId });
		window.CinemataAnalytics.track('contact_user_accepted');
		window.CinemataAnalytics.track('playlist_remove', {}, { id: mediaId, type: 'video', context: 'playlist' });
		window.CinemataAnalytics.pageview('future_feature');
		const [contact, media, virtualView] = window.umami.track.mock.calls
			.slice(-3)
			.map(([build]) => window.cinemataAnalyticsBeforeSend('event', build({})));
		expect(contact).toMatchObject({ url: '/page/contact', title: 'Page' });
		expect(media).toMatchObject({ url: '/media/playlist', title: 'Media' });
		expect(virtualView).toMatchObject({ url: '/page/future_feature', title: 'Page' });
		for (const payload of [contact, media])
			expect(JSON.stringify(payload)).not.toMatch(/Ayu Lestari|ayu\.lestari|playlist_title|profile_username/);
	});
	it.each([
		['profile', profilePage],
		['playlist', playlistPage],
	])('keeps the names and tag of a %s page off its in-place route views', (kind, page) => {
		loadedPage({ ...page, audience_group: 'regular' });
		const views = [];
		const capture = (build) => views.push(window.cinemataAnalyticsBeforeSend('event', build({})));
		window.umami.track = capture;
		window.CinemataAnalytics.pageview('future_feature');
		delete window.umami;
		window.CinemataAnalytics.pageview('queued_feature');
		window.umami = { track: capture };
		document.querySelector('script[data-website-id="site-id"]').onload();
		const routeViews = views.filter((view) => view.url.startsWith('/page/'));
		expect(routeViews.map((view) => [view.name, view.url])).toEqual([
			[undefined, '/page/future_feature'],
			['page_view', '/page/future_feature'],
			[undefined, '/page/queued_feature'],
			['page_view', '/page/queued_feature'],
		]);
		for (const view of routeViews) {
			expect(view).toMatchObject({ title: 'Page', data: { audience_group: 'regular' } });
			expect(view).not.toHaveProperty('tag');
			expect(JSON.stringify(view)).not.toMatch(
				new RegExp(`Ayu Lestari|ayu\\.lestari|Rivers of Java|${mediaId}|playlist_|profile_username`)
			);
		}
	});
});

describe('Downloaded file version on download clicks', () => {
	function clickDownload(file) {
		const track = loadTracker({ nonpublic: false, title: 'Rivers of Java' });
		const link = document.createElement('a');
		link.href = '/media/original/user/private-name/Rivers_of_Java.mp4';
		link.setAttribute('download', 'Rivers of Java.mp4');
		if (file !== undefined) link.dataset.analyticsFile = file;
		document.body.append(link);
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		return track.mock.calls.map(([build]) => window.cinemataAnalyticsBeforeSend('event', build({})));
	}

	it.each(['original', '720-h264', '1080-vp9', '2160-h265', '240-h264'])(
		'reports the chosen file version %s with the film title',
		(file) => {
			const payloads = clickDownload(file);
			expect(payloads).toHaveLength(1);
			expect(payloads[0]).toMatchObject({
				name: 'download_click',
				data: { media_id: mediaId, media_title: 'Rivers of Java', file },
			});
		}
	);
	it.each(['Rivers of Java.mp4', '720-av1', '999-h264', '720-H264', '/media/original/secret.mp4', '', undefined])(
		'counts the click without a file version it cannot recognise: %j',
		(file) => {
			const [payload] = clickDownload(file);
			expect(payload.name).toBe('download_click');
			expect(payload.data).not.toHaveProperty('file');
			expect(JSON.stringify(payload)).not.toMatch(/private-name|Rivers_of_Java|\.mp4|secret/);
		}
	);
	it('keeps the file property to download clicks', () => {
		loadTracker({ nonpublic: false });
		expect(
			window.cinemataAnalyticsBeforeSend('event', {
				name: 'like',
				tag: `media:${mediaId}`,
				data: { file: 'original' },
			}).data
		).not.toHaveProperty('file');
	});
});

describe('Previous Cinemata page on Umami page views', () => {
	const storageKey = 'cinemata-previous-path';
	const now = new Date('2026-11-20T09:00:00Z').getTime();
	const publicPage = { media_id: null, nonpublic: false, path: '/user/profile/home', audience_group: 'regular' };
	const remember = (saved) => sessionStorage.setItem(storageKey, JSON.stringify(saved));
	const recorded = () => JSON.parse(sessionStorage.getItem(storageKey)).path;
	const sent = (track) =>
		track.mock.calls.map(([build]) =>
			window.cinemataAnalyticsBeforeSend('event', typeof build === 'function' ? build({}) : build)
		);
	const loadedPage = (config) => {
		const track = loadTracker(config, false);
		document.querySelector('script[data-website-id="site-id"]').onload();
		return track;
	};
	const pageView = (track) => sent(track).find((payload) => !payload.name);

	afterEach(() => window.history.replaceState(null, '', '/'));

	it('reports the previous page on the page view and its page_view event and records the current page', () => {
		vi.useFakeTimers({ toFake: ['Date'], now });
		remember({ path: '/latest', time: now - 29 * 60 * 1000 });
		const payloads = sent(loadedPage({ ...publicPage, profile_username: 'ayu.lestari' }));
		expect(payloads.find((payload) => !payload.name).data.previous_path).toBe('/latest');
		expect(payloads.find((payload) => payload.name === 'page_view').data).toMatchObject({
			previous_path: '/latest',
			profile_username: 'ayu.lestari',
		});
		expect(recorded()).toBe('/user/profile/home');
	});
	it('keeps the previous page off the media_view event', () => {
		remember({ path: '/latest', time: Date.now() });
		const payloads = sent(loadedPage({ nonpublic: false, audience_group: 'regular' }));
		expect(payloads.find((payload) => payload.name === 'page_view').data.previous_path).toBe('/latest');
		expect(payloads.find((payload) => payload.name === 'media_view').data).not.toHaveProperty('previous_path');
	});
	it('forgets a previous page from an earlier visit', () => {
		vi.useFakeTimers({ toFake: ['Date'], now });
		remember({ path: '/latest', time: now - 30 * 60 * 1000 });
		expect(pageView(loadedPage(publicPage)).data).not.toHaveProperty('previous_path');
	});
	it.each([
		{ path: '/user/ayu.lestari/about', time: now },
		{ path: '/view?m=secret', time: now },
		{ path: 'https://elsewhere.example/', time: now },
		{ path: ['/latest'], time: now },
		{ path: '/latest', time: now + 1000 },
		{ path: '/latest' },
		'/latest',
	])('drops a malformed previous page: %j', (saved) => {
		vi.useFakeTimers({ toFake: ['Date'], now });
		remember(saved);
		const payload = pageView(loadedPage(publicPage));
		expect(payload.data).not.toHaveProperty('previous_path');
		expect(JSON.stringify(payload)).not.toMatch(/ayu|secret|elsewhere/);
	});
	it('ignores stored text that is not JSON', () => {
		sessionStorage.setItem(storageKey, '{not json');
		expect(pageView(loadedPage(publicPage)).data).not.toHaveProperty('previous_path');
		expect(recorded()).toBe('/user/profile/home');
	});
	it('sends no previous page from a nonpublic page but still records it', () => {
		remember({ path: '/latest', time: Date.now() });
		expect(pageView(loadedPage({ nonpublic: true }))).not.toHaveProperty('data.previous_path');
		expect(recorded()).toBe('/media/view');
	});
	it('drops a previous page sent with another named event or a private action', () => {
		loadTracker(publicPage);
		for (const name of ['like', 'media_view', 'journal_create'])
			expect(
				window.cinemataAnalyticsBeforeSend('event', { name, data: { previous_path: '/latest' } }).data
			).not.toHaveProperty('previous_path');
	});
	it('reports the server-rendered page as the previous page of an in-place route view', () => {
		const track = loadedPage(publicPage);
		window.CinemataAnalytics.pageview('future_feature');
		const views = sent(track).filter((payload) => !payload.name || payload.name === 'page_view');
		expect(views.map((view) => [view.name, view.url, view.data.previous_path])).toEqual([
			['page_view', '/user/profile/home', undefined],
			[undefined, '/user/profile/home', undefined],
			[undefined, '/page/future_feature', '/user/profile/home'],
			['page_view', '/page/future_feature', '/user/profile/home'],
		]);
		expect(recorded()).toBe('/page/future_feature');
	});
	it('reports the previous item as the previous page of a playlist item played in place', () => {
		const track = loadedPage({ nonpublic: false, audience_group: 'regular', title: 'First film' });
		window.CinemataAnalytics.switchMedia({
			id: '87654321-4321-4321-8321-cba987654321',
			title: 'Second film',
			type: 'video',
			state: 'public',
			revision: '11111111-2222-4333-8444-555555555555',
			audience_group: 'regular',
		});
		const views = sent(track).filter((payload) => !payload.name || payload.name === 'page_view');
		expect(views.map((view) => [view.name, view.data.previous_path])).toEqual([
			['page_view', undefined],
			[undefined, undefined],
			[undefined, '/media/view'],
			['page_view', '/media/view'],
		]);
	});
	it('keeps a Do Not Track page out of the tab history', () => {
		Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
		try {
			loadedPage({ nonpublic: false, audience_group: 'regular' });
			window.CinemataAnalytics.switchMedia({
				id: '87654321-4321-4321-8321-cba987654321',
				type: 'video',
				state: 'public',
				audience_group: 'regular',
			});
		} finally {
			delete navigator.doNotTrack;
		}
		const payloads = sent(loadedPage(publicPage));
		expect(payloads.find((payload) => !payload.name).data).not.toHaveProperty('previous_path');
		expect(payloads.find((payload) => payload.name === 'page_view').data).not.toHaveProperty('previous_path');
	});
	it('keeps embeds on another site out of the tab history', () => {
		const embed = { nonpublic: false, audience_group: 'regular', path: '/media/embed', context: 'embed' };
		remember({ path: '/latest', time: Date.now() });
		loadedPage(embed);
		const payloads = sent(loadedPage(embed));
		expect(payloads.find((payload) => !payload.name).data).not.toHaveProperty('previous_path');
		expect(payloads.find((payload) => payload.name === 'page_view').data).not.toHaveProperty('previous_path');
		expect(recorded()).toBe('/latest');
	});
	it('tracks the page when session storage is unavailable', () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('Storage disabled');
		});
		expect(pageView(loadedPage(publicPage))).toMatchObject({ url: '/user/profile/home' });
	});
});

describe('Umami session, device and page-speed reports', () => {
	const identity = { id: 'maker', audience_group: 'trusted' };
	const browserFields = { screen: '1440x900', language: 'en-US', id: 'maker' };
	const tracker = () => document.querySelector('script[data-before-send="cinemataAnalyticsBeforeSend"]');

	it('identifies a signed-in visitor with the username on every payload type', () => {
		const track = loadTracker({ identity });
		expect(tracker().dataset.distinctId).toBe('maker');
		window.CinemataAnalytics.track('like');
		window.CinemataAnalytics.pageview('later_route');
		for (const [build] of track.mock.calls) {
			expect(build).toBeTypeOf('function');
			expect(window.cinemataAnalyticsBeforeSend('event', build(browserFields)).id).toBe('maker');
		}
		expect(
			window.cinemataAnalyticsBeforeSend('identify', {
				...browserFields,
				website: 'site-id',
				url: 'https://cinemata.example/edit?m=private-token',
				title: 'Private film',
			})
		).toEqual({
			website: 'site-id',
			hostname: window.location.hostname,
			url: '/media/view',
			title: 'Media',
			screen: '1440x900',
			language: 'en-US',
			id: 'maker',
			data: { audience_group: 'trusted' },
		});
	});

	it("accepts the server's shortened ID for a long username", () => {
		const shortened = `${'a'.repeat(41)}~0123abcd`;
		loadTracker({ identity: { id: shortened, audience_group: 'regular' } });
		expect(tracker().dataset.distinctId).toBe(shortened);
	});

	it('rejects an ID longer than Umami stores', () => {
		loadTracker({ identity: { id: 'a'.repeat(51), audience_group: 'regular' } });
		expect(tracker().dataset.distinctId).toBeUndefined();
	});

	it('sends no distinct ID for an anonymous visitor, even a forged one', () => {
		loadTracker({ nonpublic: false, audience_group: 'anonymous' });
		expect(tracker().dataset.distinctId).toBeUndefined();
		expect(window.cinemataAnalyticsBeforeSend('event', { name: 'like', id: 'forged' })).not.toHaveProperty('id');
		expect(window.cinemataAnalyticsBeforeSend('identify', { id: 'forged' })).toBe(false);
	});

	it('keeps a well-formed screen size and browser language and drops anything else', () => {
		loadTracker();
		expect(window.cinemataAnalyticsBeforeSend('event', { screen: '390x844', language: 'pt-BR' })).toMatchObject({
			screen: '390x844',
			language: 'pt-BR',
		});
		const forged = window.cinemataAnalyticsBeforeSend('event', {
			screen: '1440x900<script>',
			language: 'en-US; private-token',
		});
		expect(forged).not.toHaveProperty('screen');
		expect(forged).not.toHaveProperty('language');
	});

	it('reports Web Vitals on the generic page path without the page title or URL', () => {
		loadTracker();
		expect(tracker().dataset.performance).toBe('true');
		expect(
			window.cinemataAnalyticsBeforeSend('performance', {
				website: 'site-id',
				url: 'https://cinemata.example/view?m=private-token',
				title: 'Private film',
				lcp: 1200.5,
				inp: 40,
				cls: 0.01,
				fcp: 800,
				ttfb: Number.NaN,
				duration: 5000,
				name: 'like',
				data: { user_id: 'private' },
			})
		).toEqual({
			website: 'site-id',
			hostname: window.location.hostname,
			url: '/media/view',
			title: 'Media',
			lcp: 1200.5,
			inp: 40,
			cls: 0.01,
			fcp: 800,
		});
	});

	const recorderScript = () => document.querySelector('script[src="https://analytics.example.org/recorder.js"]');
	function loadPublicPageAt(url, overrides = {}) {
		window.history.replaceState(null, '', url);
		loadTracker({ nonpublic: false, audience_group: 'regular', ...overrides });
		tracker().onload();
	}

	afterEach(() => window.history.replaceState(null, '', '/'));

	it.each(['/view?m=public-token', '/featured', '/view?m=public-token&utm_source=newsletter'])(
		'loads the heatmap and replay recorder after the tracker on a public page: %s',
		(url) => {
			loadPublicPageAt(url);
			expect(recorderScript().dataset.websiteId).toBe('site-id');
			expect(recorderScript().dataset.hostUrl).toBe('https://analytics.example.org');
		}
	);

	// The recorder sends location.href unfiltered with heatmap and replay data.
	it.each([
		'/search?q=private+words',
		'/view?m=public-token&pl=playlist-token',
		'/view?m=public-token&utm_source=me%40example.org',
		'/view?m=public-token#comments',
		'/user/maker',
		'/user/maker/about',
	])('does not load the recorder where the browser URL would leak: %s', (url) => {
		loadPublicPageAt(url);
		expect(recorderScript()).toBeNull();
	});

	it('does not load the recorder on nonpublic media or workflow pages', () => {
		window.history.replaceState(null, '', '/view?m=unlisted-token');
		loadTracker();
		tracker().onload();
		expect(recorderScript()).toBeNull();
	});

	it('does not load the recorder under Do Not Track', () => {
		Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
		try {
			loadTracker();
			tracker().onload();
			expect(document.querySelector('script[src="https://analytics.example.org/recorder.js"]')).toBeNull();
		} finally {
			delete navigator.doNotTrack;
		}
	});

	it.each([
		['https://www.facebook.com/sharer.php?u=x', 'fb', 'fb'],
		['mailto:?body=x', 'email', 'email'],
		['https://www.facebook.com/sharer.php?u=x', 'myspace', undefined],
	])('records which share network %s was chosen', (href, network, recorded) => {
		const track = loadTracker({ nonpublic: false });
		const link = document.createElement('a');
		link.href = href;
		link.dataset.analyticsAction = 'media_share_click';
		link.dataset.analyticsNetwork = network;
		link.addEventListener('click', (event) => event.preventDefault());
		document.body.append(link);
		link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
		const share = track.mock.calls
			.map(([build]) => window.cinemataAnalyticsBeforeSend('event', build({})))
			.find((payload) => payload.name === 'media_share_click');
		expect(share.data.network).toBe(recorded);
	});

	it.each([
		['featured', 'home_section_click'],
		[null, 'navigation_click'],
	])('counts a home link in placement %s as %s', (placement, name) => {
		const track = loadTracker({ path: '/', media_id: null, nonpublic: false });
		const container = document.createElement('div');
		if (placement) container.dataset.analyticsPlacement = placement;
		container.innerHTML = '<a href="/latest">Latest</a>';
		document.body.append(container);
		container.firstChild.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(window.cinemataAnalyticsBeforeSend('event', track.mock.lastCall[0]({})).name).toBe(name);
	});

	it('does not count the player reloading its source for a quality change as viewer actions', () => {
		const track = loadTracker();
		const listeners = {};
		let currentTime = 30;
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
		track.mockClear();
		listeners.sourceswitchstart();
		listeners.pause();
		listeners.seeking();
		listeners.play();
		listeners.sourceswitchend();
		expect(track).not.toHaveBeenCalled();
		listeners.pause();
		expect(track.mock.calls.map(([build]) => build({}).name)).toEqual(['pause']);
	});
});

describe('Umami heatmap preview', () => {
	// Umami draws a heatmap over the live page loaded in an iframe on its own origin.
	function loadTrackerFramedBy(ancestorOrigin) {
		loadTracker({ url: 'https://analytics.example.org/umami', path: '/', media_id: null, nonpublic: false });
		document.head.querySelectorAll('script[data-website-id]').forEach((script) => script.remove());
		delete window.CinemataAnalytics;
		const framedLocation = new Proxy(window.location, {
			get: (location, key) => (key === 'ancestorOrigins' ? [ancestorOrigin] : Reflect.get(location, key)),
		});
		const framedWindow = new Proxy(window, {
			get(target, key) {
				if (key === 'top') return {};
				if (key === 'location') return framedLocation;
				const value = Reflect.get(target, key);
				return typeof value === 'function' && /^[a-z]/.test(String(key)) ? value.bind(target) : value;
			},
		});
		new Function('window', 'document', 'Element', source)(framedWindow, document, Element);
	}

	it('stays silent when Umami frames the page to draw a heatmap', () => {
		loadTrackerFramedBy('https://analytics.example.org');
		expect(document.querySelector('script[data-website-id]')).toBeNull();
		expect(window.CinemataAnalytics).toBeUndefined();
	});

	it('still tracks a page framed by another site, such as a partner embed', () => {
		loadTrackerFramedBy('https://partner.example.net');
		expect(document.querySelector('script[data-website-id="site-id"]')).not.toBeNull();
		expect(window.CinemataAnalytics).toBeDefined();
	});
});
describe('Account pages counted under a generic page path', () => {
	const resetToken = '4-c3b9f2-reset-token';
	const accountPage = { path: '/page/password_reset_key', media_id: null, nonpublic: true };
	// What Umami's script adds from the browser before the payload reaches beforeSend.
	const browserFields = () => ({
		url: window.location.pathname + window.location.search,
		referrer: document.referrer,
		title: 'Change password',
	});
	const sent = (track) =>
		track.mock.calls.map(([build]) =>
			window.cinemataAnalyticsBeforeSend('event', typeof build === 'function' ? build(browserFields()) : build)
		);
	const openResetLink = () => {
		window.history.replaceState(null, '', `/accounts/password/reset/key/${resetToken}/?next=/upload`);
		Object.defineProperty(document, 'referrer', {
			configurable: true,
			value: `https://mail.example.org/inbox?message=${resetToken}`,
		});
		const track = loadTracker(accountPage, false);
		document.querySelector('script[data-website-id="site-id"]')?.onload();
		return track;
	};

	afterEach(() => {
		window.history.replaceState(null, '', '/');
		delete document.referrer;
	});

	it('counts the page without the reset key from its URL or referrer', () => {
		const payloads = sent(openResetLink());
		const view = payloads.find((payload) => !payload.name);
		expect(view).toMatchObject({ url: '/page/password_reset_key', referrer: '' });
		expect(view).not.toHaveProperty('data.audience_group');
		expect(view).not.toHaveProperty('data.previous_path');
		expect(JSON.stringify(payloads)).not.toMatch(/reset-token|mail\.example|next=/);
	});
	it('does not load the recorder, which would send the browser URL', () => {
		openResetLink();
		expect(document.querySelector('script[src="https://analytics.example.org/recorder.js"]')).toBeNull();
	});
	it('gives the next public page only the generic account path as its previous page', () => {
		openResetLink();
		vi.restoreAllMocks();
		window.history.replaceState(null, '', '/');
		const track = loadTracker({ path: '/', media_id: null, nonpublic: false, audience_group: 'regular' }, false);
		document.querySelector('script[data-website-id="site-id"]').onload();
		const view = sent(track).find((payload) => !payload.name);
		expect(view.data.previous_path).toBe('/page/password_reset_key');
	});
	it('counts a sign-in link click with only its destination category', () => {
		const track = openResetLink();
		track.mockClear();
		const link = document.createElement('a');
		link.href = `/accounts/login/?next=/accounts/password/reset/key/${resetToken}/`;
		document.body.append(link);
		link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const [payload] = sent(track);
		expect(payload).toMatchObject({ name: 'signin_click', url: '/page/password_reset_key', referrer: '' });
		expect(payload.data).toEqual({ target: 'other' });
	});
	it('sends nothing under Do Not Track', () => {
		Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '1' });
		try {
			const track = openResetLink();
			expect(track).not.toHaveBeenCalled();
		} finally {
			delete navigator.doNotTrack;
		}
	});
});
