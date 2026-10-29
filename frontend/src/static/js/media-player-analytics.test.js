import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@mediacms/vjs-plugin', () => ({ default: {} }));
vi.mock('@mediacms/vjs-plugin/dist/mediacms-vjs-plugin.css', () => ({}));

const { MediaPlayer } = await import('../../../packages/media-player/src/MediaPlayer.js');

const initialState = {
	volume: 1,
	theaterMode: false,
	soundMuted: false,
	quality: 'Auto',
	playbackSpeed: 1,
	subtitle: null,
};

function mergeOptions(...sources) {
	const merged = {};
	for (const source of sources)
		for (const [key, value] of Object.entries(source))
			merged[key] =
				value && typeof value === 'object' && !Array.isArray(value)
					? mergeOptions(merged[key] || {}, value)
					: value;
	return merged;
}

function startPlayer() {
	let stateUpdate;
	const plugin = { publicState: () => ({ ...initialState }) };
	const player = {
		mediaCmsVjsPlugin: (...args) => {
			if (args.length) stateUpdate = args[5];
			return plugin;
		},
	};
	vi.stubGlobal(
		'videojs',
		Object.assign(() => player, { mergeOptions })
	);
	const track = vi.fn();
	vi.stubGlobal('CinemataAnalytics', { attachPlayer: vi.fn(), track, mediaId: 'media' });
	new MediaPlayer(document.createElement('video'), {}, {}, {}, [1, 1.5], null, null, null, { id: 'media' });
	return { stateUpdate, track };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('media player analytics', () => {
	it('tracks the first settings change after load', () => {
		const { stateUpdate, track } = startPlayer();

		stateUpdate({ ...initialState, playbackSpeed: 1.5 });

		expect(track).toHaveBeenCalledTimes(1);
		expect(track).toHaveBeenCalledWith('speed_change', {}, { id: 'media' });
	});

	it('ignores state updates that leave the tracked settings unchanged', () => {
		const { stateUpdate, track } = startPlayer();

		stateUpdate({ ...initialState, volume: 0.4, soundMuted: true });

		expect(track).not.toHaveBeenCalled();
	});
});
