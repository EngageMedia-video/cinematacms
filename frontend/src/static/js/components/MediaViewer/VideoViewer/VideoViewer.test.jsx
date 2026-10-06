import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';

const fakePlayer = vi.hoisted(() => ({ current: null }));

vi.mock('../../../pages/MediaPage/store.js', () => {
	const values = {};
	return {
		default: {
			values,
			get: (key) => values[key] ?? null,
			set: (key, value) => {
				values[key] = value;
			},
			on() {},
			removeListener() {},
		},
	};
});

vi.mock('../../../pages/MediaPage/actions.js', () => ({ switchMedia: vi.fn() }));

vi.mock('./store.js', () => ({ default: { get: () => null, on() {}, removeListener() {} } }));

vi.mock('../../../pages/_PageStore.js', async () => {
	const { EventEmitter } = await import('events');
	const store = new EventEmitter();
	store.get = (key) => ('config-media-item' === key ? { displayViews: true } : null);
	return { default: store };
});

vi.mock('../../../contexts/SiteContext', () => ({
	default: { _currentValue: { id: 'site', url: 'http://localhost' } },
	SiteConsumer: ({ children }) => children({ id: 'site', url: 'http://localhost' }),
}));

vi.mock('../../-NEW-/VideoPlayer.js', async () => {
	const { useEffect, useRef } = await import('react');
	const { EventEmitter } = await import('events');
	return {
		VideoPlayerError: () => null,
		VideoPlayer: function VideoPlayer(props) {
			const wrapper = useRef(null);
			useEffect(() => {
				const events = new EventEmitter();
				const el = document.createElement('div');
				el.appendChild(document.createElement('video'));
				wrapper.current.appendChild(el);
				fakePlayer.current = {
					el: () => el,
					one: (name, callback) => events.once(name, callback),
					on: (name, callback) => events.on(name, callback),
					off: (name, callback) => events.off(name, callback),
					trigger: (name) => events.emit(name),
					ready: (callback) => callback(),
					pause() {},
					play() {},
				};
				props.onPlayerInitCallback({ player: fakePlayer.current, isEnded: () => true }, el.firstChild);
			}, []);
			return <div ref={wrapper} />;
		},
	};
});

import MediaPageStore from '../../../pages/MediaPage/store.js';
import PageStore from '../../../pages/_PageStore.js';
import * as MediaPageActions from '../../../pages/MediaPage/actions.js';
import VideoViewer from './index.js';

const MEDIA = {
	friendly_token: 'a',
	title: 'A',
	encoding_status: 'success',
	encodings_info: {},
	hls_info: { master_file: '/media/hls/a/master.m3u8' },
	related_media: [],
	duration: 60,
};

describe('VideoViewer at the end of a playlist item', () => {
	let navigations;
	let fullscreenElement;

	beforeEach(() => {
		vi.useFakeTimers();
		navigations = [];
		fullscreenElement = null;
		Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
		vi.stubGlobal('location', {
			...window.location,
			pathname: '/view',
			search: '?m=a&pl=pl1',
			get href() {
				return 'http://localhost/view?m=a&pl=pl1';
			},
			set href(value) {
				navigations.push(value);
			},
		});
		Object.assign(MediaPageStore.values, {
			'playlist-id': 'pl1',
			'playlist-next-media': { friendly_token: 'b', url: '/view?m=b', title: 'B', duration: 60 },
		});
	});

	afterEach(() => {
		delete document.fullscreenElement;
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	function renderViewer(fullscreenContainerRef) {
		return render(
			<VideoViewer
				data={MEDIA}
				siteUrl="http://localhost"
				inEmbed={false}
				fullscreenContainerRef={fullscreenContainerRef}
			/>,
			{ container: fullscreenContainerRef.current }
		);
	}

	it('plays the next item in this page while the page container is fullscreen', () => {
		const containerRef = { current: document.body.appendChild(document.createElement('div')) };
		fullscreenElement = containerRef.current;
		renderViewer(containerRef);

		act(() => fakePlayer.current.trigger('ended'));
		act(() => vi.advanceTimersByTime(3000));

		expect(navigations).toEqual([]);
		expect(MediaPageActions.switchMedia).toHaveBeenCalledWith({
			friendlyToken: 'b',
			url: '/view?m=b&pl=pl1',
			onFallback: expect.any(Function),
		});

		// An item that cannot play in place keeps the fullscreen restore prompt.
		MediaPageActions.switchMedia.mock.calls[0][0].onFallback();
		expect(navigations).toEqual(['/view?m=b&pl=pl1&fs=1']);
	});

	// The viewer is replaced for every playlist item played in place.
	it('stops listening for the autoplay switch once it is replaced', () => {
		const before = PageStore.listenerCount('switched_media_auto_play');
		const containerRef = { current: document.body.appendChild(document.createElement('div')) };
		const { unmount } = renderViewer(containerRef);
		expect(PageStore.listenerCount('switched_media_auto_play')).toBe(before + 1);

		unmount();

		expect(PageStore.listenerCount('switched_media_auto_play')).toBe(before);
	});

	it('still opens the next item page when not fullscreen', () => {
		const containerRef = { current: document.body.appendChild(document.createElement('div')) };
		renderViewer(containerRef);

		act(() => fakePlayer.current.trigger('ended'));
		act(() => vi.advanceTimersByTime(3000));

		expect(MediaPageActions.switchMedia).not.toHaveBeenCalled();
		expect(navigations).toEqual(['/view?m=b&pl=pl1']);
	});
});
