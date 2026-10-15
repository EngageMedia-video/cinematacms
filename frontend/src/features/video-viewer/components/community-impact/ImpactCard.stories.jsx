import { expect, userEvent, within } from 'storybook/test';
import { ImpactCard } from './ImpactCard';

const screeningEntries = [
	{ uid: 'hanoi', title: 'Hanoi Doc Week', year: 2024, url: 'https://example.com/hanoi' },
	{ uid: 'manila', title: 'Manila Community Film Night', date: '2025-02-01', url: 'https://example.com/manila' },
	{ uid: 'dakar', title: '2026 Film Festival, Dakar', date: '2025-02-15', url: 'https://example.com/dakar' },
	{ uid: 'jakarta', title: 'Jakarta Mutual Aid Screening', date: '2025-03-08' },
];

const meta = {
	title: 'Features/Video Viewer/Community Impact/ImpactCard',
	component: ImpactCard,
	tags: ['autodocs'],
	args: {
		entries: screeningEntries,
		iconName: 'impactFilmReel',
		iconShellClassName: 'bg-bg-emblem-blue-deep text-text-on-emblem-blue-deep',
		label: 'Screenings',
		layout: 'list',
		subtitle: 'This film has been screened 4x',
		variant: 'screening',
	},
	render: (args) => (
		<div className="grid max-w-sm bg-bg-page p-space-lg">
			<ImpactCard {...args} />
		</div>
	),
};

export default meta;

export const List = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Hanoi Doc Week')).toBeVisible();
		await expect(canvas.getByText('February 2025')).toBeVisible();
		await expect(canvas.queryByText('2026 Film Festival, Dakar')).toBeNull();
	},
};

export const OpensDetails = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('button', { name: 'Open Screenings details' }));
		const dialog = await within(document.body).findByRole('dialog', { name: 'Screenings' });
		await expect(within(dialog).getByText('Jakarta Mutual Aid Screening')).toBeVisible();
	},
};

export const ReviewsAndFeatures = {
	args: {
		entries: [
			{ uid: 'a1', title: 'Films that changed the conversation', year: 2023, url: 'https://example.com/article' },
			{ uid: 'f1', title: 'Regional documentary roundup', date: '2025-04-20' },
		],
		iconName: 'impactNewspaper',
		iconShellClassName: 'bg-bg-emblem-strait text-text-on-emblem-strait',
		label: 'Reviews and Features',
		subtitle: 'Written about or featured 2x',
		variant: 'article',
	},
};

export const ReferencedInWorks = {
	args: {
		entries: [{ uid: 'r1', title: 'Tide Lines', year: 2022 }],
		iconName: 'impactBookBookmark',
		iconShellClassName: 'bg-bg-emblem-strait-light text-text-on-emblem-strait',
		label: 'Referenced in Works',
		subtitle: 'Referenced in 1 work',
		variant: 'referenced',
	},
};

export const Awards = {
	args: {
		entries: [
			{ uid: 'w1', title: 'Best Documentary', year: 2021 },
			{ uid: 'w2', title: 'Audience Choice', year: 2020 },
		],
		iconName: 'impactTrophy',
		iconShellClassName: 'bg-bg-emblem-amber text-text-on-emblem-amber',
		label: 'Awards',
		layout: 'summary',
		subtitle: '2 recognitions',
		value: '2 recognitions',
		variant: 'award',
	},
};

export const AcademicUsage = {
	args: {
		entries: [{ uid: 't1', title: 'Media and Climate Justice', year: 2025 }],
		iconName: 'impactBookOpen',
		iconShellClassName: 'bg-bg-emblem-orange text-text-accent',
		label: 'Academic Usage',
		layout: 'summary',
		subtitle: 'Used in 14 classes',
		value: 'Used in 14 classes',
		variant: 'academic',
	},
};

export const UserPlaylists = {
	args: {
		entries: [{ title: '181 saves in 2 playlists', date: '2026-05-28T08:00:00Z', dateLabel: 'Last Saved' }],
		iconName: 'bookmarkFilled',
		iconShellClassName: 'bg-bg-emblem-strait-deep text-text-on-emblem-strait-deep',
		label: 'User Playlists',
		layout: 'summary',
		subtitle: 'In 2 playlists',
		value: 'In 2 playlists',
		variant: 'saves',
	},
};
