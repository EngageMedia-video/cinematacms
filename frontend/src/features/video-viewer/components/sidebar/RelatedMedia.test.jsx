import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RelatedMedia } from './RelatedMedia';

const storeMocks = vi.hoisted(() => {
	const listeners = new Map();
	const state = {
		initialSize: 2,
		mediaType: 'image',
		mediaData: null,
	};

	return {
		state,
		pageStore: {
			get: vi.fn((key) => {
				if (key === 'config-options') {
					return { pages: { media: { related: { initialSize: state.initialSize } } } };
				}

				if (key === 'config-media-item') {
					return { displayViews: true };
				}

				return null;
			}),
		},
		mediaPageStore: {
			get: vi.fn((key) => {
				if (key === 'media-type') return state.mediaType;
				if (key === 'media-data') return state.mediaData;
				return null;
			}),
			on: vi.fn((eventName, callback) => {
				listeners.set(eventName, [...(listeners.get(eventName) || []), callback]);
			}),
			removeListener: vi.fn((eventName, callback) => {
				listeners.set(
					eventName,
					(listeners.get(eventName) || []).filter((listener) => listener !== callback)
				);
			}),
			emit(eventName) {
				(listeners.get(eventName) || []).forEach((listener) => listener());
			},
		},
		reset() {
			listeners.clear();
			state.initialSize = 2;
			state.mediaType = 'image';
			state.mediaData = null;
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

vi.mock('../../../../static/js/pages/MediaPage/store.js', () => ({
	default: storeMocks.mediaPageStore,
}));

vi.mock('../../../shared/components/MovieItem/MovieItem', () => ({
	HorizontalMovieItem: ({ title, badge, badgeColor }) => (
		<article>
			{title}
			{badge ? (
				<span data-testid="badge" data-badge-color={badgeColor}>
					{badge}
				</span>
			) : null}
		</article>
	),
}));

vi.mock('../../../home/utils/mediaList', () => ({
	getMediaDurationLabel: () => null,
}));

vi.mock('../../utils/mediaCardMetadata', async (importOriginal) => ({
	...(await importOriginal()),
	buildMetadata: () => [],
	getAuthorLink: () => null,
	getAuthorName: () => null,
}));

function makeRelatedMedia(count) {
	return Array.from({ length: count }, (_, index) => ({
		friendly_token: `media-${index + 1}`,
		title: `Media ${index + 1}`,
		url: `/media/${index + 1}`,
		thumbnail_url: `/thumb-${index + 1}.jpg`,
	}));
}

describe('RelatedMedia', () => {
	let triggerIntersection;
	let observe;
	let disconnect;

	beforeEach(() => {
		storeMocks.reset();
		observe = vi.fn();
		disconnect = vi.fn();
		triggerIntersection = null;

		globalThis.IntersectionObserver = vi.fn(function IntersectionObserverMock(callback) {
			triggerIntersection = callback;
			return { observe, disconnect };
		});
	});

	it('loads the next related media page when the bottom sentinel enters view', () => {
		storeMocks.state.mediaData = { related_media: makeRelatedMedia(5) };

		render(<RelatedMedia hideFirst={false} />);

		expect(screen.getByText('Media 1')).toBeVisible();
		expect(screen.getByText('Media 2')).toBeVisible();
		expect(screen.queryByText('Media 3')).not.toBeInTheDocument();
		expect(screen.queryByText('SHOW MORE')).not.toBeInTheDocument();
		expect(observe).toHaveBeenCalledTimes(1);

		act(() => {
			triggerIntersection([{ isIntersecting: true }]);
		});

		expect(screen.getByText('Media 3')).toBeVisible();
		expect(screen.getByText('Media 4')).toBeVisible();
		expect(screen.queryByText('Media 5')).not.toBeInTheDocument();

		act(() => {
			triggerIntersection([{ isIntersecting: true }]);
		});

		expect(screen.getByText('Media 5')).toBeVisible();
	});

	it('shows the first category as a badge, matching the homepage tile', () => {
		storeMocks.state.mediaData = {
			related_media: [
				{
					friendly_token: 'with-category',
					title: 'Has Category',
					url: '/media/with-category',
					thumbnail_url: '/thumb-a.jpg',
					categories_info: [
						{ title: 'Documentary', color: 'bg/secondary' },
						{ title: 'Experimental', color: 'bg/primary' },
					],
				},
				{
					friendly_token: 'no-category',
					title: 'No Category',
					url: '/media/no-category',
					thumbnail_url: '/thumb-b.jpg',
				},
			],
		};

		render(<RelatedMedia hideFirst={false} />);

		const badges = screen.getAllByTestId('badge');
		expect(badges).toHaveLength(1);
		expect(badges[0]).toHaveTextContent('Documentary');
		expect(badges[0]).toHaveAttribute('data-badge-color', 'bg/secondary');
	});
});
