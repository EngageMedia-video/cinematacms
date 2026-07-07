import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSimilarProfiles } from '../hooks/useSimilarProfiles';
import { SimilarProfiles } from './SimilarProfiles';

vi.mock('../hooks/useSimilarProfiles', () => ({
	useSimilarProfiles: vi.fn(),
}));

describe('SimilarProfiles', () => {
	beforeEach(() => {
		useSimilarProfiles.mockReturnValue({
			data: { results: [] },
			isLoading: false,
			isError: false,
		});
	});

	it('uses the profile owner country code instead of their free-text location', () => {
		render(
			<SimilarProfiles
				author={{
					username: 'jen',
					location: 'Metro Manila, Philippines',
					location_country: 'PH',
					location_info: [{ title: 'Philippines' }],
				}}
			/>
		);

		expect(useSimilarProfiles).toHaveBeenCalledWith('jen', 'PH');
	});

	it('falls back to the structured country label for older profile payloads', () => {
		render(
			<SimilarProfiles
				author={{
					username: 'jen',
					location: 'Metro Manila, Philippines',
					location_info: [{ title: 'Philippines' }],
				}}
			/>
		);

		expect(useSimilarProfiles).toHaveBeenCalledWith('jen', 'Philippines');
	});
});
