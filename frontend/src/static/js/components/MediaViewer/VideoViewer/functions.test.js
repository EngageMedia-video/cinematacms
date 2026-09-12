import { describe, expect, it, vi } from 'vitest';

// SiteContext builds itself from window.MediaCMS at module load, which is not
// available under vitest. Only `url` is read by the functions under test.
vi.mock('../../../contexts/SiteContext', () => ({
	default: { _currentValue: { url: 'https://cinemata.test' } },
	SiteConsumer: () => null,
}));

import {
	DEFAULT_NUMERIC_RESOLUTION,
	extractDefaultVideoResolution,
	selectDefaultResolution,
	videoAvailableCodecsAndResolutions,
} from './functions';

// `videoInfo` mixes numeric resolution keys with the non-numeric 'Auto' key
// that maps to the HLS master playlist (#790). Key insertion order follows
// `hls_info`, which is not sorted, so these fixtures deliberately interleave.
const withAuto = {
	1080: { format: ['hls'], url: ['/hls/media-4/stream.m3u8'] },
	240: { format: ['hls'], url: ['/hls/media-1/stream.m3u8'] },
	Auto: { format: ['hls'], url: ['/hls/master.m3u8'] },
	720: { format: ['hls'], url: ['/hls/media-3/stream.m3u8'] },
};

const withoutAuto = {
	480: { format: ['hls'], url: ['/hls/media-2/stream.m3u8'] },
	240: { format: ['hls'], url: ['/hls/media-1/stream.m3u8'] },
	720: { format: ['hls'], url: ['/hls/media-3/stream.m3u8'] },
};

describe('extractDefaultVideoResolution', () => {
	const cases = [
		{
			name: 'returns an exactly matching numeric key',
			def: 720,
			data: withAuto,
			expected: '720',
		},
		{
			name: 'returns the Auto key when Auto is available',
			def: 'Auto',
			data: withAuto,
			expected: 'Auto',
		},
		{
			// Test case 6: the non-numeric key must not snap to a numeric neighbour.
			name: 'falls back to the highest rendition when Auto is requested but absent',
			def: 'Auto',
			data: withoutAuto,
			expected: '720',
		},
		{
			name: 'snaps up to the nearest rendition at or above the request',
			def: 360,
			data: withoutAuto,
			expected: '480',
		},
		{
			name: 'clamps a request above every rendition to the highest',
			def: 4320,
			data: withoutAuto,
			expected: '720',
		},
		{
			name: 'clamps a request below every rendition to the lowest',
			def: 144,
			data: withoutAuto,
			expected: '240',
		},
		{
			name: 'returns Auto when it is the only key and a numeric resolution is requested',
			def: 1080,
			data: { Auto: { format: ['hls'], url: ['/hls/master.m3u8'] } },
			expected: 'Auto',
		},
		{
			name: 'returns undefined for an empty resolution map',
			def: 720,
			data: {},
			expected: undefined,
		},
		{
			name: 'returns undefined for a missing resolution map',
			def: 720,
			data: undefined,
			expected: undefined,
		},
	];

	it.each(cases)('$name', ({ def, data, expected }) => {
		expect(extractDefaultVideoResolution(def, data)).toBe(expected);
	});

	it('always returns a key that exists in the data, never undefined, for a populated map', () => {
		const requests = ['Auto', 144, 240, 360, 480, 720, 1080, 2160, '720', 'nonsense'];

		requests.forEach((def) => {
			[withAuto, withoutAuto].forEach((data) => {
				const resolved = extractDefaultVideoResolution(def, data);
				expect(Object.keys(data)).toContain(resolved);
			});
		});
	});
});

describe('videoAvailableCodecsAndResolutions', () => {
	it('maps master_file to the Auto key and each variant to its resolution', () => {
		const hlsInfo = {
			master_file: '/media/hls/uid/master.m3u8',
			'240_playlist': '/media/hls/uid/media-1/stream.m3u8',
			'720_playlist': '/media/hls/uid/media-3/stream.m3u8',
			// iframe playlists are not selectable renditions and must be ignored.
			'720_iframe': '/media/hls/uid/media-3/iframe.m3u8',
		};

		const result = videoAvailableCodecsAndResolutions({}, hlsInfo);

		// Test case 7: the picker is built from these keys.
		expect(Object.keys(result).sort()).toEqual(['240', '720', 'Auto']);
		expect(result.Auto.format).toEqual(['hls']);
		expect(result.Auto.url[0]).toContain('/media/hls/uid/master.m3u8');
	});

	it('omits the Auto key when no master playlist is present', () => {
		const result = videoAvailableCodecsAndResolutions({}, { '720_playlist': '/media/hls/uid/media-3/stream.m3u8' });

		expect(result.Auto).toBeUndefined();
		expect(Object.keys(result)).toEqual(['720']);
	});
});

describe('selectDefaultResolution', () => {
	// Mirrors the test-case table on #790. `storedQuality` is what
	// VideoPlayerStore.get('video-quality') returns; the store already resolves
	// a localStorage miss to 'Auto', so both the null and 'Auto' cold-start
	// forms are covered.
	const cases = [
		{
			name: 'cold start with a master playlist starts on Auto',
			storedQuality: null,
			videoInfo: withAuto,
			expected: 'Auto',
		},
		{
			name: 'cold start without a master playlist keeps the numeric default',
			storedQuality: null,
			videoInfo: withoutAuto,
			expected: DEFAULT_NUMERIC_RESOLUTION,
		},
		{
			name: 'an undefined stored preference behaves like a cold start',
			storedQuality: undefined,
			videoInfo: withAuto,
			expected: 'Auto',
		},
		{
			name: 'a stored numeric preference is honoured',
			storedQuality: 720,
			videoInfo: withAuto,
			expected: 720,
		},
		{
			name: 'a stored numeric preference is honoured even when it is not the highest',
			storedQuality: 240,
			videoInfo: withAuto,
			expected: 240,
		},
		{
			name: 'a stored Auto preference is honoured',
			storedQuality: 'Auto',
			videoInfo: withAuto,
			expected: 'Auto',
		},
		{
			name: 'a stored Auto preference falls back when no master playlist exists',
			storedQuality: 'Auto',
			videoInfo: withoutAuto,
			expected: DEFAULT_NUMERIC_RESOLUTION,
		},
		{
			name: 'a missing resolution map falls back to the numeric default',
			storedQuality: null,
			videoInfo: undefined,
			expected: DEFAULT_NUMERIC_RESOLUTION,
		},
	];

	it.each(cases)('$name', ({ storedQuality, videoInfo, expected }) => {
		expect(selectDefaultResolution(storedQuality, videoInfo)).toBe(expected);
	});
});

describe('default source selection', () => {
	// The player is handed videoInfo[resolved].url as its first source. These
	// assert the acceptance criteria on the resulting source, not on the key.
	function firstSourceFor(storedQuality, videoInfo) {
		const requested = selectDefaultResolution(storedQuality, videoInfo);
		const resolved = extractDefaultVideoResolution(requested, videoInfo);
		return videoInfo[resolved].url[0];
	}

	it('hands a cold-start viewer the master playlist', () => {
		expect(firstSourceFor(null, withAuto)).toBe('/hls/master.m3u8');
	});

	it('hands a cold-start viewer a variant playlist when no master exists', () => {
		expect(firstSourceFor(null, withoutAuto)).toBe('/hls/media-3/stream.m3u8');
	});

	it('keeps pinning a viewer with a stored numeric preference to that rendition', () => {
		expect(firstSourceFor(720, withAuto)).toBe('/hls/media-3/stream.m3u8');
		expect(firstSourceFor(240, withAuto)).toBe('/hls/media-1/stream.m3u8');
	});

	it('keeps handing a stored-Auto viewer the master playlist', () => {
		expect(firstSourceFor('Auto', withAuto)).toBe('/hls/master.m3u8');
	});

	it('never resolves to an undefined source for any stored preference', () => {
		const stored = [null, undefined, 'Auto', 144, 240, 360, 480, 720, 1080, 2160];

		stored.forEach((storedQuality) => {
			[withAuto, withoutAuto].forEach((videoInfo) => {
				expect(firstSourceFor(storedQuality, videoInfo)).toBeTruthy();
			});
		});
	});
});
