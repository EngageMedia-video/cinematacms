import { render, screen } from '@testing-library/react';
import { renderManageItems } from '../ManageItemList/includes/functions';

// The page store reads the full window.MediaCMS config on import; the rows only use its events.
vi.mock('../../../pages/_PageStore.js', () => ({
	default: { on: vi.fn(), removeListener: vi.fn(), get: vi.fn() },
}));

function upload(overrides) {
	return {
		friendly_token: 'abc123',
		title: 'river.mp4',
		url: '/view?m=abc123',
		thumbnail_url: null,
		add_date: '2026-10-24T05:55:54Z',
		media_type: 'video',
		encoding_status: 'pending',
		state: 'private',
		views: 0,
		likes: 0,
		...overrides,
	};
}

function renderUploads(items) {
	return render(<div>{renderManageItems(items, { manageType: 'my-uploads', selectedItems: [] })}</div>);
}

describe('Manage uploads details needed', () => {
	it('links an upload whose details were never saved to its edit page', () => {
		renderUploads([upload({ details_needed: true })]);

		expect(screen.getByRole('link', { name: 'Details needed' })).toHaveAttribute('href', '/edit?m=abc123');
	});

	it('shows no details link for an upload whose details are saved', () => {
		renderUploads([upload({ details_needed: false })]);

		expect(screen.queryByRole('link', { name: 'Details needed' })).not.toBeInTheDocument();
	});
});
