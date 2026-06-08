import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ViewerInfoContent from './ViewerInfoContent.jsx';

const storeMocks = vi.hoisted(() => {
	const state = {
		contentSensitivity: [],
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
				if (key === 'media-content-sensitivity') return state.contentSensitivity;
				if (key === 'media-topics') return state.topics;
				if (key === 'media-data') return { edit_url: '/edit', media_type: 'video', ratings_info: [] };
				if (key === 'media-license-info') return null;
				if (key === 'display-media-license-info') return false;
				if (key === 'media-production-company') return null;
				if (key === 'media-website') return null;
				if (key === 'media-languages') return [];
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
			state.contentSensitivity = [];
			state.topics = [];
			this.pageStore.get.mockClear();
			this.mediaPageStore.get.mockClear();
			this.mediaPageStore.on.mockClear();
			this.mediaPageStore.removeListener.mockClear();
		},
	};
});

vi.mock('../../../static/js/pages/_PageStore', () => ({
	default: storeMocks.pageStore,
}));

vi.mock('../../../static/js/pages/_PageActions', () => ({
	addNotification: vi.fn(),
}));

vi.mock('../../../static/js/pages/MediaPage/store.js', () => ({
	default: storeMocks.mediaPageStore,
}));

vi.mock('../../../static/js/pages/MediaPage/actions.js', () => ({
	removeMedia: vi.fn(),
}));

vi.mock('../../../static/js/components/RatingSystem/RatingSystem', () => ({
	RatingSystem: () => null,
}));

vi.mock('../../../static/js/contexts/UserContext', () => ({
	UserConsumer: ({ children }) =>
		children({
			can: {
				deleteMedia: false,
				editMedia: false,
				editSubtitle: false,
			},
		}),
}));

vi.mock('../../../static/js/contexts/SiteContext', async () => {
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

	it('preserves paragraph breaks in more information and credits text', () => {
		const description = 'Director statement.\n\nCredits and thanks.';

		renderViewerInfoContent({ description });

		const moreInformation = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === description);

		expect(moreInformation).toHaveClass('whitespace-pre-wrap');
		expect(moreInformation.textContent).toBe(description);
	});
});
