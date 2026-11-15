import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../static/js/pages/MediaPage/store.js', () => ({
	default: { get: vi.fn(() => null), on: vi.fn(), removeListener: vi.fn() },
}));

vi.mock('./MediaLikeIcon', () => ({ MediaLikeIcon: () => <div>Like action</div> }));
vi.mock('./MediaSaveButton', () => ({ MediaSaveButton: () => <div>Save action</div> }));
vi.mock('./MediaShareButton', () => ({ MediaShareButton: () => <div>Share action</div> }));
vi.mock('./MediaReportButton', () => ({ MediaReportButton: () => <div>Report action</div> }));
vi.mock('./VideoMediaDownloadLink', () => ({ VideoMediaDownloadLink: () => <div>Download action</div> }));
vi.mock('./OtherMediaDownloadLink', () => ({ OtherMediaDownloadLink: () => <div>Download action</div> }));

let UserContext;
let PlaylistsContext;
let MediaActions;

// The legacy contexts read window.MediaCMS when their module loads.
beforeAll(async () => {
	const { ensureSidebarStoryMediaCMS } = await import('../../../layout/Sidebar/storybook/sidebarStoryHelpers.jsx');
	ensureSidebarStoryMediaCMS('light');
	UserContext = (await import('../../../../static/js/contexts/UserContext')).default;
	PlaylistsContext = (await import('../../../../static/js/contexts/PlaylistsContext')).default;
	MediaActions = (await import('./MediaActions')).default;
});

function renderActions({ anonymous, reportMedia }) {
	const user = {
		is: { anonymous },
		can: { likeMedia: true, saveMedia: true, shareMedia: true, downloadMedia: true, reportMedia },
	};

	render(
		<UserContext.Provider value={user}>
			<PlaylistsContext.Provider value={{ mediaTypes: [] }}>
				<MediaActions allowDownload={false} displayViews={false} isVideo title="A title" views={0} />
			</PlaylistsContext.Provider>
		</UserContext.Provider>
	);
}

describe('MediaActions report action', () => {
	it('offers Report to a signed-in viewer when reporting is enabled', () => {
		renderActions({ anonymous: false, reportMedia: true });

		expect(screen.getByText('Report action')).toBeInTheDocument();
	});

	it('hides Report from an anonymous visitor, whose report the API rejects', () => {
		renderActions({ anonymous: true, reportMedia: true });

		expect(screen.queryByText('Report action')).not.toBeInTheDocument();
		expect(screen.getByText('Share action')).toBeInTheDocument();
	});

	it('hides Report when the site turns reporting off', () => {
		renderActions({ anonymous: false, reportMedia: false });

		expect(screen.queryByText('Report action')).not.toBeInTheDocument();
	});
});
