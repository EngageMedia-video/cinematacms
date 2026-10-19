// Playlist items played in place while fullscreen (issue #758).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const network = vi.hoisted(() => ({ get: [], post: [] }));

vi.mock('../../functions', async (importOriginal) => ({
	...(await importOriginal()),
	getRequest: (url, sync, onSuccess, onError) => network.get.push({ url, onSuccess, onError }),
	postRequest: (url, data) => network.post.push({ url, data }),
}));

const PLAYLIST = {
	title: 'Playlist',
	playlist_media: [
		{ friendly_token: 'a', url: '/view?m=a', title: 'A title' },
		{ friendly_token: 'b', url: '/view?m=b', title: 'B title' },
		{ friendly_token: 'c', url: '/view?m=c', title: 'C title' },
	],
};

function mediaData(token, overrides = {}) {
	return {
		friendly_token: token,
		uid: `00000000-0000-4000-8000-00000000000${token.charCodeAt(0) % 10}`,
		title: `${token.toUpperCase()} title`,
		media_type: 'video',
		state: 'public',
		analytics_revision: '11111111-2222-4333-8444-555555555555',
		page_measurement_token: `grant-${token}`,
		audience_group: 'regular',
		user_can_manage_media: true,
		author_thumbnail: '',
		related_media: [],
		encodings_info: {},
		hls_info: {},
		...overrides,
	};
}

function respond(fragment, data) {
	const request = network.get.findLast(({ url }) => url.includes(fragment));
	request.onSuccess({ data });
}

describe('MediaPageStore switchMedia', () => {
	let MediaPageStore;
	let MediaPageActions;
	let member;

	beforeAll(async () => {
		const { ensureSidebarStoryMediaCMS } = await import(
			'../../../../features/layout/Sidebar/storybook/sidebarStoryHelpers.jsx'
		);
		ensureSidebarStoryMediaCMS('light');
		window.MediaCMS.mediaId = 'a';
		window.history.replaceState(null, '', '/view?m=a&pl=pl1');
		document.title = 'A title - Cinemata';

		MediaPageStore = (await import('./store.js')).default;
		MediaPageActions = await import('./actions.js');
		member = (await import('../../mediacms/config.js')).config(window.MediaCMS).member;

		MediaPageActions.loadMediaData();
		respond('playlists/pl1', PLAYLIST);
		respond('media/a', mediaData('a'));
	});

	afterEach(() => {
		delete window.CinemataAnalytics;
		vi.unstubAllGlobals();
	});

	it('moves the page to the next item without a page load', () => {
		const switched = vi.fn();
		const onFallback = vi.fn();
		MediaPageStore.on('switched_media', switched);
		window.CinemataAnalytics = { switchMedia: vi.fn() };
		MediaPageStore.set('media-load-error-type', 'encodingFailed');
		const next = mediaData('b', { user_can_manage_media: false });

		MediaPageActions.switchMedia({ friendlyToken: 'b', url: '/view?m=b&pl=pl1', onFallback });
		expect(switched).not.toHaveBeenCalled();
		respond('media/b', next);

		expect(onFallback).not.toHaveBeenCalled();
		expect(switched).toHaveBeenCalledTimes(1);
		expect(window.location.pathname + window.location.search).toBe('/view?m=b&pl=pl1');
		expect(MediaPageStore.get('media-id')).toBe('b');
		expect(window.MediaCMS.mediaId).toBe('b');
		expect(MediaPageStore.get('media-load-error-type')).toBeNull();
		expect(document.title).toBe('B title - Cinemata');
		expect(network.post).toContainEqual({
			url: expect.stringMatching(/media\/b\/actions$/),
			data: { type: 'watch' },
		});
		expect(window.CinemataAnalytics.switchMedia).toHaveBeenCalledWith({
			id: next.uid,
			type: 'video',
			state: 'public',
			revision: next.analytics_revision,
			measurement_token: 'grant-b',
			audience_group: 'regular',
		});
		expect(member.can).toMatchObject({
			editMedia: false,
			deleteMedia: false,
			editSubtitle: false,
			deleteComment: false,
		});
		MediaPageStore.removeListener('switched_media', switched);
	});

	it('reloads the next item through the normal media load', () => {
		const loaded = vi.fn();
		MediaPageStore.on('loaded_media_data', loaded);

		MediaPageActions.loadMediaData();
		respond('media/b', mediaData('b'));

		expect(loaded).toHaveBeenCalledTimes(1);
		expect(MediaPageStore.get('media-data').title).toBe('B title');
		expect(MediaPageStore.get('playlist-next-media').friendly_token).toBe('c');
		MediaPageStore.removeListener('loaded_media_data', loaded);
	});

	it.each([
		['private', (request) => request.onSuccess({ data: mediaData('c', { state: 'private' }) })],
		['not loadable', (request) => request.onError({ type: 'private' })],
	])('falls back to a normal navigation when the next item is %s', (_label, answer) => {
		const switched = vi.fn();
		const onFallback = vi.fn();
		MediaPageStore.on('switched_media', switched);
		const postsBefore = network.post.length;

		MediaPageActions.switchMedia({ friendlyToken: 'c', url: '/view?m=c&pl=pl1', onFallback });
		answer(network.get.findLast(({ url }) => url.includes('media/c')));

		expect(onFallback).toHaveBeenCalledTimes(1);
		expect(switched).not.toHaveBeenCalled();
		expect(window.location.search).toBe('?m=b&pl=pl1');
		expect(MediaPageStore.get('media-id')).toBe('b');
		expect(network.post).toHaveLength(postsBefore);
		MediaPageStore.removeListener('switched_media', switched);
	});

	it('keeps the address on this page origin when the API builds it with another one', () => {
		// Behind a TLS proxy the API can build http:// links for an https:// page.
		const switched = vi.fn();
		MediaPageStore.on('switched_media', switched);

		MediaPageActions.switchMedia({ friendlyToken: 'c', url: 'https://cinemata.test/view?m=c&pl=pl1' });
		respond('media/c', mediaData('c'));

		expect(switched).toHaveBeenCalledTimes(1);
		expect(window.location.origin + window.location.pathname + window.location.search).toBe(
			`${window.location.origin}/view?m=c&pl=pl1`
		);
		MediaPageStore.removeListener('switched_media', switched);
	});

	it('loads another item normally when history moves to it', () => {
		const reload = vi.fn();
		vi.stubGlobal('location', { ...window.location, search: '?m=a&pl=pl1', reload });

		window.dispatchEvent(new PopStateEvent('popstate'));

		expect(reload).toHaveBeenCalledTimes(1);
	});
});
