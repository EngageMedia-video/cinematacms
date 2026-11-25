import { expect, fn, userEvent, within } from 'storybook/test';
import { CommunityImpactSection } from './CommunityImpactSection';

const CONTRIBUTOR = 'Member - Impact Contributor';
const OWNER = 'Owner of Video';
const OTHER = 'Another Member';
const NINE_MONTHS_AGO = new Date(Date.now() - 270 * 24 * 60 * 60 * 1000).toISOString();
const MURAL = '“Ang Kalikasan ay Nakikinig” (Nature Is Listening), mural by Kolektibong Pintura';
const MURAL_DETAILS =
	'This 4×12 m public mural in Quezon City draws on the opening forest sequence of On Nature. It was unveiled in June 2024.';

function entry(category, uid, fields, { author = OTHER, status = 'approved' } = {}) {
	return { uid, category, status, author_name: author, ...fields };
}

// Sample content from the Figma "Community Impact Screen" frames.
const IMPACTS = {
	award: [
		entry(
			'award',
			'award-1',
			{ title: 'Best Editing', organiser: 'SEA Independent Film Awards', year: 2026 },
			{ author: CONTRIBUTOR }
		),
		entry(
			'award',
			'award-2',
			{
				title: 'Honorable Mention',
				organiser: 'ABC Independent Film Awards',
				award_result: 'special_mention',
				year: 2026,
			},
			{ author: CONTRIBUTOR, status: 'waiting_approval' }
		),
	],
	screening: [
		entry('screening', 'screening-1', { title: 'Manilla Community Film Night', year: 2021 }, { author: OWNER }),
		entry('screening', 'screening-2', {
			title: 'Kuala Lumpur Community Film Night',
			organiser: 'KL Film Club',
			year: 2021,
		}),
		entry('screening', 'screening-3', {
			title: 'Bali Community Film Night',
			organiser: 'SEA Film Club',
			year: 2021,
		}),
		...Array.from({ length: 11 }, (_, index) =>
			entry('screening', `screening-${index + 4}`, {
				title: `Community Screening ${index + 1}`,
				organiser: 'Youth Media Collective',
				year: 2020,
			})
		),
	],
	referenced: [
		entry(
			'referenced',
			'referenced-1',
			{ title: MURAL, details: 'This 4×12 m public mural in Quezon City', year: 2024 },
			{ author: OWNER }
		),
		entry(
			'referenced',
			'referenced-2',
			{ title: MURAL, details: MURAL_DETAILS, year: 2024 },
			{ author: CONTRIBUTOR, status: 'waiting_approval' }
		),
		...Array.from({ length: 5 }, (_, index) =>
			entry('referenced', `referenced-${index + 3}`, { title: MURAL, details: MURAL_DETAILS, year: 2024 })
		),
	],
	teaching: [
		entry('teaching', 'teaching-1', {
			title: 'MEDIA 214: Climate Stories of Southeast Asia',
			organiser: 'Universitas Nusantara Raya',
			country_label: 'Indonesia',
			year: 2021,
		}),
		entry('teaching', 'teaching-2', { title: 'Used in ABC Course at the University of Indonesia', year: 2021 }),
		entry(
			'teaching',
			'teaching-3',
			{ title: 'Used in ABC Course at the University of Brunei', year: 2021 },
			{ author: CONTRIBUTOR }
		),
		...Array.from({ length: 4 }, (_, index) =>
			entry('teaching', `teaching-${index + 4}`, { title: `Workshop ${index + 1}`, year: 2020 })
		),
	],
	article: [
		entry(
			'article',
			'article-1',
			{
				title: 'A Quiet Film That Asks Us to Listen',
				creator: 'Andrea Cruz',
				publication: 'Singapore Daily',
				year: 2024,
			},
			{ author: CONTRIBUTOR }
		),
	],
};

const PLAYLISTS = [
	'Manila Community Film Night',
	'FISHERFOLK & FRONTLINES: Labor and Livelihood at Risk',
	...Array.from({ length: 9 }, () => 'Manila Community Film Night'),
].map((title, index) => ({
	friendly_token: `playlist-${index}`,
	title,
	url: `/playlists/playlist-${index}`,
	add_date: NINE_MONTHS_AGO,
	curator_name: 'Curator',
}));

// What each kind of viewer is sent, following the server's visibility and permission rules.
const VIEWER_RULES = {
	public: () => null,
	contributor: (item) =>
		item.author_name === CONTRIBUTOR
			? { sees: true, edit: item.status === 'waiting_approval', remove: true, review: false }
			: null,
	admin: (item) => ({
		sees: true,
		edit: item.status === 'approved',
		remove: true,
		review: item.status === 'waiting_approval',
	}),
	owner: () => ({ sees: true, edit: true, remove: true, review: false }),
};

function impactsFor(viewer) {
	const rule = VIEWER_RULES[viewer];
	const impacts = {};

	for (const [category, items] of Object.entries(IMPACTS)) {
		impacts[category] = items
			.map((item) => ({ item, access: rule(item) }))
			.filter(({ item, access }) => item.status === 'approved' || access)
			.map(({ item, access }) => ({
				...item,
				viewer_sees_status: Boolean(access?.sees),
				viewer_can_edit: Boolean(access?.edit),
				viewer_can_delete: Boolean(access?.remove),
				viewer_review_url: access?.review ? `/manage/film-impact/${item.uid}/review` : '',
			}));
	}

	impacts.saves = {
		entries: [],
		lastEventAt: NINE_MONTHS_AGO,
		totalCount: { saves: 9, playlists: PLAYLISTS.length },
		playlists: PLAYLISTS,
	};
	return impacts;
}

const meta = {
	title: 'Features/Video Viewer/Community Impact/CommunityImpactSection',
	component: CommunityImpactSection,
	tags: ['autodocs'],
	// The section sizes itself to its container, so the story needs the full canvas width.
	parameters: { layout: 'fullscreen' },
	args: {
		canAdd: true,
		entries: impactsFor('public'),
		onAddImpact: fn(),
		onDeleteImpact: fn(),
		onEditImpact: fn(),
	},
	render: (args) => (
		<div className="bg-bg-page p-space-lg">
			<div className="rounded-b-ds-8 bg-bg-surface p-4">
				<CommunityImpactSection {...args} />
			</div>
		</div>
	),
};

export default meta;

export const PublicViewer = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('heading', { name: "Film's Impact" })).toBeInTheDocument();
		await expect(canvas.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
			'Recognition',
			'Screened at',
			'Referenced in the following works',
			'Used in a course / class',
			'Reviewed or featured in',
			'Playlists',
		]);
		await expect(canvas.queryByText('APPROVED')).not.toBeInTheDocument();
		await expect(canvas.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument();
	},
};

export const ContributorViewer = {
	args: { entries: impactsFor('contributor') },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('button', { name: 'Edit Honorable Mention' })).toBeVisible();
		await expect(canvas.queryByRole('button', { name: 'Edit Best Editing' })).not.toBeInTheDocument();
		await expect(canvas.getByRole('button', { name: 'Delete Best Editing' })).toBeVisible();
	},
};

export const AdminViewer = {
	args: { entries: impactsFor('admin') },
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('link', { name: 'Review Honorable Mention' })).toBeVisible();
		await expect(canvas.getByRole('button', { name: 'Edit Best Editing' })).toBeVisible();
	},
};

export const OwnerViewer = {
	args: { entries: impactsFor('owner') },
};

export const ViewAll = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const screenings = canvas.getByRole('region', { name: 'Screened at' });

		await userEvent.click(within(screenings).getByRole('button', { name: 'VIEW ALL' }));
		await expect(within(screenings).getAllByRole('article')).toHaveLength(14);
	},
};

export const Empty = {
	args: {
		entries: {},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Where has this film made an impact?')).toBeVisible();
		await expect(canvas.getAllByRole('button', { name: 'ADD IMPACT' })).toHaveLength(1);
	},
};

export const OpensDialog = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('button', { name: 'ADD IMPACT' }));
		await expect(await within(document.body).findByRole('dialog', { name: 'Add community impact' })).toBeVisible();
	},
};

export const MobileOwnerViewer = {
	args: { entries: impactsFor('owner') },
	parameters: {
		viewport: {
			defaultViewport: 'mobile1',
		},
	},
};
