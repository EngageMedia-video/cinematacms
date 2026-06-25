import { act, renderHook, waitFor } from '@testing-library/react';
import { buildSpriteFrames, formatFrameTime, useSpriteFrames } from './useSpriteFrames';

class MockImage {
	static instances = [];

	constructor() {
		this.naturalHeight = 270;
		MockImage.instances.push(this);
	}

	set src(value) {
		this._src = value;
	}

	get src() {
		return this._src;
	}
}

describe('useSpriteFrames utilities', () => {
	it('formats minute and hour timestamps', () => {
		expect(formatFrameTime(0)).toBe('0:00');
		expect(formatFrameTime(741)).toBe('12:21');
		expect(formatFrameTime(3723)).toBe('1:02:03');
	});

	it('caps duration-derived frames by sprite sheet rows', () => {
		expect(buildSpriteFrames({ duration: 35, rowsInSheet: 3, spriteSecs: 10 })).toEqual([
			{ index: 0, seconds: 0, mmss: '0:00' },
			{ index: 1, seconds: 10, mmss: '0:10' },
			{ index: 2, seconds: 20, mmss: '0:20' },
		]);
	});
});

describe('useSpriteFrames', () => {
	const OriginalImage = global.Image;

	beforeEach(() => {
		MockImage.instances = [];
		global.Image = MockImage;
	});

	afterEach(() => {
		global.Image = OriginalImage;
	});

	it('derives frame rows from the loaded sprite image', async () => {
		const { result } = renderHook(() =>
			useSpriteFrames({ spritesUrl: '/sprites.jpg', duration: 100, spriteSecs: 10 })
		);

		expect(result.current.status).toBe('loading');

		act(() => {
			MockImage.instances[0].onload();
		});

		await waitFor(() => expect(result.current.status).toBe('ready'));
		expect(result.current.frames).toHaveLength(3);
		expect(result.current.frames[2]).toEqual({ index: 2, seconds: 20, mmss: '0:20' });
	});

	it('reuses cached sprite rows without returning to loading', () => {
		const { result } = renderHook(() =>
			useSpriteFrames({ spritesUrl: '/sprites.jpg', duration: 100, spriteSecs: 10 })
		);

		expect(result.current.status).toBe('ready');
		expect(result.current.frames).toHaveLength(3);
	});
});
