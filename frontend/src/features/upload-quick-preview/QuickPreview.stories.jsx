import { expect, within } from 'storybook/test';
import { QuickPreview } from './QuickPreview';

function createPosterDataUrl({ background, accent, glow }) {
	return `data:image/svg+xml;utf8,${encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">
			<rect width="160" height="90" rx="6" fill="${background}" />
			<circle cx="124" cy="22" r="18" fill="${glow}" opacity="0.5" />
			<path d="M0 64c23-18 47-26 71-26s54 12 89 36v16H0V64z" fill="${accent}" />
		</svg>
	`)}`;
}

const samplePoster = createPosterDataUrl({
	background: '#102746',
	accent: '#D0735F',
	glow: '#85C4FF',
});

const meta = {
	title: 'Features/Upload/QuickPreview',
	component: QuickPreview,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Live preview panel for the unified upload/edit form. Reuses the shared `VerticalMovieItem` media card so the preview matches exactly how the media will appear in listings, updating in real time as the host form passes new values.',
			},
		},
	},
	args: {
		title: 'Samtang Naghulat Ko Nga',
		thumbnailUrl: samplePoster,
		durationLabel: '23:05',
		category: { title: 'FILM', color: 'coral-reef-700' },
		subtitle: 'CCP Film, Broadcast and New Media',
		country: 'Philippines',
		views: 200,
	},
	render: (args) => (
		<div className="w-full max-w-[389px] bg-bg-page p-6">
			<QuickPreview {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('region', { name: 'Quick preview' })).toBeVisible();
		await expect(canvas.getByRole('heading', { name: 'Quick Preview' })).toBeVisible();
		await expect(canvas.getByText('Samtang Naghulat Ko Nga')).toBeVisible();
		await expect(canvas.getByText('CCP Film, Broadcast and New Media')).toBeVisible();
		await expect(canvas.getByText('FILM')).toBeVisible();
		await expect(canvas.getByText('23:05')).toBeVisible();
		await expect(canvas.getByText('Philippines')).toBeVisible();
		await expect(canvas.getByText('200 views')).toBeVisible();
	},
};

export const EmptyState = {
	name: 'Empty (typing)',
	args: {
		title: '',
		thumbnailUrl: '',
		durationLabel: '',
		category: null,
		subtitle: '',
		country: '',
		views: null,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Untitled media')).toBeVisible();
		await expect(canvas.getByRole('img', { name: 'Thumbnail preview' })).toBeVisible();
	},
};

export const NoCategory = {
	args: {
		category: null,
	},
};

export const LongTitle = {
	args: {
		title: 'Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga',
	},
};
