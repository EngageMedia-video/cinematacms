import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { SearchBar } from './SearchBar';

const meta = {
	title: 'Components/Inputs/Search Bar',
	component: SearchBar,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Atomic search input with a `pacific-deep/800` surface, `body-body-14-regular` typography, `strait-blue/50` text, `pacific-deep/300` hint text, a trailing `magnifying-glass` icon, and a `sunset-horizon/400p` active border.',
			},
		},
	},
	args: {
		placeholder: 'Search movie title',
		'aria-label': 'Search movie title',
	},
	argTypes: {
		placeholder: {
			control: 'text',
			description: 'Hint text shown when the search input is empty.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Search'" },
			},
		},
		disabled: {
			control: 'boolean',
			description: 'Disables the input and applies disabled visual treatment.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		'aria-label': {
			control: 'text',
			description: 'Accessible name announced for the search input.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Search'" },
			},
		},
		iconName: {
			control: false,
			description: 'Shared icon name rendered on the right side of the field.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'magnifyingGlass'" },
			},
		},
		className: {
			control: 'text',
			description: 'Optional class applied to the outer full-width container.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		defaultValue: {
			control: 'text',
			description: 'Initial uncontrolled input value.',
			table: {
				type: { summary: 'string' },
			},
		},
		value: {
			control: 'text',
			description: 'Controlled input value.',
			table: {
				type: { summary: 'string' },
			},
		},
		onChange: {
			action: 'changed',
			description: 'Native input change handler.',
			table: {
				type: { summary: '(event: ChangeEvent<HTMLInputElement>) => void' },
			},
		},
	},
	render: (args) => (
		<div className="w-full max-w-[420px]">
			<SearchBar {...args} />
		</div>
	),
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('searchbox', { name: 'Search movie title' });

		await expect(input).toBeVisible();
		await expect(input).toHaveAttribute('placeholder', 'Search movie title');
		await expect(input.parentElement?.querySelector('svg[data-icon="magnifyingGlass"]')).not.toBeNull();
	},
};

export const WithValue = {
	args: {
		defaultValue: 'The Blue Boat',
	},
};

export const Controlled = {
	args: {
		value: 'The Blue Boat',
	},
	render: function ControlledStory(args) {
		const [value, setValue] = useState(args.value ?? '');

		return (
			<div className="w-full max-w-[420px]">
				<SearchBar
					{...args}
					value={value}
					onChange={(event) => {
						setValue(event.target.value);
						args.onChange?.(event);
					}}
				/>
			</div>
		);
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const input = canvas.getByRole('searchbox', { name: 'Search movie title' });

		await userEvent.clear(input);
		await userEvent.type(input, 'Arrival');
		await expect(input).toHaveValue('Arrival');
	},
};

export const Disabled = {
	args: {
		disabled: true,
		placeholder: 'Search unavailable',
		'aria-label': 'Search unavailable',
	},
};
