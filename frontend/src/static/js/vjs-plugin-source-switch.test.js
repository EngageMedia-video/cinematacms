import videojs from 'video.js';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@mediacms/vjs-plugin-font-icons/dist/css/mediacms-vjs-icons.css', () => ({}));
vi.stubGlobal('videojs', videojs);

const { MediaCmsVjsPlugin } = await import('../../../packages/vjs-plugin/src/MediaCmsVjsPlugin.js');

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
	return { plugin, events, handlers };
}

describe('quality change source reload', () => {
	it('ends the source switch only after a playing video has resumed', async () => {
		let resume;
		const { plugin, events } = changingPlugin({
			playing: true,
			play: new Promise((resolve) => (resume = resolve)),
		});
		plugin.onVideoDataLoad();
		expect(events).toEqual(['sourceswitchstart', 'play()']);
		resume();
		await Promise.resolve();
		expect(events).toEqual(['sourceswitchstart', 'play()', 'sourceswitchend']);
	});

	it('ends the source switch when a paused video has reloaded', () => {
		const { plugin, events } = changingPlugin({ playing: false });
		plugin.onVideoDataLoad();
		expect(events).toEqual(['sourceswitchstart', 'pause()', 'sourceswitchend']);
	});

	it('ends the source switch on playing when the player returns no play promise', () => {
		const { plugin, events, handlers } = changingPlugin({ playing: true, play: undefined });
		plugin.onVideoDataLoad();
		expect(events).toEqual(['sourceswitchstart', 'play()']);
		handlers.playing();
		expect(events.at(-1)).toBe('sourceswitchend');
	});
});
