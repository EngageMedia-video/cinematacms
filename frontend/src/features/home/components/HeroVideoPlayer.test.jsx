import { cleanup, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HeroVideoPlayer from './HeroVideoPlayer';

const mediaPlayerImportState = vi.hoisted(() => ({ videojs: undefined }));
const mediaPlayerDisposeMock = vi.hoisted(() => vi.fn());
const mediaPlayerMock = vi.hoisted(() =>
	vi.fn(function MediaPlayerMock() {
		this.dispose = mediaPlayerDisposeMock;
		this.player = { dispose: vi.fn() };
	})
);
const videoJsPlayerMock = vi.hoisted(() => ({
	poster: vi.fn(),
	preload: vi.fn(),
	src: vi.fn(),
	dispose: vi.fn(),
}));
const videojsMock = vi.hoisted(() => {
	const fn = vi.fn(() => videoJsPlayerMock);
	fn.getPlayer = vi.fn(() => videoJsPlayerMock);
	return fn;
});

vi.mock('@mediacms/media-player', () => {
	mediaPlayerImportState.videojs = globalThis.videojs;
	return { default: mediaPlayerMock };
});
vi.mock('video.js/dist/video.es.js', () => ({ default: videojsMock }));

describe('HeroVideoPlayer', () => {
	afterEach(() => {
		cleanup();
		mediaPlayerMock.mockClear();
		mediaPlayerDisposeMock.mockClear();
		videojsMock.mockClear();
		videojsMock.getPlayer.mockClear();
		videoJsPlayerMock.poster.mockClear();
		videoJsPlayerMock.preload.mockClear();
		videoJsPlayerMock.src.mockClear();
		videoJsPlayerMock.dispose.mockClear();
	});

	it('sets global videojs before importing the MediaCMS player package', async () => {
		render(<HeroVideoPlayer sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]} />);

		await waitFor(() => expect(mediaPlayerMock).toHaveBeenCalledTimes(1));

		expect(globalThis.videojs).toBe(videojsMock);
		expect(mediaPlayerImportState.videojs).toBe(videojsMock);
	});

	it('initializes the MediaCMS player with the proven legacy player option shape', async () => {
		const sources = [{ src: '/media/video.mp4?v=1', type: 'video/mp4' }];
		const videoInfo = { 360: { format: ['h264'], url: ['/media/video.mp4?v=1'] } };
		const subtitles = {
			languages: [{ src: '/media/captions.vtt', srclang: 'en', label: 'English' }],
		};

		const { container } = render(
			<HeroVideoPlayer
				sources={sources}
				videoInfo={videoInfo}
				poster="/media/poster.jpg"
				preload="none"
				subtitles={subtitles}
			/>
		);

		await waitFor(() => expect(mediaPlayerMock).toHaveBeenCalledTimes(1));

		const [videoNode, options, state, receivedVideoInfo] = mediaPlayerMock.mock.calls[0];
		expect(videoNode.tagName).toBe('VIDEO');
		expect(videoNode).toHaveClass('vjs-fill');
		expect(container.querySelector('source')).toBeNull();
		expect(options).toMatchObject({
			enabledTouchControls: true,
			sources,
			poster: '/media/poster.jpg',
			autoplay: false,
			preload: 'none',
			bigPlayButton: true,
			controlBar: {
				theaterMode: false,
				pictureInPicture: false,
				next: false,
				previous: false,
			},
			subtitles: {
				on: true,
				languages: subtitles.languages,
			},
		});
		expect(state).toMatchObject({
			volume: 1,
			soundMuted: false,
			theaterMode: false,
			theSelectedPlaybackSpeed: 1,
		});
		expect(receivedVideoInfo).toBe(videoInfo);
	});

	it('keeps MediaCMS touch controls enabled for tap-to-pause on mobile', async () => {
		render(<HeroVideoPlayer sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]} />);

		await waitFor(() => expect(mediaPlayerMock).toHaveBeenCalledTimes(1));

		const [, options] = mediaPlayerMock.mock.calls[0];
		expect(options.enabledTouchControls).toBe(true);
	});

	it('updates the VideoJS source when sources change after mount', async () => {
		const initialSources = [{ src: '/media/initial.mp4', type: 'video/mp4' }];
		const nextSources = [{ src: '/media/next.mp4', type: 'video/mp4' }];

		const { rerender } = render(<HeroVideoPlayer sources={initialSources} poster="/media/poster.jpg" />);
		await waitFor(() => expect(mediaPlayerMock).toHaveBeenCalledTimes(1));

		rerender(<HeroVideoPlayer sources={nextSources} poster="/media/poster-2.jpg" preload="auto" />);

		expect(videoJsPlayerMock.poster).toHaveBeenLastCalledWith('/media/poster-2.jpg');
		expect(videoJsPlayerMock.preload).toHaveBeenLastCalledWith('auto');
		expect(videoJsPlayerMock.src).toHaveBeenLastCalledWith(nextSources);
	});

	it('disposes through the MediaPlayerClass wrapper on unmount', async () => {
		const { unmount } = render(<HeroVideoPlayer sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]} />);
		await waitFor(() => expect(mediaPlayerMock).toHaveBeenCalledTimes(1));

		const disposeCallsBeforeUnmount = mediaPlayerDisposeMock.mock.calls.length;
		const videojsDisposeCallsBeforeUnmount = videoJsPlayerMock.dispose.mock.calls.length;

		unmount();

		expect(mediaPlayerDisposeMock).toHaveBeenCalledTimes(disposeCallsBeforeUnmount + 1);
		expect(videoJsPlayerMock.dispose).toHaveBeenCalledTimes(videojsDisposeCallsBeforeUnmount);
	});

	it('does not create a VideoJS player while cleaning up a cancelled async initialization', () => {
		videojsMock.getPlayer.mockReturnValueOnce(undefined);

		const { unmount } = render(<HeroVideoPlayer sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]} />);
		unmount();

		expect(videojsMock.getPlayer).toHaveBeenCalledTimes(1);
		expect(videojsMock).not.toHaveBeenCalled();
	});

	it('owns the modern hero player skin import', async () => {
		const source = await import('./HeroVideoPlayer.jsx?raw');

		expect(source.default).toContain("import './HeroVideoPlayer.css';");
	});

	it('keeps only the MediaCMS player import behind the videojs global setup', async () => {
		const source = await import('./HeroVideoPlayer.jsx?raw');

		expect(source.default).toContain("import videojs from 'video.js/dist/video.es.js';");
		expect(source.default).not.toContain("import videojs from 'video.js';");
		expect(source.default).not.toContain("import MediaPlayerClass from '@mediacms/media-player';");
		expect(source.default).not.toContain("import('video.js')");
		expect(source.default).toContain("import('@mediacms/media-player')");
		expect(source.default).toContain('mediaPlayerClassPromise = undefined;');
	});

	it('overrides plugin active indicators with shared player semantic tokens', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('var(--site-player-progress-color)');
		expect(source.default).toContain('.vjs-subtitles-control');
		expect(source.default).toContain('.vjs-selected-menu-item');
		expect(source.default).not.toContain('--hero-player-');
	});

	it('relies on global light and dark player token definitions', async () => {
		const lightTheme = await import('../../../static/css/config/_light_theme.scss?raw');
		const darkTheme = await import('../../../static/css/config/_dark_theme.scss?raw');

		expect(lightTheme.default).toContain('--site-player-progress-color: var(--cinemata-sunset-horizon-500)');
		expect(darkTheme.default).toContain('--site-player-progress-color: var(--cinemata-sunset-horizon-400p)');
	});

	it('uses Pacific Deep for the seek rail without blue-tinted control icons', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');
		const lightTheme = await import('../../../static/css/config/_light_theme.scss?raw');

		expect(source.default).toContain('color: var(--site-player-control-color) !important;');
		expect(source.default).toContain('background-color: var(--site-player-track-color) !important;');
		expect(source.default).toContain('background-color: var(--site-player-loaded-color) !important;');
		expect(lightTheme.default).toContain('--site-player-track-color: rgb(0 12 32 / 0.78);');
		expect(lightTheme.default).toContain('--site-player-loaded-color: var(--cinemata-pacific-deep-700)');
		expect(source.default).not.toContain('#b5f4ff');
		expect(source.default).not.toContain('#defbff');
	});

	it('keeps the hero play button on shared player semantic tokens', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('background-color: var(--site-player-accent-color) !important;');
		expect(source.default).toContain('background-color: var(--site-player-progress-color) !important;');
	});

	it('relies on the shared MediaCMS touch play button glyph fix', async () => {
		const source = await import('../../../../packages/vjs-plugin/src/styles.scss?raw');
		const heroSource = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('.vjs-touch-play-button');
		expect(source.default).toContain('font-family: VideoJS;');
		expect(source.default).toContain("content: '\\f101'; /* play */");
		expect(source.default).toContain("content: '\\f103'; /* pause */");
		expect(source.default).toContain("content: '\\f116'; /* replay */");
		expect(heroSource.default).not.toContain('.vjs-touch-play-button .vjs-icon-play');
	});

	it('keeps Safari fullscreen in VideoJS full-window mode for custom 5 second seek controls', async () => {
		const source = await import('../../../../packages/media-player/src/MediaPlayer.js?raw');

		expect(source.default).toContain('vjopt.playsinline = true;');
		expect(source.default).toContain('vjopt.preferFullWindow = true;');
	});

	it('keeps the hero play button in the production bottom-left placement', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('bottom: 48px !important;');
		expect(source.default).toContain('left: 48px !important;');
		expect(source.default).toContain('width: 72px !important;');
		expect(source.default).toContain('@media screen and (width <= 640px)');
		expect(source.default).toContain('bottom: 24px !important;');
		expect(source.default).toContain('width: 48px !important;');
		expect(source.default).not.toContain('top: 50% !important;');
	});

	it('keeps subtitle cues black and white instead of themed control colors', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');
		const lightTheme = await import('../../../static/css/config/_light_theme.scss?raw');

		expect(lightTheme.default).toContain('--site-player-subtitle-bg-color: rgb(0 0 0 / 0.78);');
		expect(lightTheme.default).toContain('--site-player-subtitle-color: var(--cinemata-white)');
		expect(source.default).toContain('.vjs-text-track-cue > *');
		expect(source.default).toContain('background-color: transparent !important;');
		expect(source.default).toContain('background-color: var(--site-player-subtitle-bg-color) !important;');
		expect(source.default).toContain('color: var(--site-player-subtitle-color) !important;');
		expect(source.default).not.toContain('.vjs-text-track-cue div');
	});

	it('constrains the VideoJS layout to the hero frame during shell width changes', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('position: absolute !important;');
		expect(source.default).toContain('padding-top: 0 !important;');
		expect(source.default).toContain('background-color: var(--site-player-canvas-color);');
		expect(source.default).toContain('object-fit: contain');
		expect(source.default).toContain('max-width: calc(100% - 24px)');
		expect(source.default).toContain('.vjs-bottom-bg');
		expect(source.default).toContain('var(--site-player-control-surface-color)');
		expect(source.default).toContain('right: -12px !important;');
		expect(source.default).toContain('height: 36px;');
		expect(source.default).toContain(
			'linear-gradient(to bottom, transparent, var(--site-player-control-surface-color))'
		);
	});
});
