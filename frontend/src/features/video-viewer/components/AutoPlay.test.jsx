import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AutoPlay } from './AutoPlay';

const storeMocks = vi.hoisted(() => {
	const state = { mediaData: null, autoPlay: false, displayViews: true };

	return {
		state,
		mediaPageStore: {
			get: vi.fn((key) => (key === 'media-data' ? state.mediaData : null)),
			on: vi.fn(),
			removeListener: vi.fn(),
		},
		pageStore: {
			get: vi.fn((key) => {
				if (key === 'media-auto-play') return state.autoPlay;
				if (key === 'config-media-item') return { displayViews: state.displayViews };
				return null;
			}),
			on: vi.fn(),
			removeListener: vi.fn(),
		},
		reset() {
			state.mediaData = null;
			state.autoPlay = false;
			state.displayViews = true;
		},
	};
});

vi.mock('../../../static/js/pages/MediaPage/store.js', () => ({ default: storeMocks.mediaPageStore }));
vi.mock('../../../static/js/pages/_PageStore.js', () => ({ default: storeMocks.pageStore }));
vi.mock('../../../static/js/pages/_PageActions.js', () => ({ toggleMediaAutoPlay: vi.fn() }));

vi.mock('../../shared/components/Switch/Switch', () => ({ Switch: () => <input type="checkbox" readOnly /> }));
vi.mock('../../shared/components/Text/Text', () => ({ Text: ({ children }) => <span>{children}</span> }));
vi.mock('../../home/utils/mediaList', () => ({ getMediaDurationLabel: () => null }));

vi.mock('../../shared/components/MovieItem/MovieItem', () => ({
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

describe('AutoPlay', () => {
	beforeEach(() => {
		storeMocks.reset();
	});

	it('shows the up-next category as a badge', () => {
		storeMocks.state.mediaData = {
			related_media: [
				{
					friendly_token: 'next-1',
					title: 'Next Up',
					url: '/media/next-1',
					thumbnail_url: '/thumb.jpg',
					categories_info: [{ title: 'Documentary', color: 'bg/secondary' }],
				},
			],
		};

		render(<AutoPlay />);

		expect(screen.getByText('Up next')).toBeVisible();
		const badge = screen.getByTestId('badge');
		expect(badge).toHaveTextContent('Documentary');
		expect(badge).toHaveAttribute('data-badge-color', 'bg/secondary');
	});

	it('renders no badge when the up-next media has no category', () => {
		storeMocks.state.mediaData = {
			related_media: [
				{ friendly_token: 'next-2', title: 'No Category', url: '/media/next-2', thumbnail_url: '/t.jpg' },
			],
		};

		render(<AutoPlay />);

		expect(screen.queryByTestId('badge')).not.toBeInTheDocument();
	});
});
