import { expect, within } from 'storybook/test';
import { Card } from './Card';

const meta = {
	title: 'Components/Display/Card',
	component: Card,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Surface container with rounded-xl corners. The default variant uses the `bg/cards` token (`neutral/50` light, `pacific-deep/900` dark). Use `muted` for secondary panels and `outlined` when a border is required.',
			},
		},
	},
	args: {
		children: 'Card content',
		variant: 'default',
	},
	argTypes: {
		variant: {
			control: 'inline-radio',
			options: ['default', 'muted', 'outlined'],
			description: 'Visual surface treatment.',
			table: {
				type: { summary: "'default' | 'muted' | 'outlined'" },
				defaultValue: { summary: "'default'" },
			},
		},
		as: {
			control: 'select',
			options: ['article', 'section', 'div', 'aside'],
			description: 'HTML element to render. Defaults to `article`.',
			table: {
				type: { summary: 'keyof JSX.IntrinsicElements' },
				defaultValue: { summary: "'article'" },
			},
		},
		children: {
			control: 'text',
			description: 'Card content.',
		},
		className: {
			control: 'text',
			description: 'Optional extra classes for padding, sizing, or layout overrides.',
		},
	},
	render: (args) => (
		<div className="w-full max-w-sm bg-bg-page p-6">
			<Card {...args} className="p-6" />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByRole('article');

		await expect(card).toBeVisible();
		await expect(card).toHaveClass('bg-bg-surface');
		await expect(card).not.toHaveClass('border');
	},
};

export const Muted = {
	args: {
		variant: 'muted',
		children: 'A secondary panel, filter area, or sidebar block.',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByRole('article');

		await expect(card).toHaveClass('bg-bg-surface-muted');
	},
};

export const Outlined = {
	args: {
		variant: 'outlined',
		children: 'A card that needs a visible border to separate it from its background.',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByRole('article');

		await expect(card).toHaveClass('border');
		await expect(card).toHaveClass('border-border-default');
		await expect(card).toHaveClass('bg-bg-surface');
	},
};

export const AsSection = {
	name: 'as="section"',
	args: {
		as: 'section',
		children: 'Rendered as a section element with an accessible label.',
	},
	render: (args) => (
		<div className="w-full max-w-sm bg-bg-page p-6">
			<Card {...args} aria-label="Featured details" className="p-6" />
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const card = canvas.getByRole('region', { name: 'Featured details' });

		await expect(card).toBeVisible();
	},
};

export const AllVariants = {
	render: () => (
		<div className="flex max-w-sm flex-col gap-4 bg-bg-page p-6">
			{['default', 'muted', 'outlined'].map((v) => (
				<Card key={v} variant={v} className="p-4">
					<p className="body-body-12-regular m-0 text-text-primary">{v}</p>
				</Card>
			))}
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const cards = canvas.getAllByRole('article');

		await expect(cards).toHaveLength(3);
	},
};
