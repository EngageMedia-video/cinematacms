import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { SegmentButton } from './SegmentButton';

const THEME_OPTIONS = [
	{ value: 'dark', label: 'Dark', iconName: 'moon' },
	{ value: 'light', label: 'Light', iconName: 'sun' },
];

const FILTER_OPTIONS = [
	{ value: 'films', label: 'Films', iconName: 'spark' },
	{ value: 'audio', label: 'Audio', iconName: 'notificationBell' },
	{ value: 'images', label: 'Images', iconName: 'eye' },
];

const meta = {
	title: 'Components/Inputs/Segment Button',
	component: SegmentButton,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Selectable segmented button group with icon-and-label options. It supports both single and multi-select modes, uses a rounded outer container, and keeps the inner segments square-edged.',
			},
		},
	},
	args: {
		options: THEME_OPTIONS,
		defaultValue: 'dark',
		multiple: false,
		layout: 'wrap',
		'aria-label': 'Theme mode',
	},
	argTypes: {
		options: {
			control: false,
			description: 'Segment options with `value`, `label`, optional `iconName`, and optional `disabled`.',
			table: {
				type: {
					summary: 'Array<{ value: string; label: string; iconName?: string; disabled?: boolean }>',
				},
			},
		},
		multiple: {
			control: 'boolean',
			description: 'Allows selecting more than one segment at the same time.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		layout: {
			control: 'radio',
			options: ['wrap', 'fill'],
			description:
				'Controls whether segments wrap their content or distribute evenly across the available width.',
			table: {
				type: { summary: "'wrap' | 'fill'" },
				defaultValue: { summary: "'wrap'" },
			},
		},
		value: {
			control: false,
			description: 'Controlled selected value for single mode, or selected values array for multi-select mode.',
			table: {
				type: { summary: 'string | string[]' },
			},
		},
		defaultValue: {
			control: false,
			description: 'Initial uncontrolled selection for single or multi-select mode.',
			table: {
				type: { summary: 'string | string[]' },
			},
		},
		onValueChange: {
			action: 'value-changed',
			description: 'Called with the next selected value or values after interaction.',
			table: {
				type: { summary: '(value: string | string[]) => void' },
			},
		},
		className: {
			control: 'text',
			description: 'Optional extra class applied to the outer segmented container.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		'aria-label': {
			control: 'text',
			description: 'Accessible name announced for the segmented control group.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Segment button'" },
			},
		},
	},
	render: (args) => (
		<div className="bg-cinemata-neutral-100 p-8 dark:bg-cinemata-pacific-deep-950">
			<SegmentButton {...args} />
		</div>
	),
};

export default meta;

export const SingleSelect = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
		await expect(canvas.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'false');
	},
};

export const Controlled = {
	render: (args) => {
		const [value, setValue] = useState('dark');

		return (
			<div className="w-full min-w-[320px] max-w-[820px] bg-cinemata-neutral-100 p-8 dark:bg-cinemata-pacific-deep-950">
				<SegmentButton
					{...args}
					value={value}
					onValueChange={(nextValue) => {
						setValue(nextValue);
						args.onValueChange?.(nextValue);
					}}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await userEvent.click(canvas.getByRole('button', { name: 'Light' }));
		await expect(canvas.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
	},
};

export const MultiSelect = {
	args: {
		options: FILTER_OPTIONS,
		multiple: true,
		defaultValue: ['films', 'images'],
		'aria-label': 'Media filters',
	},
};

export const FillWidth = {
	args: {
		layout: 'fill',
	},
	render: (args) => (
		<div className="w-full max-w-[720px] bg-cinemata-neutral-100 p-8 dark:bg-cinemata-pacific-deep-950">
			<SegmentButton {...args} />
		</div>
	),
};
