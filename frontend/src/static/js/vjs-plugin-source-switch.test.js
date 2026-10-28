import videojs from 'video.js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mediacms/vjs-plugin-font-icons/dist/css/mediacms-vjs-icons.css', () => ({}));
vi.stubGlobal('videojs', videojs);

const { MediaCmsVjsPlugin } = await import('../../../packages/vjs-plugin/src/MediaCmsVjsPlugin.js');

const settle = () => new Promise((resolve) => setTimeout(resolve));

function changingPlugin({ playing, play }) {
	const events = [];
	const handlers = {};
	const player = {
		trigger: (name) => events.push(name),
		one: (name, callback) => {
			handlers[name] = callback;
		},
		play: vi.fn(() => {
			events.push('play()');
			return play;
		}),
		pause: vi.fn(() => events.push('pause()')),
		paused: () => !playing,
		hasStarted: () => true,
		addClass: () => {},
		removeClass: () => {},
		currentTime: () => 30,
		duration: () => 100,
		src: () => {},
		techCall_: () => {},
		playbackRate: () => {},
		tech_: {},
	};
	const plugin = Object.assign(Object.create(MediaCmsVjsPlugin.prototype), {
		player,
		state: { theSelectedQuality: '720', theSelectedPlaybackSpeed: 1 },
		videoResolutions: { 720: { src: ['/720.m3u8'] } },
		onBandwidthUpdate: null,
		onHlsRetryPlaylist: null,
		changeVideoSubtitle: () => {},
		player_: player,
	});
	plugin.changeVideoResolution();
	// video.js restores the saved position on `canplay`, which can come after the resume.
	const restorePosition = async () => {
		events.push('seeked');
		handlers.seeked();
		await settle();
	};
	return { plugin, events, handlers, restorePosition };
}

describe('quality change source reload', () => {
	it('ends the source switch only after a playing video has resumed at its restored position', async () => {
		let resume;
		const { plugin, events, restorePosition } = changingPlugin({
			playing: true,
			play: new Promise((resolve) => (resume = resolve)),
		});
		plugin.onVideoDataLoad();
		resume();
		await settle();
		expect(events).toEqual(['sourceswitchstart', 'play()']);
		await restorePosition();
		expect(events).toEqual(['sourceswitchstart', 'play()', 'seeked', 'sourceswitchend']);
	});

	it('ends the source switch after a paused video has reloaded at its restored position', async () => {
		const { plugin, events, restorePosition } = changingPlugin({ playing: false });
		plugin.onVideoDataLoad();
		await settle();
		expect(events).toEqual(['sourceswitchstart', 'pause()']);
		await restorePosition();
		expect(events).toEqual(['sourceswitchstart', 'pause()', 'seeked', 'sourceswitchend']);
	});

	it('ends the source switch on playing when the player returns no play promise', async () => {
		const { plugin, events, handlers, restorePosition } = changingPlugin({ playing: true, play: undefined });
		plugin.onVideoDataLoad();
		await restorePosition();
		expect(events).not.toContain('sourceswitchend');
		handlers.playing();
		await settle();
		expect(events.at(-1)).toBe('sourceswitchend');
	});
});
