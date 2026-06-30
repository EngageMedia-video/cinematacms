import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileQuery } from './useProfileQuery';
import { useSimilarProfiles } from './useSimilarProfiles';

vi.mock('./useProfileQuery', () => ({
	useProfileQuery: vi.fn(),
}));

describe('useSimilarProfiles', () => {
	beforeEach(() => {
		useProfileQuery.mockReset();
	});

	it('filters the user directory by the profile owner country code', () => {
		useSimilarProfiles('jen', 'PH');

		expect(useProfileQuery).toHaveBeenCalledWith(
			expect.objectContaining({
				url: '/api/v1/users?page_size=6&location=PH',
			})
		);
	});

	it('does not request unrelated profiles when the owner country is unavailable', () => {
		useSimilarProfiles('jen', '');

		expect(useProfileQuery).toHaveBeenCalledWith(expect.objectContaining({ url: '' }));
	});
});
