import { expect, within } from 'storybook/test';
import { Badge } from './Badge';

const meta = {
	title: 'Components/Display/Badge',
	component: Badge,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Compact display badge with `caption-caption-10-regular` typography, neutral/50 text, 4px padding, 2px radius, and a configurable background color.',
			},
		},
	},
	args: {
		children: 'Premiere',
		color: '#026690',
	},
	argTypes: {
		children: {
			control: 'text',
			description: 'Badge label content.',
		},
		color: {
			control: 'color',
			description: 'Background color applied inline so the badge can follow design-token or hex inputs.',
		},
		className: {
			control: 'text',
			description: 'Optional extra classes applied to the badge.',
		},
		style: {
			control: false,
			table: {
				disable: true,
			},
		},
	},
	render: (args) => (
		<div className="inline-flex bg-cinemata-neutral-100 p-6 dark:bg-cinemata-pacific-deep-950">
			<Badge {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const badge = canvas.getByText('Premiere');

		await expect(badge).toBeVisible();
	},
};

export const CoralReef = {
	args: {
		children: 'Festival Pick',
		color: '#D0735F',
	},
};
