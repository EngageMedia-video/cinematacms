import { expect, fn, userEvent, within } from 'storybook/test';
import { CommunityImpactSection } from './CommunityImpactSection';

const communityImpactEntries = {
	academic: {
		label: 'University Courses',
		lastReportedAt: '2026-02-14',
		totalCount: 14,
	},
	featured: {
		entries: [
			{ title: 'RightsCon community media spotlight', date: '2025-03-12', url: 'https://example.com/rightscon' },
			{ title: 'Regional documentary roundup', date: '2025-04-20', url: 'https://example.com/roundup' },
		],
		totalCount: 2,
	},
	curated: [
		{
			title: 'Climate Justice Watchlist',
			event_date: '2025-06-10',
			url: 'https://example.com/watchlist',
		},
	],
	saves: {
		lastEventAt: '2026-05-28T08:00:00Z',
		totalCount: { saves: 181, playlists: 90 },
	},
	screening: {
		entries: [
			{ title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' },
			{ title: '2026 Film Festival, Dakar', date: '2025-02-15', url: 'https://example.com/dakar' },
			{ title: 'Jakarta Mutual Aid Screening', date: '2025-03-08', url: 'https://example.com/jakarta' },
		],
		totalCount: 8,
	},
};

const meta = {
	title: 'Features/Video Viewer/Community Impact/CommunityImpactSection',
	component: CommunityImpactSection,
	tags: ['autodocs'],
	args: {
		canAdd: true,
		entries: communityImpactEntries,
		onAddImpact: fn(),
	},
	render: (args) => (
		<div className="bg-bg-page p-space-lg">
			<CommunityImpactSection {...args} />
		</div>
	),
};

export default meta;

export const Populated = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('heading', { name: "Film's Impact" })).toBeVisible();
		await expect(canvas.getByText('Screened In')).toBeVisible();
		await expect(canvas.getByText('Saves & Playlists')).toBeVisible();
	},
};

export const Empty = {
	args: {
		entries: {},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Where this film has made an impact?')).toBeVisible();
	},
};

export const OpensDialog = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('button', { name: 'ADD IMPACT' }));
		await expect(await within(document.body).findByRole('dialog', { name: 'Add community impact' })).toBeVisible();
	},
};

export const MobilePopulated = {
	parameters: {
		viewport: {
			defaultViewport: 'mobile1',
		},
	},
};
