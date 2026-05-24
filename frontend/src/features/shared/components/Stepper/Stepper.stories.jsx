import { expect, within } from 'storybook/test';
import { Stepper } from './Stepper';

const SAMPLE_ITEMS = [
	{
		title: 'Labor Rights Collections',
		date: 'February 2025',
		href: 'https://example.com/labor-rights-collections',
	},
	{
		title: 'BlueOceans Film Price 2026 Playlist',
		date: 'February 2025',
		href: 'https://example.com/blueoceans-film-price-2026-playlist',
	},
];

const meta = {
	title: 'Components/Display/Stepper',
	component: Stepper,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Timeline-style stepper with a featured icon header, a vertical rail, and linked content items. It uses `pacific-deep`, `strait-blue`, and `sunset-horizon` tokens to match the modern component system.',
			},
		},
	},
	args: {
		label: 'Featured In...',
		items: SAMPLE_ITEMS,
	},
	argTypes: {
		label: {
			control: 'text',
			description: 'Small heading shown to the right of the top icon.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Featured In...'" },
			},
		},
		items: {
			control: false,
			description: 'Timeline items containing the title, date, and destination link.',
			table: {
				type: {
					summary: 'Array<{ title: string; date?: string; href?: string; linkLabel?: string }>',
				},
			},
		},
		iconName: {
			control: false,
			description: 'Shared icon name displayed in the top-left circle.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'eye'" },
			},
		},
		linkLabel: {
			control: 'text',
			description: 'Fallback link label used when an item does not override it.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'VISIT LINK'" },
			},
		},
		className: {
			control: 'text',
			description: 'Optional extra class applied to the outer stepper wrapper.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
	},
	render: (args) => (
		<div className="w-full min-w-[320px] max-w-[820px] bg-bg-page p-8">
			<Stepper {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Featured In...')).toBeVisible();
		await expect(canvas.getByText('Labor Rights Collections')).toBeVisible();
		await expect(canvas.getAllByRole('link', { name: 'VISIT LINK' })[0]).toBeVisible();
	},
};

export const ThreeItems = {
	args: {
		items: [
			...SAMPLE_ITEMS,
			{
				title: 'Workers Stories Archive',
				date: 'March 2025',
				href: 'https://example.com/workers-stories-archive',
			},
		],
	},
};

export const MobileWidth = {
	render: (args) => (
		<div className="w-full max-w-[360px] bg-bg-page p-5">
			<Stepper {...args} />
		</div>
	),
};
