import { cleanup, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import HeroVideoPlayer from './HeroVideoPlayer';

const videoPlayerMock = vi.hoisted(() =>
	vi.fn(function VideoPlayerMock(props) {
		return (
			<div
				data-testid="legacy-video-player"
				data-site-id={props.siteId}
				data-site-url={props.siteUrl}
				data-sources={JSON.stringify(props.sources)}
				data-video-info={JSON.stringify(props.info)}
				data-subtitles={JSON.stringify(props.subtitlesInfo)}
				data-enable-autoplay={String(props.enableAutoplay)}
				data-in-embed={String(props.inEmbed)}
				data-has-theater-mode={String(props.hasTheaterMode)}
			/>
		);
	})
);

vi.mock('../../../static/js/components/-NEW-/VideoPlayer.js', () => ({
	VideoPlayer: videoPlayerMock,
}));

describe('HeroVideoPlayer', () => {
	afterEach(() => {
		cleanup();
		videoPlayerMock.mockClear();
		delete globalThis.MediaCMS;
	});

	it('delegates to the legacy MediaCMS VideoPlayer with hero-safe playback options', () => {
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
				subtitles={subtitles}
				className="hero-frame"
			/>
		);

		const player = screen.getByTestId('legacy-video-player');
		expect(container.firstElementChild).toHaveClass('hero-frame');
		expect(player.closest('.cinemata-hero-legacy-player')).toBeInTheDocument();
		expect(JSON.parse(player.dataset.sources)).toEqual(sources);
		expect(JSON.parse(player.dataset.videoInfo)).toEqual(videoInfo);
		expect(JSON.parse(player.dataset.subtitles)).toEqual(subtitles.languages);
		expect(player).toHaveAttribute('data-enable-autoplay', 'false');
		expect(player).toHaveAttribute('data-in-embed', 'true');
		expect(player).toHaveAttribute('data-has-theater-mode', 'false');
		expect(videoPlayerMock).toHaveBeenCalledWith(
			expect.objectContaining({
				playerVolume: '1',
				playerSoundMuted: false,
				videoQuality: 'Auto',
				videoPlaybackSpeed: 1,
				inTheaterMode: false,
				poster: '/media/poster.jpg',
				cornerLayers: {},
				previewSprite: null,
				hasNextLink: false,
				hasPreviousLink: false,
				errorMessage: null,
				debug: false,
			}),
			undefined
		);
	});

	it('uses MediaCMS site settings when the page boot payload provides them', () => {
		globalThis.MediaCMS = { site: { id: 'cinemata-site', url: 'https://cinemata.test' } };

		render(<HeroVideoPlayer sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]} />);

		const player = screen.getByTestId('legacy-video-player');
		expect(player).toHaveAttribute('data-site-id', 'cinemata-site');
		expect(player).toHaveAttribute('data-site-url', 'https://cinemata.test');
	});

	it('keeps the hero adapter on the legacy player import path', async () => {
		const source = await import('./HeroVideoPlayer.jsx?raw');

		expect(source.default).toContain(
			"import { VideoPlayer } from '../../../static/js/components/-NEW-/VideoPlayer.js';"
		);
		expect(source.default).toContain("import './HeroVideoPlayer.css';");
		expect(source.default).not.toContain('video.js/dist/video.es.js');
		expect(source.default).not.toContain("import('@mediacms/media-player')");
	});

	it('keeps the hero skin scoped around the legacy player without overriding touch glyphs', async () => {
		const source = await import('./HeroVideoPlayer.css?raw');

		expect(source.default).toContain('.cinemata-hero-legacy-player .video-js.vjs-mediacms');
		expect(source.default).toContain('background-color: var(--site-player-accent-color) !important;');
		expect(source.default).toContain('background-color: var(--site-player-progress-color) !important;');
		expect(source.default).toContain('object-fit: contain');
		expect(source.default).not.toContain('.vjs-touch-play-button .vjs-icon-play');
	});

	it('relies on the shared MediaCMS touch play button glyph fix', async () => {
		const source = await import('../../../../packages/vjs-plugin/src/styles.scss?raw');

		expect(source.default).toContain('.vjs-touch-play-button');
		expect(source.default).toContain('font-family: VideoJS;');
		expect(source.default).toContain("content: '\\f101'; /* play */");
		expect(source.default).toContain("content: '\\f103'; /* pause */");
		expect(source.default).toContain("content: '\\f116'; /* replay */");
	});

	it('keeps Safari playback inline so fullscreen can use VideoJS controls', async () => {
		const source = await import('../../../static/js/components/-NEW-/VideoPlayer.js?raw');

		expect(source.default).toContain('playsInline');
	});

	it('restores fullscreen through VideoJS so preferFullWindow is respected on Safari', async () => {
		const source = await import('../../../static/js/components/MediaViewer/VideoViewer/index.js?raw');

		expect(source.default).toContain('const player = this.playerInstance?.player;');
		expect(source.default).toContain('player.requestFullscreen()');
		expect(source.default).not.toContain('element.webkitRequestFullscreen');
	});
});
