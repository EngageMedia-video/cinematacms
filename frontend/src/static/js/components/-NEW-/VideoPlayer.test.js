import { afterEach, describe, expect, it, vi } from 'vitest';

// jsdom has no Fullscreen API, and video.js detects it when it is imported.
vi.hoisted(() => {
	let fullscreenElement = null;
	const notify = (element) => element?.dispatchEvent(new Event('fullscreenchange', { bubbles: true }));

	Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
	Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
	document.exitFullscreen = () => {
		const previous = fullscreenElement;
		fullscreenElement = null;
		notify(previous);
		return Promise.resolve();
	};
	Element.prototype.requestFullscreen = function () {
		fullscreenElement = this;
		notify(this);
		return Promise.resolve();
	};
});

import { createRef } from 'react';
import { render, waitFor } from '@testing-library/react';
import videojs from '../../videojsGlobal.js';
import { VideoPlayer, bindFullscreenToContainer } from './VideoPlayer.js';

describe('VideoPlayer fullscreenContainerRef', () => {
	afterEach(async () => {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
		}
	});

	it('sends the player fullscreen request to the given container', async () => {
		const containerRef = createRef();
		const onPlayerInit = vi.fn();
		const { unmount } = render(
			<div ref={containerRef}>
				<VideoPlayer
					siteId="test"
					siteUrl="http://localhost"
					sources={[{ src: '/media/video.mp4', type: 'video/mp4' }]}
					info={{}}
					subtitlesInfo={[]}
					inEmbed={false}
					enableAutoplay={false}
					hasTheaterMode={false}
					hasNextLink={false}
					hasPreviousLink={false}
					playerVolume={null}
					playerSoundMuted={null}
					videoQuality={null}
					videoPlaybackSpeed={null}
					inTheaterMode={null}
					fullscreenContainerRef={containerRef}
					onPlayerInitCallback={onPlayerInit}
				/>
			</div>
		);
		await waitFor(() => expect(onPlayerInit).toHaveBeenCalled());
		const player = onPlayerInit.mock.calls[0][0].player;

		await player.requestFullscreen();

		expect(document.fullscreenElement).toBe(containerRef.current);
		expect(player.isFullscreen()).toBe(true);
		unmount();
	});
});

describe('bindFullscreenToContainer', () => {
	const players = [];

	function createPlayer(parent) {
		const video = document.createElement('video');
		parent.appendChild(video);
		const player = videojs(video);
		players.push(player);
		return player;
	}

	afterEach(async () => {
		if (document.fullscreenElement) {
			await document.exitFullscreen();
		}
		players.splice(0).forEach((player) => player.dispose());
		document.body.innerHTML = '';
	});

	it('takes the stable container fullscreen and reports it as the player state', async () => {
		const container = document.body.appendChild(document.createElement('div'));
		const player = createPlayer(container);
		const changes = vi.fn();
		bindFullscreenToContainer({ player }, container);
		player.on('fullscreenchange', changes);

		await player.requestFullscreen();

		expect(document.fullscreenElement).toBe(container);
		expect(player.isFullscreen()).toBe(true);
		expect(player.hasClass('vjs-fullscreen')).toBe(true);
		expect(changes).toHaveBeenCalledTimes(1);

		await player.exitFullscreen();

		expect(document.fullscreenElement).toBeNull();
		expect(player.isFullscreen()).toBe(false);
		expect(player.hasClass('vjs-fullscreen')).toBe(false);
		expect(changes).toHaveBeenCalledTimes(2);
	});

	it('starts a replacement player in fullscreen when its container already is', async () => {
		const container = document.body.appendChild(document.createElement('div'));
		const first = createPlayer(container);
		bindFullscreenToContainer({ player: first }, container);
		await first.requestFullscreen();

		first.dispose();
		const next = createPlayer(container);
		bindFullscreenToContainer({ player: next }, container);

		expect(document.fullscreenElement).toBe(container);
		expect(next.isFullscreen()).toBe(true);
		expect(next.hasClass('vjs-fullscreen')).toBe(true);
	});

	it('leaves the default player fullscreen when no container is given', async () => {
		const player = createPlayer(document.body);
		bindFullscreenToContainer({ player }, null);

		await player.requestFullscreen();

		expect(document.fullscreenElement).toBe(player.el());
		expect(player.isFullscreen()).toBe(true);
	});
});
