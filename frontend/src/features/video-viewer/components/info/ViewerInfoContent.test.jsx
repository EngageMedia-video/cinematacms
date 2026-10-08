import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ViewerInfoContent from './ViewerInfoContent.jsx';

const storeMocks = vi.hoisted(() => {
	const state = {
		contentSensitivity: [],
		countries: [],
		htmlInDescription: false,
		summary: '',
		topics: [],
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
								htmlInDescription: state.htmlInDescription,
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
				if (key === 'media-content-sensitivity') return state.contentSensitivity;
				if (key === 'media-countries') return state.countries;
				if (key === 'media-topics') return state.topics;
				if (key === 'media-data') return { edit_url: '/edit', media_type: 'video', ratings_info: [] };
				if (key === 'media-license-info') return null;
				if (key === 'display-media-license-info') return false;
				if (key === 'media-production-company') return null;
				if (key === 'media-website') return null;
				if (key === 'media-languages') return [];
				if (key === 'media-categories') return [];
				if (key === 'media-tags') return [];
				if (key === 'media-summary') return state.summary;
				if (key === 'media-url') return '/media/test';
				return null;
			}),
			on: vi.fn(),
			removeListener: vi.fn(),
		},
		reset() {
			state.contentSensitivity = [];
			state.countries = [];
			state.htmlInDescription = false;
			state.summary = '';
			state.topics = [];
			this.pageStore.get.mockClear();
			this.mediaPageStore.get.mockClear();
			this.mediaPageStore.on.mockClear();
			this.mediaPageStore.removeListener.mockClear();
		},
	};
});

vi.mock('../../../../static/js/pages/_PageStore', () => ({
	default: storeMocks.pageStore,
}));

vi.mock('../../../../static/js/pages/_PageActions', () => ({
	addNotification: vi.fn(),
}));

vi.mock('../../../../static/js/pages/MediaPage/store.js', () => ({
	default: storeMocks.mediaPageStore,
}));

vi.mock('../../../../static/js/pages/MediaPage/actions.js', () => ({
	removeMedia: vi.fn(),
}));

vi.mock('../../../../static/js/components/RatingSystem/RatingSystem', () => ({
	RatingSystem: () => null,
}));

vi.mock('../../../../static/js/contexts/UserContext', () => ({
	UserConsumer: ({ children }) =>
		children({
			can: {
				deleteMedia: false,
				editMedia: false,
				editSubtitle: false,
			},
		}),
}));

vi.mock('../../../../static/js/contexts/SiteContext', async () => {
	const ReactModule = await import('react');
	return {
		default: ReactModule.createContext({ url: '' }),
	};
});

function renderViewerInfoContent(overrides = {}) {
	return render(
		<ViewerInfoContent
			author={{
				isManager: false,
				isTrusted: false,
				name: 'Test Author',
				thumb: '',
				url: '/members/test-author',
			}}
			description={overrides.description ?? ''}
			published="2026-05-31"
			yearProduced=""
		/>
	);
}

describe('ViewerInfoContent', () => {
	beforeEach(() => {
		storeMocks.reset();
	});

	it('shows content sensitivity below topic metadata when present', () => {
		storeMocks.state.topics = [{ title: 'Labor Rights', url: '/topics/labor-rights' }];
		storeMocks.state.contentSensitivity = [{ title: 'Graphic Violence' }, { title: 'Strong Language' }];

		renderViewerInfoContent();

		const topicLabel = screen.getByText('Topic');
		const contentSensitivityLabel = screen.getByText('Content Sensitivity');

		expect(screen.getByText('Labor Rights')).toBeInTheDocument();
		expect(screen.getByText(/Graphic Violence/)).toBeInTheDocument();
		expect(screen.getByText(/Strong Language/)).toBeInTheDocument();
		expect(topicLabel.compareDocumentPosition(contentSensitivityLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING
		);
	});

	it('omits content sensitivity metadata when no values are available', () => {
		storeMocks.state.topics = [{ title: 'Labor Rights', url: '/topics/labor-rights' }];

		renderViewerInfoContent();

		expect(screen.queryByText('Content Sensitivity')).not.toBeInTheDocument();
	});

	it('shows the country of origin linked to its country listing', () => {
		storeMocks.state.countries = [{ title: 'Philippines', url: '/search?country=Philippines' }];

		renderViewerInfoContent();

		expect(screen.getByText('Country of origin')).toBeInTheDocument();

		const countryLink = screen.getByRole('link', { name: 'Philippines' });

		expect(countryLink).toHaveAttribute('href', '/search?country=Philippines');
		expect(countryLink).toHaveClass('text-text-link');
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

	it('preserves paragraph breaks in more information and credits text', () => {
		const description = 'Director statement.\n\nCredits and thanks.';

		renderViewerInfoContent({ description });

		const moreInformation = screen.getByText(
			(_, element) => element?.tagName === 'P' && element.textContent === description
		);

		expect(moreInformation).toHaveClass('whitespace-pre-wrap');
		expect(moreInformation.textContent).toBe(description);
	});

	describe('links in user-supplied text', () => {
		it('links a bare URL in more information and credits', () => {
			renderViewerInfoContent({ description: 'Full credits at https://cinemata.org/credits.' });

			const link = screen.getByRole('link', { name: 'https://cinemata.org/credits' });
			expect(link).toHaveAttribute('href', 'https://cinemata.org/credits');
			expect(link).toHaveAttribute('rel', 'nofollow noopener');
			expect(link).not.toHaveAttribute('target');
		});

		it('links a bare URL in the synopsis', () => {
			storeMocks.state.summary = 'Made with www.engagemedia.org';

			renderViewerInfoContent();

			expect(screen.getByRole('link', { name: 'www.engagemedia.org' })).toHaveAttribute(
				'href',
				'https://www.engagemedia.org/'
			);
		});

		it('escapes markup before linking, even when HTML descriptions are enabled', () => {
			storeMocks.state.htmlInDescription = true;
			storeMocks.state.summary = '<b>Bold</b> synopsis';
			const description = '<img src="x" onerror="alert(1)"> See https://cinemata.org';

			const { container } = renderViewerInfoContent({ description });

			expect(container.querySelector('img')).toBeNull();
			expect(container.querySelector('b')).toBeNull();
			expect(screen.getByText(/<b>Bold<\/b> synopsis/)).toBeInTheDocument();
			expect(screen.getByRole('link', { name: 'https://cinemata.org' })).toBeInTheDocument();
		});

		it('links a timestamp in the description to that moment of the media', () => {
			renderViewerInfoContent({ description: 'The river scene starts at 1:05.' });

			expect(screen.getByRole('link', { name: '1:05' })).toHaveAttribute('href', '/media/test?t=65');
		});

		it('links feature-length and hour timestamps in the description', () => {
			renderViewerInfoContent({ description: 'Part two starts at 75:30, the epilogue at 1:42:05.' });

			expect(screen.getByRole('link', { name: '75:30' })).toHaveAttribute('href', '/media/test?t=4530');
			expect(screen.getByRole('link', { name: '1:42:05' })).toHaveAttribute('href', '/media/test?t=6125');
		});

		it('keeps a timestamp inside a URL as part of the link', () => {
			renderViewerInfoContent({ description: 'Excerpt: https://example.org/clip?t=1:30' });

			expect(screen.getByRole('link', { name: 'https://example.org/clip?t=1:30' })).toBeInTheDocument();
			expect(screen.queryByRole('link', { name: '1:30' })).not.toBeInTheDocument();
		});
	});
});
