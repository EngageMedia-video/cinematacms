import { useState } from 'react';
import { expect, within, userEvent } from 'storybook/test';
import { Switch } from './Switch';

const meta = {
	title: 'Components/Inputs/Switch',
	component: Switch,
	tags: ['autodocs'],
	args: {
		children: 'AUTOPLAY',
		defaultChecked: true,
	},
	argTypes: {
		checked: {
			control: 'boolean',
			description: 'Controlled checked state. Use with `onChange` or `readOnly`.',
		},
		defaultChecked: {
			control: 'boolean',
			description: 'Initial uncontrolled checked state.',
		},
		disabled: {
			control: 'boolean',
			description: 'Whether switch is disabled.',
		},
		children: {
			control: 'text',
			description: 'Label text shown on left side of switch.',
		},
		className: {
			control: 'text',
			description:
				'Optional extra classes for the switch wrapper. Use CSS variables here to customize sizing, for example `[--switch-width:52px] [--switch-thumb-size:18px] [--switch-padding:4px]`.',
		},
		name: {
			control: 'text',
			description: 'Name attribute for underlying checkbox input.',
		},
		readOnly: {
			control: 'boolean',
			description: 'Keeps a controlled switch read-only without requiring an `onChange` handler.',
		},
		value: {
			control: 'text',
			description: 'Value attribute for underlying checkbox input.',
		},
	},
	parameters: {
		docs: {
			description: {
				component:
					'A right-aligned switch control with grey/99 thumb and cyan/80 active track, based on the provided autoplay reference. Supports uncontrolled usage through `defaultChecked`, or controlled usage through `checked` and `onChange`. Size customization happens through CSS variables on `className`, not dedicated width or thumb-size props.',
			},
		},
	},
	decorators: [
		(Story) => (
			<div className="inline-flex bg-cinemata-neutral-100 p-8 dark:bg-[#1F1F1F]">
				<Story />
			</div>
		),
	],
};

export default meta;

export const On = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('checkbox', { name: 'AUTOPLAY' });

		await expect(input).toBeChecked();
	},
};

export const Off = {
	args: {
		defaultChecked: false,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('checkbox', { name: 'AUTOPLAY' });

		await expect(input).not.toBeChecked();
	},
};

export const Disabled = {
	args: {
		disabled: true,
	},
};

export const Interactive = {
	render: function InteractiveSwitch(args) {
		const [checked, setChecked] = useState(args.checked ?? args.defaultChecked ?? false);

		return <Switch {...args} checked={checked} onChange={(event) => setChecked(event.target.checked)} />;
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('checkbox', { name: 'AUTOPLAY' });

		await expect(input).toBeChecked();
		await userEvent.click(input);
		await expect(input).not.toBeChecked();
		await userEvent.click(input);
		await expect(input).toBeChecked();
	},
};

export const Wider = {
	args: {
		className: '[--switch-width:52px]',
	},
};

export const CustomSizing = {
	args: {
		className: '[--switch-width:56px] [--switch-thumb-size:18px] [--switch-padding:4px]',
	},
};
