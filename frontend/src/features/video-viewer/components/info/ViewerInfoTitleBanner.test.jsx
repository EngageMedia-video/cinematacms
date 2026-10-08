import { render } from '@testing-library/react';

vi.mock('../../../../static/js/pages/MediaPage/store.js', async () => {
	const { EventEmitter } = await import('events');
	const store = new EventEmitter();
	store.get = (key) => ({ 'media-type': 'video', 'media-data': { state: 'public' } })[key] ?? null;
	return { default: store };
});

vi.mock('../../../../static/js/pages/_PageStore', () => ({
	default: { get: () => ({ pages: { media: { displayViews: true, categoriesWithTitle: false } } }) },
}));

vi.mock('../../../../static/js/contexts/SiteContext', () => ({
	default: { _currentValue: { url: 'http://localhost' } },
}));

vi.mock('../actions/MediaActions', () => ({ default: () => null }));

import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import ViewerInfoTitleBanner from './ViewerInfoTitleBanner';

const LIKE_EVENTS = ['liked_media', 'unliked_media', 'disliked_media', 'undisliked_media'];

describe('ViewerInfoTitleBanner', () => {
	// The banner remounts for every playlist item played in place (#758).
	it('stops listening for like changes once it is replaced', () => {
		const { unmount } = render(<ViewerInfoTitleBanner title="A" views={1} />);
		expect(LIKE_EVENTS.map((name) => MediaPageStore.listenerCount(name))).toEqual([1, 1, 1, 1]);

		unmount();

		expect(LIKE_EVENTS.map((name) => MediaPageStore.listenerCount(name))).toEqual([0, 0, 0, 0]);
	});
});
