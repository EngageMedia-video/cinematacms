import { act, render, screen } from '@testing-library/react';

const mounts = vi.hoisted(() => ({ player: [], info: 0, sidebar: 0, comments: [], playerProps: null }));

vi.mock('../../../../static/js/pages/MediaPage/store.js', async () => {
	const { EventEmitter } = await import('events');
	const store = new EventEmitter();
	store.values = {};
	store.get = (key) => store.values[key] ?? null;
	return { default: store };
});

vi.mock('../../../../static/js/pages/MediaPage/actions.js', () => ({ loadMediaData: vi.fn() }));

vi.mock('../../../../static/js/pages/_PageStore', () => ({
	default: { get: () => 1400, on() {}, removeListener() {} },
}));

vi.mock('../../../../static/js/pages/_PageActions', () => ({ initPage() {} }));
vi.mock('../../../../static/js/components/-NEW-/PageMain', () => ({
	default: ({ children }) => <main>{children}</main>,
}));
vi.mock('../../../../static/js/components/-NEW-/Notifications', () => ({ Notifications: () => null }));
vi.mock('../../../../static/js/components/-NEW-/VisitorPopup.jsx', () => ({ VisitorPopup: () => null }));
vi.mock('../../../../static/js/contexts/LayoutContext', () => ({ LayoutProvider: ({ children }) => children }));
vi.mock('../../../../static/js/contexts/SiteContext', () => ({
	SiteConsumer: ({ children }) => children({ id: 'site', url: 'http://localhost' }),
}));

vi.mock('../../../../static/js/components/MediaViewer/VideoViewer/store.js', () => ({
	default: { get: () => false, on() {}, removeListener() {} },
}));

vi.mock('../../../../static/js/components/MediaViewer/VideoViewer', async () => {
	const { useEffect } = await import('react');
	return {
		default: function VideoViewer(props) {
			const token = props.data.friendly_token;
			mounts.playerProps = props;
			useEffect(() => {
				mounts.player.push(`mount ${token}`);
				return () => mounts.player.push(`unmount ${token}`);
			}, [token]);
			return <div data-testid="player">{token}</div>;
		},
	};
});

vi.mock('../info/ViewerInfoVideo', async () => {
	const { useEffect } = await import('react');
	return {
		default: function ViewerInfoVideo() {
			useEffect(() => {
				mounts.info += 1;
			}, []);
			return null;
		},
	};
});

vi.mock('../sidebar/ViewerSidebar', async () => {
	const { useEffect } = await import('react');
	return {
		default: function ViewerSidebar() {
			useEffect(() => {
				mounts.sidebar += 1;
			}, []);
			return null;
		},
	};
});

vi.mock('../../comments', async () => {
	const { useEffect } = await import('react');
	return {
		CommentsSection: function CommentsSection({ friendlyToken }) {
			useEffect(() => {
				mounts.comments.push(friendlyToken);
			}, [friendlyToken]);
			return null;
		},
	};
});

vi.mock('../../private-journal/PrivateJournalSection.jsx', () => ({ PrivateJournalSection: () => null }));

import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../static/js/pages/MediaPage/actions.js';
import { VideoViewerPage } from './VideoViewerPage.jsx';

function showMedia(token) {
	MediaPageStore.values = {
		'media-id': token,
		'media-type': 'video',
		'media-data': { friendly_token: token, enable_comments: true },
		'playlist-data': { playlist_media: [] },
	};
}

describe('VideoViewerPage switching to another playlist item in place', () => {
	it('remounts the media sections inside the same fullscreen container', () => {
		const { container } = render(<VideoViewerPage />);
		showMedia('a');
		act(() => {
			MediaPageStore.emit('loaded_page_playlist_data');
			MediaPageStore.emit('loaded_media_data');
		});
		const fullscreenContainer = container.querySelector('.viewer-container');
		expect(screen.getByTestId('player')).toHaveTextContent('a');
		expect(mounts.playerProps.fullscreenContainerRef.current).toBe(fullscreenContainer);
		expect(MediaPageActions.loadMediaData).toHaveBeenCalledTimes(1);

		showMedia('b');
		act(() => MediaPageStore.emit('switched_media'));

		expect(MediaPageActions.loadMediaData).toHaveBeenCalledTimes(2);
		expect(screen.queryByTestId('player')).toBeNull();
		expect(container.querySelector('.viewer-container')).toBe(fullscreenContainer);

		act(() => MediaPageStore.emit('loaded_media_data'));

		expect(screen.getByTestId('player')).toHaveTextContent('b');
		expect(container.querySelector('.viewer-container')).toBe(fullscreenContainer);
		expect(mounts.playerProps.fullscreenContainerRef.current).toBe(fullscreenContainer);
		expect(mounts.player).toEqual(['mount a', 'unmount a', 'mount b']);
		expect(mounts.info).toBe(2);
		expect(mounts.sidebar).toBe(2);
		expect(mounts.comments).toEqual(['a', 'b']);
	});
});
