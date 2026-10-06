import { render } from '@testing-library/react';

vi.mock('../../../../static/js/pages/MediaPage/store.js', async () => {
	const { EventEmitter } = await import('events');
	const store = new EventEmitter();
	store.get = () => null;
	return { default: store };
});

vi.mock('./AutoPlay', () => ({ AutoPlay: () => null }));
vi.mock('./RelatedMedia', () => ({ RelatedMedia: () => null }));
vi.mock('./playlist-view', () => ({ default: () => null }));

import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import ViewerSidebar from './ViewerSidebar';

describe('ViewerSidebar', () => {
	// The sidebar remounts for every playlist item played in place (#758).
	it('stops listening for media loads once it is replaced', () => {
		const { unmount } = render(<ViewerSidebar mediaId="a" playlistData={null} />);
		expect(MediaPageStore.listenerCount('loaded_media_data')).toBe(1);

		unmount();

		expect(MediaPageStore.listenerCount('loaded_media_data')).toBe(0);
	});
});
