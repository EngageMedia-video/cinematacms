import { renderHook } from '@testing-library/react';
import { usePausePlayerWhileOpen } from './usePausePlayerWhileOpen';
import { getVideoPlayer } from '../../comments/utils/videoPlayer';

vi.mock('../../comments/utils/videoPlayer', () => ({
	getVideoPlayer: vi.fn(),
}));

function createMockPlayer({ paused = false } = {}) {
	return {
		paused: vi.fn(() => paused),
		pause: vi.fn(),
		play: vi.fn(() => Promise.resolve()),
	};
}

describe('usePausePlayerWhileOpen', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('pauses a playing video when the dialog opens', () => {
		const player = createMockPlayer({ paused: false });
		getVideoPlayer.mockReturnValue(player);

		const { rerender } = renderHook(({ isOpen }) => usePausePlayerWhileOpen(isOpen), {
			initialProps: { isOpen: false },
		});
		rerender({ isOpen: true });

		expect(player.pause).toHaveBeenCalledTimes(1);
	});

	it('resumes playback on close only when the hook paused it', () => {
		const player = createMockPlayer({ paused: false });
		getVideoPlayer.mockReturnValue(player);

		const { rerender } = renderHook(({ isOpen }) => usePausePlayerWhileOpen(isOpen), {
			initialProps: { isOpen: false },
		});
		rerender({ isOpen: true });
		rerender({ isOpen: false });

		expect(player.play).toHaveBeenCalledTimes(1);
	});

	it('does not pause or resume when the video was already paused', () => {
		const player = createMockPlayer({ paused: true });
		getVideoPlayer.mockReturnValue(player);

		const { rerender } = renderHook(({ isOpen }) => usePausePlayerWhileOpen(isOpen), {
			initialProps: { isOpen: false },
		});
		rerender({ isOpen: true });
		rerender({ isOpen: false });

		expect(player.pause).not.toHaveBeenCalled();
		expect(player.play).not.toHaveBeenCalled();
	});

	it('pauses and resumes again across repeated open/close cycles', () => {
		const player = createMockPlayer({ paused: false });
		getVideoPlayer.mockReturnValue(player);

		const { rerender } = renderHook(({ isOpen }) => usePausePlayerWhileOpen(isOpen), {
			initialProps: { isOpen: false },
		});
		rerender({ isOpen: true });
		rerender({ isOpen: false });
		rerender({ isOpen: true });
		rerender({ isOpen: false });

		expect(player.pause).toHaveBeenCalledTimes(2);
		expect(player.play).toHaveBeenCalledTimes(2);
	});

	it('swallows a rejected play() promise on resume', async () => {
		const player = createMockPlayer({ paused: false });
		player.play = vi.fn(() => Promise.reject(new Error('autoplay blocked')));
		getVideoPlayer.mockReturnValue(player);

		const { rerender } = renderHook(({ isOpen }) => usePausePlayerWhileOpen(isOpen), {
			initialProps: { isOpen: false },
		});
		rerender({ isOpen: true });
		rerender({ isOpen: false });

		expect(player.play).toHaveBeenCalledTimes(1);
		// Flush the rejected promise; an unhandled rejection would fail the test.
		await new Promise((resolve) => setTimeout(resolve, 0));
	});

	it('does nothing when no player is on the page', () => {
		getVideoPlayer.mockReturnValue(null);

		const { rerender } = renderHook(({ isOpen }) => usePausePlayerWhileOpen(isOpen), {
			initialProps: { isOpen: false },
		});

		expect(() => rerender({ isOpen: true })).not.toThrow();
	});
});
