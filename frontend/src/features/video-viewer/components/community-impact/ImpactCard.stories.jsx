import { expect, userEvent, within } from 'storybook/test';
import { ImpactCard } from './ImpactCard';

const screeningEntries = [
	{ title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' },
	{ title: '2026 Film Festival, Dakar', date: '2025-02-15', url: 'https://example.com/dakar' },
	{ title: 'Jakarta Mutual Aid Screening', date: '2025-03-08', url: 'https://example.com/jakarta' },
	{ title: 'Quezon City Youth Workshop', date: '2025-04-12', url: 'https://example.com/quezon' },
	{ title: 'Dili Community Media Forum', date: '2025-05-02', url: 'https://example.com/dili' },
	{ title: 'Chiang Mai Documentary Circle', date: '2025-05-19', url: 'https://example.com/chiang-mai' },
];

const meta = {
	title: 'Features/Video Viewer/Community Impact/ImpactCard',
	component: ImpactCard,
	tags: ['autodocs'],
	args: {
		entries: screeningEntries,
		subtitle: 'This film has been screened 8x',
		title: 'Screened In',
		totalCount: 8,
		variant: 'screening',
	},
	render: (args) => (
		<div className="grid max-w-xl bg-bg-page p-space-lg">
			<ImpactCard {...args} />
		</div>
	),
};

export default meta;

export const Collapsed = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Manila Community Film Night')).toBeVisible();
		await expect(canvas.queryByText('Jakarta Mutual Aid Screening')).toBeNull();
		await expect(canvas.getByRole('button', { name: 'Show all Screened In entries' })).toHaveAttribute(
			'aria-expanded',
			'false'
		);
	},
};

export const Expanded = {
	args: {
		defaultExpanded: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Jakarta Mutual Aid Screening')).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Show fewer Screened In entries' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
	},
};

export const ExpandInteraction = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const toggle = canvas.getByRole('button', { name: 'Show all Screened In entries' });

		await userEvent.click(toggle);
		await expect(canvas.getByText('Jakarta Mutual Aid Screening')).toBeVisible();
	},
};

export const Summary = {
	args: {
		entries: [],
		lastEventAt: '2026-05-28T08:00:00Z',
		subtitle: '181 saves and 90 playlists',
		title: 'Saves & Playlists',
		totalCount: { saves: 181, playlists: 90 },
		variant: 'saves',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('181')).toBeVisible();
		await expect(canvas.getByText('90')).toBeVisible();
	},
};

export const Curated = {
	args: {
		entries: [
			{ title: 'Climate Justice Watchlist', date: '2025-06-10', url: 'https://example.com/watchlist' },
			{ title: 'University Media Library', date: '2025-07-18', url: 'https://example.com/library' },
		],
		subtitle: 'This film has been curated into 2 collections',
		title: 'Curated Into',
		totalCount: 2,
		variant: 'curated',
	},
};

export const MaxBehaviour = {
	args: {
		defaultExpanded: true,
		entries: [
			...screeningEntries,
			...screeningEntries.map((entry) => ({ ...entry, title: `${entry.title} encore` })),
		],
	},
};
