import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import searchQueryClient from '../queryClient';
import { SearchPage } from './SearchPage';

function jsonResponse(payload) {
	return {
		ok: true,
		json: async () => payload,
	};
}

const searchResult = {
	title: 'Philippines Film',
	friendly_token: 'abc123',
	url: '/media/abc123',
	thumbnail_url: '/media/thumb.jpg',
	duration: 120,
	author_name: 'Curator',
	author_profile: '/members/curator',
	views: 42,
	media_country_info: [{ title: 'Philippines' }],
	categories_info: [{ title: 'Screening', color: 'bg/primary' }],
};

describe('SearchPage', () => {
	beforeEach(() => {
		searchQueryClient.clear();
		window.history.pushState(null, '', '/search?country=Philippines&community_impact=saves');
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url) => {
				if (url.startsWith('/api/v1/categories')) {
					return jsonResponse([{ title: 'Screening', media_count: 3 }]);
				}
				if (url.startsWith('/api/v1/topics')) {
					return jsonResponse([{ title: 'Labor', media_count: 2 }]);
				}
				if (url.startsWith('/api/v1/countries')) {
					return jsonResponse([{ title: 'Philippines', media_count: 4 }]);
				}
				if (url.startsWith('/api/v1/subtitle-languages')) {
					return jsonResponse([{ code: 'en', title: 'English' }]);
				}
				if (url.startsWith('/api/v1/search')) {
					return jsonResponse({ count: 1, results: [searchResult] });
				}
				return jsonResponse({});
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		searchQueryClient.clear();
	});

	it('renders selected filters from the URL and fetches matching results', async () => {
		render(<SearchPage />);

		expect(await screen.findByText('Philippines Film')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Remove Philippines' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Remove Saves & Playlists' })).toBeInTheDocument();

		const searchUrl = globalThis.fetch.mock.calls.find(([url]) => url.startsWith('/api/v1/search'))?.[0];
		expect(searchUrl).toContain('country=Philippines');
		expect(searchUrl).toContain('community_impact=saves');
	});

	it('clears selected filter chips', async () => {
		const user = userEvent.setup();

		render(<SearchPage />);
		await screen.findByText('Philippines Film');

		await user.click(screen.getByRole('button', { name: 'Remove Philippines' }));

		await waitFor(() =>
			expect(screen.queryByRole('button', { name: 'Remove Philippines' })).not.toBeInTheDocument()
		);
	});
});
