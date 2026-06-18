import { useState } from 'react';
import { expect, within, userEvent } from 'storybook/test';
import { CheckboxGroup } from './CheckboxGroup';

const CATEGORIES = [
	{ value: 'film', label: 'Film' },
	{ value: 'music', label: 'Music' },
	{ value: 'sports', label: 'Sports' },
	{ value: 'news', label: 'News' },
	{ value: 'gaming', label: 'Gaming' },
];

const meta = {
	title: 'Components/Inputs/Checkbox Group',
	component: CheckboxGroup,
	tags: ['autodocs'],
	args: {
		label: 'Categories',
		name: 'category',
		options: CATEGORIES,
		required: false,
	},
	argTypes: {
		label: {
			control: 'text',
			description: 'Group label rendered above the checkboxes',
		},
		required: {
			control: 'boolean',
			description: 'Appends a red asterisk to the label',
		},
		error: {
			control: 'text',
			description: 'Error message rendered below the group',
		},
		name: {
			control: 'text',
			description: 'Name attribute shared by all checkboxes',
		},
		listClassName: {
			control: 'text',
			description: 'Overrides the layout of the checkbox list container',
		},
		options: {
			control: 'object',
			description: 'Array of { label, value } options (strings also accepted)',
		},
	},
	parameters: {
		docs: {
			description: {
				component:
					'A group of CheckboxButton options with a shared label, optional required marker, and error message. Controlled or uncontrolled.',
			},
		},
	},
};

export default meta;

export const Default = {
	args: {
		label: 'Categories',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Categories')).toBeVisible();
		await expect(canvas.getAllByRole('checkbox')).toHaveLength(CATEGORIES.length);
	},
};

export const Required = {
	args: {
		label: 'Categories',
		required: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const label = canvas.getByText('Categories');

		await expect(label).toBeVisible();
		await expect(label.textContent).toContain('*');
	},
};

export const WithError = {
	args: {
		label: 'Categories',
		required: true,
		error: 'Please select at least one category',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		await expect(canvas.getByText('Please select at least one category')).toBeVisible();
	},
};

export const GridLayout = {
	args: {
		label: 'Topics',
		name: 'topics',
		required: true,
		listClassName: 'grid grid-cols-1 md:grid-cols-3',
	},
};

export const Interactive = {
	render: function InteractiveGroup() {
		const [selected, setSelected] = useState(['film']);

		return (
			<div className="flex flex-col gap-4">
				<CheckboxGroup
					label="Categories"
					name="category"
					required
					options={CATEGORIES}
					value={selected}
					onChange={(next) => setSelected(next)}
				/>
				<p className="body-body-12-regular text-text-muted">Selected: {selected.join(', ') || 'none'}</p>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const [film, music] = canvas.getAllByRole('checkbox');

		await expect(film).toBeChecked();

		await userEvent.click(music);
		await expect(music).toBeChecked();

		await userEvent.click(film);
		await expect(film).not.toBeChecked();
	},
};
