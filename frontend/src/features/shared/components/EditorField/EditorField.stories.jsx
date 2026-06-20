import { expect, userEvent, within } from 'storybook/test';
import { EditorField } from './EditorField';

const meta = {
	title: 'Components/Inputs/Editor Field',
	component: EditorField,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Atomic multiline text field matching `TextField` styling and states, but rendered as a textarea with a minimum of five rows.',
			},
		},
	},
	args: {
		label: 'Synopsis',
		placeholder: 'Write the story summary here',
		helperText: '',
		invalid: false,
		disabled: false,
		enableCounter: false,
		maxWordsLength: null,
		rows: 5,
	},
	argTypes: {
		label: {
			control: 'text',
			description: 'Title text shown above textarea.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		placeholder: {
			control: 'text',
			description: 'Hint text shown when textarea value is empty.',
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
			description: 'Turns field into error variant and marks textarea with `aria-invalid`.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		disabled: {
			control: 'boolean',
			description: 'Disables textarea and applies disabled token colors.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		enableCounter: {
			control: 'boolean',
			description: 'Shows a muted word counter on the helper text row.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		maxWordsLength: {
			control: 'number',
			description: 'Optional maximum word count. Pasted or typed text is limited when set.',
			table: {
				type: { summary: 'number | null' },
				defaultValue: { summary: 'null' },
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
		id: {
			control: 'text',
			description: 'Optional textarea id. Generated automatically when omitted.',
			table: {
				type: { summary: 'string' },
			},
		},
		rows: {
			control: 'number',
			description: 'Requested textarea row count. Values below 5 are clamped to 5.',
			table: {
				type: { summary: 'number' },
				defaultValue: { summary: '5' },
			},
		},
		defaultValue: {
			control: 'text',
			description: 'Initial uncontrolled textarea value.',
			table: {
				type: { summary: 'string' },
			},
		},
		value: {
			control: 'text',
			description: 'Controlled textarea value.',
			table: {
				type: { summary: 'string' },
			},
		},
		onChange: {
			action: 'changed',
			description: 'Native textarea change handler.',
			table: {
				type: { summary: '(event: ChangeEvent<HTMLTextAreaElement>) => void' },
			},
		},
		'aria-describedby': {
			control: 'text',
			description: 'Extra description id merged with helper text id when helper exists.',
			table: {
				type: { summary: 'string' },
			},
		},
		'aria-invalid': {
			control: 'boolean',
			description: 'Optional explicit override for native `aria-invalid`.',
			table: {
				type: { summary: 'boolean' },
			},
		},
	},
};

export default meta;

export const Default = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const textarea = canvas.getByLabelText('Synopsis');

		await expect(textarea).toBeVisible();
		await expect(textarea).toHaveAttribute('placeholder', 'Write the story summary here');
		await expect(textarea).toHaveAttribute('rows', '5');
	},
};

export const WithHelperText = {
	args: {
		helperText: 'This appears on detail pages and search previews.',
	},
};

export const WithCounter = {
	args: {
		helperText: 'Maximum 80 words',
		defaultValue: 'A washed-up captain returns for one last impossible voyage.',
		enableCounter: true,
		maxWordsLength: 80,
	},
};

export const Focused = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const textarea = canvas.getByLabelText('Synopsis');

		await userEvent.click(textarea);
		await expect(textarea).toHaveFocus();
	},
};

export const Error = {
	args: {
		invalid: true,
		helperText: 'Synopsis is required.',
	},
};

export const Disabled = {
	args: {
		disabled: true,
		defaultValue: 'A washed-up captain returns for one last impossible voyage.',
		helperText: 'Editing unavailable right now.',
	},
};

export const WithHorizontalPadding = {
	args: {
		className: 'px-4',
		helperText: 'Horizontal padding comes from className overrides.',
	},
};
