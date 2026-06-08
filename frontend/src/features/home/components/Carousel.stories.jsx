import { expect, within } from 'storybook/test';

import { Carousel } from './Carousel';

function createPosterDataUrl(index) {
	const hue = (index * 37) % 360;
	return `data:image/svg+xml;utf8,${encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">
			<rect width="320" height="180" fill="hsl(${hue} 38% 22%)" />
			<rect x="0" y="120" width="320" height="60" fill="hsl(${hue} 42% 16%)" />
			<text x="16" y="40" fill="#F9FAFB" font-family="Inter, sans-serif" font-size="20">Clip ${index + 1}</text>
		</svg>
	`)}`;
}

function makeItems(count) {
	return Array.from({ length: count }, (_, index) => ({
		friendly_token: `token-${index}`,
		title: `Hilakbot ng Lente (Horrors Through the Lens) ${index + 1}`,
		thumbnail_url: createPosterDataUrl(index),
		url: `/media/item-${index}/`,
		duration_in_seconds: 1120 + index * 7,
		author_name: 'TAM DokyuFest',
		media_country: 'Philippines',
		views: 161 + index * 11,
		categories_info: [{ title: 'Documentary', color: 'bg/primary' }],
	}));
}

const meta = {
	title: 'Features/Home/Carousel',
	component: Carousel,
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Home page media carousel. Uses native horizontal scroll-snap with overlay arrows on wider viewports and pagination dots below. The number of visible items per page is responsive, defaulting to one item per page on phone widths. Pagination dots are capped at seven with a sliding window centered on the active page so a long playlist cannot overflow a narrow viewport.',
			},
		},
	},
};

export default meta;

// Wide viewport: several items per page, a small number of pages, every dot shown.
export const Default = {
	render: () => (
		<div className="mx-auto w-full max-w-[1100px] px-6 py-8">
			<Carousel items={makeItems(12)} visibleCount={4} />
		</div>
	),
};

// Phone width: one item per page across 20 pages. Demonstrates the windowed
// pagination dots staying inside the viewport instead of overflowing.
export const MobileManyPages = {
	render: () => (
		<div className="mx-auto w-[360px] px-3 py-6">
			<Carousel items={makeItems(20)} visibleCount={1} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const dots = canvas.getAllByRole('button', { name: /^Go to page \d+$/ });
		await expect(dots).toHaveLength(7);
		await expect(canvas.getByRole('button', { name: 'Go to page 1' })).toBeInTheDocument();
		await expect(canvas.queryByRole('button', { name: 'Go to page 8' })).toBeNull();
	},
};

// Phone width with few pages: no window needed, all dots render.
export const MobileFewPages = {
	render: () => (
		<div className="mx-auto w-[360px] px-3 py-6">
			<Carousel items={makeItems(4)} visibleCount={1} />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const dots = canvas.getAllByRole('button', { name: /^Go to page \d+$/ });
		await expect(dots).toHaveLength(4);
	},
};
