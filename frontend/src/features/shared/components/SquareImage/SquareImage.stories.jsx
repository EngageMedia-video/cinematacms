import sampleStaticImage from '../../../../static/favicons/android-chrome-192x192.png';
import { expect, within } from 'storybook/test';
import { iconNames } from '../Icon';
import { SquareImage } from './SquareImage';

function createPosterDataUrl({ background, accent, glow }) {
	return `data:image/svg+xml;utf8,${encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
			<rect width="60" height="60" rx="8" fill="${background}" />
			<circle cx="42" cy="18" r="14" fill="${glow}" opacity="0.65" />
			<path d="M0 46c11-10 21-15 29-15s18 5 31 16v13H0V46z" fill="${accent}" />
			<path d="M14 27l8-9 7 7 15-17 8 8v28H8V32l6-5z" fill="#F9FAFB" fill-opacity="0.72" />
		</svg>
	`)}`;
}

const sampleUrlImage = createPosterDataUrl({
	background: '#102746',
	accent: '#cc6a52',
	glow: '#85c4ff',
});

const meta = {
	title: 'Components/Display/Square Image',
	component: SquareImage,
	tags: ['autodocs'],
	args: {
		alt: 'Editorial poster',
		src: sampleUrlImage,
		size: 60,
		radius: 8,
		loading: false,
		iconName: '',
	},
	argTypes: {
		alt: {
			control: 'text',
			description: 'Accessible image text used for the underlying `img` or fallback container.',
		},
		className: {
			control: 'text',
			description: 'Optional extra classes for the outer square wrapper.',
		},
		iconName: {
			control: 'select',
			options: ['', ...iconNames],
			description: 'Optional shared icon shown in the center when no image is available.',
		},
		loading: {
			control: 'boolean',
			description: 'Shows the rotating `loading` icon with a dim pacific-deep/800 overlay.',
		},
		onError: {
			control: false,
			table: {
				disable: true,
			},
		},
		radius: {
			control: 'number',
			description: 'Corner radius in pixels. Defaults to 8.',
		},
		size: {
			control: 'number',
			description: 'Square width and height in pixels. Defaults to 60.',
		},
		src: {
			control: 'text',
			description: 'Image URL or imported static asset path for the square preview.',
		},
		style: {
			control: false,
			table: {
				disable: true,
			},
		},
	},
};

export default meta;

export const FromUrl = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const image = canvas.getByRole('img', { name: 'Editorial poster' });

		await expect(image).toBeVisible();
		await expect(image).toHaveAttribute('src', sampleUrlImage);
	},
};

export const FromStaticAsset = {
	args: {
		alt: 'Static asset poster',
		src: sampleStaticImage,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const image = canvas.getByRole('img', { name: 'Static asset poster' });

		await expect(image).toBeVisible();
		await expect(image.getAttribute('src')).toContain('android-chrome-192x192');
	},
};

export const WithCenterIcon = {
	args: {
		alt: 'Placeholder artwork',
		src: '',
		iconName: 'example',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const placeholder = canvas.getByRole('img', { name: 'Placeholder artwork' });
		const centeredIcon = canvasElement.querySelector('svg[data-icon="example"]');

		await expect(placeholder).toBeVisible();
		await expect(centeredIcon).not.toBeNull();
	},
};

export const Loading = {
	args: {
		alt: 'Loading artwork',
		src: sampleUrlImage,
		loading: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const image = canvas.getByRole('img', { name: 'Loading artwork' });
		const loadingIcon = canvasElement.querySelector('svg[data-icon="loading"]');

		await expect(image).toBeVisible();
		await expect(image.parentElement).toHaveAttribute('aria-busy', 'true');
		await expect(loadingIcon).not.toBeNull();
		await expect(loadingIcon.className.baseVal || loadingIcon.className).toContain('animate-spin');
	},
};

export const Gallery = {
	render: () => (
		<div className="inline-flex gap-6 bg-cinemata-neutral-100 p-8 dark:bg-cinemata-pacific-deep-950">
			<SquareImage alt="URL poster" src={sampleUrlImage} />
			<SquareImage alt="Static poster" src={sampleStaticImage} />
			<SquareImage alt="Placeholder artwork" src="" iconName="example" />
			<SquareImage alt="Loading artwork" src={sampleUrlImage} loading />
		</div>
	),
};
