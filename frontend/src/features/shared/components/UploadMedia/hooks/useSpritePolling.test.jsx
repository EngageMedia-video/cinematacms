import { renderHook, waitFor } from '@testing-library/react';
import { apiFetch } from '../../../utils/api';
import { clearSpritePollingCache, useSpritePolling } from './useSpritePolling';

vi.mock('../../../utils/api', () => ({
	apiFetch: vi.fn(),
}));

describe('useSpritePolling', () => {
	beforeEach(() => {
		apiFetch.mockReset();
		clearSpritePollingCache();
	});

	it('keeps loaded sprite data when only the selected thumbnail time changes', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				duration: 30,
				sprites_url: '/sprites.jpg',
				thumbnail_time: 0,
			}),
		});

		const { result, rerender } = renderHook(
			({ initialThumbnailTime }) =>
				useSpritePolling({
					friendlyToken: 'abc123',
					initialThumbnailTime,
				}),
			{ initialProps: { initialThumbnailTime: '' } }
		);

		await waitFor(() => expect(result.current.status).toBe('ready'));
		expect(result.current.spritesUrl).toBe('/sprites.jpg');

		rerender({ initialThumbnailTime: 20 });

		expect(result.current.status).toBe('ready');
		expect(result.current.spritesUrl).toBe('/sprites.jpg');
		expect(result.current.thumbnailTime).toBe(20);
	});

	it('surfaces the server sprite interval so the tile->time mapping stays authoritative', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				duration: 30,
				sprites_url: '/sprites.jpg',
				sprite_num_secs: 7,
				thumbnail_time: 0,
			}),
		});

		const { result } = renderHook(() => useSpritePolling({ friendlyToken: 'abc123' }));

		await waitFor(() => expect(result.current.status).toBe('ready'));
		expect(result.current.spriteNumSecs).toBe(7);
	});

	it('reuses cached sprite data after the selector remounts for the same media token', async () => {
		apiFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				duration: 30,
				sprites_url: '/sprites.jpg',
				thumbnail_time: 0,
			}),
		});

		const firstRender = renderHook(() => useSpritePolling({ friendlyToken: 'abc123' }));
		await waitFor(() => expect(firstRender.result.current.status).toBe('ready'));
		expect(firstRender.result.current.spritesUrl).toBe('/sprites.jpg');
		firstRender.unmount();

		const secondRender = renderHook(() => useSpritePolling({ friendlyToken: 'abc123' }));

		expect(secondRender.result.current.status).toBe('ready');
		expect(secondRender.result.current.spritesUrl).toBe('/sprites.jpg');
		expect(apiFetch).toHaveBeenCalledTimes(1);
	});
});
