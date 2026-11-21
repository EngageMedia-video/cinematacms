import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const encoded = (title) => ({ title, status: 'success', progress: 100, size: '10MB', url: `/media/encoded/${title}` });

vi.mock('../../../../static/js/pages/MediaPage/store.js', () => ({
	default: {
		get: vi.fn(() => ({
			title: 'Rivers of Java',
			size: '1GB',
			original_media_url: '/media/original/user/maker/Rivers_of_Java.mov',
			encodings_info: {
				1080: { vp9: encoded('1080 vp9') },
				720: { h264: encoded('720 h264'), h265: { ...encoded('720 h265'), status: 'pending', progress: 40 } },
				480: {},
			},
		})),
	},
}));

let VideoMediaDownloadLink;
let OtherMediaDownloadLink;

// SiteContext reads window.MediaCMS when its module loads.
beforeAll(async () => {
	const { ensureSidebarStoryMediaCMS } = await import('../../../layout/Sidebar/storybook/sidebarStoryHelpers.jsx');
	ensureSidebarStoryMediaCMS('light');
	({ VideoMediaDownloadLink } = await import('./VideoMediaDownloadLink'));
	({ OtherMediaDownloadLink } = await import('./OtherMediaDownloadLink'));
});

describe('download links name their file version for analytics', () => {
	it('labels each finished encoding by resolution and codec, and the original file', () => {
		render(<VideoMediaDownloadLink />);
		fireEvent.click(screen.getAllByRole('button', { name: 'Download' })[0]);

		expect(screen.getAllByRole('menuitem').map((link) => [link.textContent, link.dataset.analyticsFile])).toEqual([
			['720 - H264 (10MB)', '720-h264'],
			['1080 - VP9 (10MB)', '1080-vp9'],
			['Original file (1GB)', 'original'],
		]);
	});

	it('labels the download of a non-video file as the original', () => {
		render(<OtherMediaDownloadLink link="/media/original/user/maker/report.pdf" title="Report" />);

		expect(screen.getByTitle('Download').dataset.analyticsFile).toBe('original');
	});
});
