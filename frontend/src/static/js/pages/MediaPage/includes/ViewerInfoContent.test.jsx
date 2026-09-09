import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ViewerInfoContent from './ViewerInfoContent.js';

const storeMocks = vi.hoisted(() => {
	const state = {
		countries: [],
	};

	return {
		state,
		pageStore: {
			get: vi.fn((key) => {
				if (key === 'config-options') {
					return {
						pages: {
							media: {
								categoriesWithTitle: false,
								htmlInDescription: false,
							},
						},
					};
				}

				if (key === 'config-enabled') {
					return {
						taxonomies: {
							categories: { enabled: true },
							tags: { enabled: true },
						},
					};
				}

				if (key === 'config-media-item') {
					return { displayAuthor: false };
				}

				return null;
			}),
		},
		mediaPageStore: {
			get: vi.fn((key) => {
				if (key === 'media-countries') return state.countries;
				if (key === 'media-data') return { edit_url: '/edit', media_type: 'video', ratings_info: [] };
				if (key === 'media-license-info') return null;
				if (key === 'display-media-license-info') return false;
				if (key === 'media-production-company') return null;
				if (key === 'media-website') return null;
				if (key === 'media-languages') return [];
				if (key === 'media-topics') return [];
				if (key === 'media-categories') return [];
				if (key === 'media-tags') return [];
				if (key === 'media-summary') return '';
				if (key === 'media-url') return '/media/test';
				return null;
			}),
			on: vi.fn(),
			removeListener: vi.fn(),
		},
		reset() {
			state.countries = [];
			this.pageStore.get.mockClear();
			this.mediaPageStore.get.mockClear();
		},
	};
});

vi.mock('../../_PageStore', () => ({
	default: storeMocks.pageStore,
}));

vi.mock('../../_PageActions', () => ({
	addNotification: vi.fn(),
}));

vi.mock('../store.js', () => ({
	default: storeMocks.mediaPageStore,
}));

vi.mock('../actions.js', () => ({
	removeMedia: vi.fn(),
}));

vi.mock('../../../components/-NEW-/Comments', () => ({
	default: () => null,
}));

vi.mock('../../../components/RatingSystem/RatingSystem', () => ({
	RatingSystem: () => null,
}));

vi.mock('../../../contexts/UserContext', () => ({
	UserConsumer: ({ children }) =>
		children({
			can: {
				deleteMedia: false,
				editMedia: false,
				editSubtitle: false,
			},
		}),
}));

vi.mock('../../../contexts/SiteContext', async () => {
	const ReactModule = await import('react');
	return {
		default: ReactModule.createContext({ url: '' }),
	};
});

function renderViewerInfoContent() {
	return render(
		<ViewerInfoContent
			author={{
				isManager: false,
				isTrusted: false,
				name: 'Test Author',
				thumb: '',
				url: '/members/test-author',
			}}
			description=""
			published="2026-05-31"
			yearProduced=""
		/>
	);
}

describe('ViewerInfoContent country of origin', () => {
	beforeEach(() => {
		storeMocks.reset();
	});

	it('shows the country of origin linked to its country listing', () => {
		storeMocks.state.countries = [{ title: 'Philippines', url: '/search?country=Philippines' }];

		renderViewerInfoContent();

		expect(screen.getByText('Country of origin')).toBeInTheDocument();

		const countryLink = screen.getByRole('link', { name: 'Philippines' });

		expect(countryLink).toHaveAttribute('href', '/search?country=Philippines');
	});

	it('shows the country of origin as plain text when no listing exists', () => {
		storeMocks.state.countries = [{ title: 'Philippines' }];

		renderViewerInfoContent();

		expect(screen.getByText('Country of origin')).toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Philippines' })).not.toBeInTheDocument();
		expect(screen.getByText('Philippines')).toBeInTheDocument();
	});

	it('omits the country of origin when no country is available', () => {
		renderViewerInfoContent();

		expect(screen.queryByText('Country of origin')).not.toBeInTheDocument();
	});
});
