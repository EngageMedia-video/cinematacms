import { expect, within } from 'storybook/test';
import { iconNames } from '../Icon';
import { Avatar } from './Avatar';

function createPortraitDataUrl({ background, shirt, skin, hair }) {
	return `data:image/svg+xml;utf8,${encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
			<rect width="64" height="64" fill="${background}" />
			<circle cx="32" cy="24" r="14" fill="${skin}" />
			<path d="M18 52c2-10 10-15 14-15s12 5 14 15H18z" fill="${shirt}" />
			<path d="M18 24c0-9 6-16 14-16 8 0 14 7 14 16-2-3-5-5-8-6-5-2-10-2-20 6z" fill="${hair}" />
			<circle cx="27" cy="24" r="1.5" fill="#1f2937" />
			<circle cx="37" cy="24" r="1.5" fill="#1f2937" />
			<path d="M27 31c2.4 2 7.6 2 10 0" stroke="#8b5e3c" stroke-width="2" stroke-linecap="round" fill="none" />
		</svg>
	`)}`;
}

const sampleAvatars = [
	{
		name: 'Tariq Akbar',
		src: createPortraitDataUrl({
			background: '#d5d9dc',
			shirt: '#6b7280',
			skin: '#d5a17b',
			hair: '#2f2a28',
		}),
	},
	{
		name: 'Layla Hart',
		src: createPortraitDataUrl({
			background: '#d8e3e2',
			shirt: '#5f7c72',
			skin: '#8b5a3c',
			hair: '#1f2937',
		}),
	},
	{
		name: 'Mina Sato',
		src: createPortraitDataUrl({
			background: '#c8d9e8',
			shirt: '#4f5f95',
			skin: '#d6aa8c',
			hair: '#312e81',
		}),
	},
	{
		name: 'Tariq Akbar',
		src: '',
	},
];

const meta = {
	title: 'Components/Display/Avatar',
	component: Avatar,
	tags: ['autodocs'],
	args: {
		name: 'Tariq Akbar',
		size: 'sm',
		src: sampleAvatars[0].src,
		badgeType: '',
		badgeIcon: '',
		label: '',
	},
	argTypes: {
		alt: {
			control: 'text',
			description: 'Accessible image text. Falls back to the person name when omitted.',
		},
		badgeIcon: {
			control: 'select',
			options: ['', ...iconNames],
			description:
				'Optional shared icon name for a custom badge. Use this when you do not want a preset badge type.',
		},
		label: {
			control: 'text',
			description: 'Accessible label announced for the badge.',
		},
		badgeType: {
			control: 'radio',
			options: ['', 'comment', 'added-favorite', 'like'],
			description: 'Preset badge style with built-in background color and shared icon.',
		},
		className: {
			control: 'text',
			description: 'Optional extra classes for the avatar wrapper.',
		},
		name: {
			control: 'text',
			description: 'Person name used for initials fallback and default accessible text.',
		},
		onError: {
			control: false,
			table: {
				disable: true,
			},
		},
		size: {
			control: 'radio',
			options: ['sm', 'lg'],
			description: 'Avatar size. sm is 28px and lg is 32px.',
		},
		src: {
			control: 'text',
			description: 'Profile image URL. When empty, the avatar shows initials from the first and last name.',
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

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const image = canvas.getByRole('img', { name: 'Tariq Akbar' });

		await expect(image).toBeVisible();
		await expect(image).toHaveAttribute('src', sampleAvatars[0].src);
	},
};

export const InitialsFallback = {
	args: {
		name: 'Naufal Fawwaz Andriawan',
		src: '',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const avatar = canvas.getByRole('img', { name: 'Naufal Fawwaz Andriawan' });

		await expect(avatar).toBeVisible();
		await expect(canvas.getByText('NA')).toBeVisible();
	},
};

export const WithBadge = {
	args: {
		name: 'Tariq Akbar',
		size: 'lg',
		src: sampleAvatars[0].src,
		badgeType: 'comment',
		label: 'Has comments',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const avatar = canvas.getByRole('img', { name: 'Tariq Akbar' });
		const badge = canvas.getByRole('img', { name: 'Has comments' });

		await expect(avatar).toBeVisible();
		await expect(badge).toBeVisible();
	},
};

export const CustomBadgeIcon = {
	args: {
		name: 'Layla Hart',
		size: 'lg',
		src: sampleAvatars[1].src,
		badgeIcon: 'addedFavorite',
		badgeType: 'added-favorite',
		label: 'Added favorite',
	},
};

export const BadgeTypes = {
	render: () => (
		<div className="inline-flex gap-12 bg-bg-page p-8">
			<Avatar name="Tariq Akbar" src={sampleAvatars[0].src} size="lg" badgeType="comment" label="Comment" />
			<Avatar
				name="Layla Hart"
				src={sampleAvatars[1].src}
				size="lg"
				badgeType="added-favorite"
				label="Added favorite"
			/>
			<Avatar name="Mina Sato" src={sampleAvatars[2].src} size="lg" badgeType="like" label="Like" />
		</div>
	),
};

export const Gallery = {
	render: () => (
		<div className="inline-grid grid-cols-2 gap-x-12 gap-y-10 bg-bg-page p-8">
			{sampleAvatars.map((avatar) => (
				<div key={avatar.name + avatar.src} className="contents">
					<Avatar name={avatar.name} src={avatar.src} size="sm" />
					<Avatar name={avatar.name} src={avatar.src} size="lg" badgeType="comment" />
				</div>
			))}
		</div>
	),
};
