import { cleanup, render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HeroVideoPlayer from './HeroVideoPlayer';

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

vi.mock('@mediacms/media-player', () => ({ default: mediaPlayerMock }));
vi.mock('video.js', () => ({ default: videojsMock }));

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

	it('initializes the MediaCMS player with the proven legacy player option shape', () => {
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

		expect(mediaPlayerMock).toHaveBeenCalledTimes(1);
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

	it('updates the VideoJS source when sources change after mount', () => {
		const initialSources = [{ src: '/media/initial.mp4', type: 'video/mp4' }];
		const nextSources = [{ src: '/media/next.mp4', type: 'video/mp4' }];

		const { rerender } = render(<HeroVideoPlayer sources={initialSources} poster="/media/poster.jpg" />);
		rerender(<HeroVideoPlayer sources={nextSources} poster="/media/poster-2.jpg" preload="auto" />);

		expect(videoJsPlayerMock.poster).toHaveBeenLastCalledWith('/media/poster-2.jpg');
		expect(videoJsPlayerMock.preload).toHaveBeenLastCalledWith('auto');
		expect(videoJsPlayerMock.src).toHaveBeenLastCalledWith(nextSources);
	});

	it('disposes through the MediaPlayerClass wrapper on unmount', () => {
		const { unmount } = render(<HeroVideoPlayer sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]} />);
		const disposeCallsBeforeUnmount = mediaPlayerDisposeMock.mock.calls.length;
		const videojsDisposeCallsBeforeUnmount = videoJsPlayerMock.dispose.mock.calls.length;

		unmount();

		expect(mediaPlayerDisposeMock).toHaveBeenCalledTimes(disposeCallsBeforeUnmount + 1);
		expect(videoJsPlayerMock.dispose).toHaveBeenCalledTimes(videojsDisposeCallsBeforeUnmount);
	});

	it('owns the modern hero player skin import', async () => {
		const source = await import('./HeroVideoPlayer.jsx?raw');

		expect(source.default).toContain("import './HeroVideoPlayer.css';");
	});

	it('overrides plugin active indicators with hero theme tokens', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('--hero-player-indicator-color');
		expect(source.default).toContain('.vjs-subtitles-control');
		expect(source.default).toContain('.vjs-selected-menu-item');
	});

	it('defines separate light defaults and dark-mode hero player tokens', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('body.dark_theme .video-js.vjs-mediacms.vjs-hero-player');
		expect(source.default).toContain('var(--cinemata-sunset-horizon-500');
		expect(source.default).toContain('var(--cinemata-sunset-horizon-400p');
	});

	it('uses Pacific Deep for the seek rail without blue-tinted control icons', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('--hero-player-control-color: #fff;');
		expect(source.default).toContain('--hero-player-track-color: rgb(0 12 32 / 0.78);');
		expect(source.default).toContain('--hero-player-loaded-color: var(--cinemata-pacific-deep-700');
		expect(source.default).not.toContain('#b5f4ff');
		expect(source.default).not.toContain('#defbff');
	});

	it('keeps the hero play button on its separate design-token color', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('--hero-player-play-color: var(--cinemata-strait-blue-500');
		expect(source.default).toContain('--hero-player-play-hover-color: var(--cinemata-sunset-horizon-500');
		expect(source.default).toContain('background-color: var(--hero-player-play-color) !important;');
		expect(source.default).toContain('background-color: var(--hero-player-play-hover-color) !important;');
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

		expect(source.default).toContain('--hero-player-subtitle-bg-color: rgb(0 0 0 / 0.78);');
		expect(source.default).toContain('--hero-player-subtitle-color: #fff;');
		expect(source.default).toContain('.vjs-text-track-cue > *');
		expect(source.default).toContain('background-color: transparent !important;');
		expect(source.default).toContain('background-color: var(--hero-player-subtitle-bg-color) !important;');
		expect(source.default).toContain('color: var(--hero-player-subtitle-color) !important;');
		expect(source.default).not.toContain('.vjs-text-track-cue div');
	});

	it('constrains the VideoJS layout to the hero frame during shell width changes', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('position: absolute !important;');
		expect(source.default).toContain('padding-top: 0 !important;');
		expect(source.default).toContain('--hero-player-canvas-color: #000;');
		expect(source.default).toContain('background-color: var(--hero-player-canvas-color);');
		expect(source.default).toContain('object-fit: contain');
		expect(source.default).toContain('max-width: calc(100% - 24px)');
		expect(source.default).toContain('.vjs-bottom-bg');
		expect(source.default).toContain('--hero-player-control-surface-color');
		expect(source.default).toContain('right: -12px !important;');
		expect(source.default).toContain('height: 36px;');
		expect(source.default).toContain(
			'linear-gradient(to bottom, rgb(0 0 0 / 0), var(--hero-player-control-surface-color))'
		);
	});
});
