import { expect, userEvent, within } from 'storybook/test';
import { Dropdown } from './Dropdown';

const SAMPLE_OPTIONS = [
	{ label: 'Feature film', value: 'feature-film' },
	{ label: 'Documentary', value: 'documentary' },
	{ label: 'Short form', value: 'short-form' },
];

const meta = {
	title: 'Components/Inputs/Dropdown',
	component: Dropdown,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Atomic text-only dropdown matching the TextField visual system. Uses Tailwind `dark:` overrides and opens a text-only menu with a shared `chevronDown` icon.',
			},
		},
	},
	args: {
		label: 'Category',
		placeholder: 'Choose category',
		helperText: '',
		invalid: false,
		disabled: false,
		options: SAMPLE_OPTIONS,
	},
	argTypes: {
		label: {
			control: 'text',
			description: 'Title text shown above dropdown trigger.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		placeholder: {
			control: 'text',
			description: 'Fallback text shown when no option is selected.',
			table: {
				type: { summary: 'string' },
			},
		},
		helperText: {
			control: 'text',
			description: 'Optional supporting text shown below field.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		invalid: {
			control: 'boolean',
			description: 'Turns field into error variant and marks trigger with `aria-invalid`.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		disabled: {
			control: 'boolean',
			description: 'Disables trigger and prevents menu opening.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		options: {
			control: 'object',
			description: 'Dropdown options as strings or `{ label, value }` objects.',
			table: {
				type: { summary: 'Array<string | { label: string; value: string }>' },
			},
		},
		value: {
			control: 'text',
			description: 'Controlled selected option value.',
			table: {
				type: { summary: 'string' },
			},
		},
		defaultValue: {
			control: 'text',
			description: 'Initial uncontrolled selected option value.',
			table: {
				type: { summary: 'string' },
			},
		},
		className: {
			control: 'text',
			description: 'Optional class for outer container only.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		onChange: {
			action: 'changed',
			description: 'Called with `(value, option)` when user selects an option.',
			table: {
				type: { summary: '(value: string, option: { label: string; value: string }) => void' },
			},
		},
	},
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Choose category' });

		await expect(trigger).toBeVisible();
		await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
	},
};

export const Open = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Choose category' });

		await userEvent.click(trigger);
		await expect(canvas.getByRole('menu')).toBeVisible();
		await expect(canvas.getByRole('menuitemradio', { name: 'Documentary' })).toBeVisible();
	},
};

export const WithSelection = {
	args: {
		defaultValue: 'documentary',
	},
};

export const Error = {
	args: {
		invalid: true,
		helperText: 'Category is required.',
	},
};

export const Disabled = {
	args: {
		disabled: true,
		defaultValue: 'feature-film',
		helperText: 'Editing unavailable right now.',
	},
};

export const Compact = {
	args: {
		appearance: 'compact',
		icon: 'sortArrows',
		label: 'Sort by',
		defaultValue: 'relevance',
		options: [
			{ label: 'Relevance', value: 'relevance' },
			{ label: 'Name A–Z', value: 'asc' },
			{ label: 'Name Z–A', value: 'desc' },
		],
	},
	parameters: {
		docs: {
			description: {
				story: 'Toolbar-sized trigger for controls such as a results sort. The label is not shown; it prefixes the accessible name instead ("Sort by: Relevance").',
			},
		},
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Sort by: Relevance' });

		await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
		await userEvent.click(trigger);
		await expect(canvas.getByRole('menuitemradio', { name: 'Name A–Z' })).toBeVisible();
	},
};

export const WithHorizontalPadding = {
	args: {
		className: 'px-4',
		helperText: 'Horizontal padding comes from className overrides.',
	},
};
