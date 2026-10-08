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
	article: [
		{
			uid: 'article-1',
			category: 'article',
			title: 'Films that changed the conversation',
			year: 2023,
			event_date: '2026-05-02',
			creator: 'Dewi Lestari',
			publication: 'Jakarta Post',
			url: 'https://example.com/article',
		},
	],
	award: [
		{
			uid: 'award-1',
			category: 'award',
			title: 'Best Documentary',
			year: 2021,
			event_date: '2026-05-03',
			award_result_label: 'Won',
			organiser: 'Jogja-NETPAC Asian Film Festival',
		},
	],
	screening: {
		entries: [
			{
				uid: 'screening-new',
				category: 'screening',
				title: 'Hanoi Doc Week',
				year: 2024,
				event_date: '2026-05-01',
				city: 'Hanoi',
				country_label: 'Viet Nam',
				organiser: 'Youth Media Collective',
				url: 'https://example.com/hanoi',
			},
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
		await expect(canvas.getByText('Hanoi, Viet Nam · Organised by Youth Media Collective')).toBeVisible();
		await expect(canvas.getByText('Written About In')).toBeVisible();
		await expect(canvas.getByText('Awards & Recognition')).toBeVisible();
		await expect(canvas.getByText('Saves & Playlists')).toBeVisible();
		await expect(canvas.queryByText('Curated Into')).toBeNull();

		// The first entry's summary makes it taller than the others; its timeline
		// line must still reach the next entry (needs real layout, so not in jsdom).
		const [firstEntry, secondEntry] = within(canvas.getByLabelText('Screened In')).getAllByRole('listitem');
		const connector = firstEntry.querySelector('[aria-hidden="true"] > .w-px');
		await expect(connector.getBoundingClientRect().bottom).toBeGreaterThanOrEqual(
			secondEntry.getBoundingClientRect().top
		);

		// Each later entry's dot sits at the vertical middle of that entry's text.
		const dot = secondEntry.querySelector('.bg-bg-timeline-dot').getBoundingClientRect();
		const text = within(secondEntry).getByText('Manila Community Film Night').parentElement.getBoundingClientRect();
		await expect(Math.abs(dot.top + dot.height / 2 - (text.top + text.height / 2))).toBeLessThanOrEqual(1);
	},
};

export const Empty = {
	args: {
		entries: {},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Where has this film made an impact?')).toBeVisible();
		await expect(canvas.getAllByRole('button', { name: 'ADD IMPACT' })).toHaveLength(2);
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
