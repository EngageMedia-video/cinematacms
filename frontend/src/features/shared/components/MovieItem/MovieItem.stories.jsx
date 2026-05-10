import { expect, within } from 'storybook/test';
import { HorizontalMovieItem, MovieItem, VerticalMovieItem } from './MovieItem';

function createPosterDataUrl({ background, accent, glow }) {
	return `data:image/svg+xml;utf8,${encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90">
			<rect width="160" height="90" rx="6" fill="${background}" />
			<circle cx="124" cy="22" r="18" fill="${glow}" opacity="0.5" />
			<path d="M0 64c23-18 47-26 71-26s54 12 89 36v16H0V64z" fill="${accent}" />
			<path d="M18 44l18-18 15 13 29-22 35 28v25H18V44z" fill="#F9FAFB" fill-opacity="0.5" />
		</svg>
	`)}`;
}

const samplePoster = createPosterDataUrl({
	background: '#102746',
	accent: '#D0735F',
	glow: '#85C4FF',
});

const previewPosters = [
	createPosterDataUrl({
		background: '#080808',
		accent: '#5F6B8F',
		glow: '#F9FAFB',
	}),
	createPosterDataUrl({
		background: '#0D0D12',
		accent: '#4F5C83',
		glow: '#E8E8E8',
	}),
	createPosterDataUrl({
		background: '#9B9997',
		accent: '#756460',
		glow: '#EAE7E2',
	}),
	createPosterDataUrl({
		background: '#4E372E',
		accent: '#6E4D3C',
		glow: '#C9B2A2',
	}),
];

const sampleArgs = {
	imageSrc: samplePoster,
	imageAlt: 'Editorial movie poster',
	title: 'The Blue Boat The Blue Boat The Blue Boat The Blue Boat The Blue Boat',
	subtitle: 'Drama',
	metadata: ['2026', 'PG-13', '4K'],
	badge: 'Premiere',
	badgeColor: 'pacific-deep-700',
	duration: '2h 3m',
};

const verticalPreviewItems = [
	{
		...sampleArgs,
		imageSrc: previewPosters[0],
		imageAlt: 'Preview poster 1',
		title: 'Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga',
		subtitle: 'CCP Film, Broadcast and New Media',
		metadata: ['Philippines', '200 views'],
		duration: '1:29',
		iconName: 'eyeSlash',
		iconLabel: 'Hidden',
		badge: '',
	},
	{
		...sampleArgs,
		imageSrc: previewPosters[1],
		imageAlt: 'Preview poster 2',
		title: 'Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga',
		subtitle: 'CCP Film, Broadcast and New Media',
		metadata: ['Philippines', '200 views'],
		duration: '1:29',
		iconName: 'eyeSlash',
		iconLabel: 'Hidden',
		badge: '',
	},
	{
		...sampleArgs,
		imageSrc: previewPosters[2],
		imageAlt: 'Preview poster 3',
		title: 'Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga',
		subtitle: 'CCP Film, Broadcast and New Media',
		metadata: ['Philippines', '200 views'],
		duration: '3:40',
		iconName: 'eyeSlash',
		iconLabel: 'Hidden',
		badge: '',
	},
	{
		...sampleArgs,
		imageSrc: previewPosters[3],
		imageAlt: 'Preview poster 4',
		title: 'Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga Samtang Naghulat Ko Nga',
		subtitle: 'CCP Film, Broadcast and New Media',
		metadata: ['Philippines', '200 views'],
		duration: '14:56',
		iconName: 'eyeSlash',
		iconLabel: 'Hidden',
		badge: '',
	},
];

const meta = {
	title: 'Components/Display/Movie Item',
	component: MovieItem,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Editorial movie-card set with shared poster overlays, 6px rounded 16:9 artwork, `body-body-16-medium` title treatment, warm subtitle, dot-separated metadata, a configurable badge, and horizontal or vertical layouts.',
			},
		},
	},
	args: {
		orientation: 'vertical',
		...sampleArgs,
		iconName: 'eyeSlash',
		iconLabel: 'Hidden',
	},
	argTypes: {
		orientation: {
			control: 'inline-radio',
			options: ['horizontal', 'vertical'],
			description: 'Chooses between the horizontal and vertical shared layout.',
		},
		title: {
			control: 'text',
			description: 'Primary movie title text.',
		},
		subtitle: {
			control: 'text',
			description: 'Secondary descriptor below the title.',
		},
		metadata: {
			control: 'object',
			description: 'Two or three short metadata strings rendered with dot separators.',
		},
		badge: {
			control: 'text',
			description: 'Optional badge label shown at the lower-left corner of the poster.',
		},
		badgeColor: {
			control: 'text',
			description:
				'Background color passed through to the shared badge component. Accepts hex, CSS vars, or token names like `pacific-deep-950`.',
		},
		duration: {
			control: 'text',
			description: 'Optional duration label shown on the lower-right overlay.',
		},
		imageSrc: {
			control: 'text',
			description: 'Poster or thumbnail artwork source.',
		},
		imageAlt: {
			control: 'text',
			description: 'Accessible alt text for the poster image.',
		},
		iconName: {
			control: 'text',
			description: 'Shared icon name for the vertical top-right chip.',
		},
		iconLabel: {
			control: 'text',
			description: 'Accessible label for the vertical icon chip.',
		},
		className: {
			control: 'text',
			description: 'Optional extra classes on the outer movie item wrapper.',
		},
		link: {
			control: 'text',
			description: 'Optional href for making the entire card redirect to the detail page.',
		},
	},
	render: (args) => (
		<div className="w-full max-w-[320px]">
			<MovieItem {...args} />
		</div>
	),
};

export default meta;

export const Vertical = {
	args: {
		orientation: 'vertical',
	},
	render: (args) => (
		<div className="grid w-full min-w-[1200px] grid-cols-4 gap-6">
			{verticalPreviewItems.map((item) => (
				<VerticalMovieItem key={item.imageAlt} {...args} {...item} />
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const titles = canvas.getAllByText(/Samtang Naghulat Ko Nga/);
		const articles = canvas.getAllByRole('article');

		await expect(articles).toHaveLength(4);
		await expect(titles[0]).toBeVisible();
		await expect(canvas.getByText('14:56')).toBeVisible();
	},
};

export const Horizontal = {
	render: (args) => (
		<div className="w-full max-w-[560px]">
			<HorizontalMovieItem {...args} />
		</div>
	),
	args: {
		...sampleArgs,
	},
};

export const VerticalWithIcon = {
	render: (args) => (
		<div className="grid w-full min-w-[1200px] grid-cols-4 gap-6">
			{verticalPreviewItems.map((item) => (
				<VerticalMovieItem key={item.imageAlt} {...args} {...item} />
			))}
		</div>
	),
	args: {
		orientation: 'vertical',
	},
};
