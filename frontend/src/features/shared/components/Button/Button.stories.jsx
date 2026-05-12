import { expect, within } from 'storybook/test';
import { Icon } from '../Icon';
import { Button } from './Button';

function PauseIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
			<circle cx="10" cy="10" r="10" fill="currentColor" />
			<path d="M7.35 6.2H8.95V13.8H7.35V6.2ZM11.05 6.2H12.65V13.8H11.05V6.2Z" fill="#011C34" />
		</svg>
	);
}

const meta = {
	title: 'Components/Actions/Button',
	component: Button,
	tags: ['autodocs'],
	args: {
		children: 'SAVE AS DRAFT',
		variant: 'primary',
		color: 'strait-blue-600p',
	},
	argTypes: {
		children: {
			control: 'text',
			description: 'Visible button label. Omit this for the icon-only variant.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		color: {
			control: 'radio',
			if: { arg: 'variant', eq: 'text' },
			options: [
				'strait-blue-600p',
				'sunset-horizon-300',
				'sunset-horizon-500',
				'pacific-deep-950',
				'red-500',
				'strait-blue-100',
				'strait-blue-400',
				'neutral-600',
			],
			description: 'Text color token used by the `text` variant.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'strait-blue-600p'" },
			},
		},
		icon: {
			control: false,
			description: 'Optional icon element rendered before the label, or after it for the `special` variant.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		iconPosition: {
			control: 'radio',
			options: ['left', 'right'],
			description: 'Controls whether the icon appears before or after the text label.',
			table: {
				type: { summary: "'left' | 'right'" },
			},
		},
		variant: {
			control: 'radio',
			options: ['primary', 'secondary', 'special', 'primary-outline', 'secondary-outline', 'text', 'icon'],
			description: 'Visual style and layout for the button.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'primary'" },
			},
		},
		className: {
			control: 'text',
			description: 'Optional extra classes applied to the button element.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		disabled: {
			control: 'boolean',
			description: 'Disables the button and applies the built-in disabled treatment.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		type: {
			control: 'text',
			description: 'Native button type attribute.',
			table: {
				type: { summary: 'button | submit | reset' },
				defaultValue: { summary: "'button'" },
			},
		},
		'aria-label': {
			control: 'text',
			description: 'Accessible name used when the button text is absent or needs an explicit override.',
			table: {
				type: { summary: 'string' },
			},
		},
	},
};

export default meta;

export const Primary = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', { name: 'SAVE AS DRAFT' });

		await expect(button).toBeVisible();
		await expect(button).toHaveClass('body-body-14-bold');
	},
};

export const PrimaryWithIcon = {
	args: {
		children: 'SAVE AS DRAFT',
		icon: <Icon name="spark" decorative />,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', { name: 'SAVE AS DRAFT' });

		await expect(button.querySelector('svg')).not.toBeNull();
	},
};

export const Secondary = {
	args: {
		children: 'LEARN MORE',
		variant: 'secondary',
	},
};

export const Special = {
	args: {
		children: 'SEE ALL',
		variant: 'special',
		icon: <Icon name="spark" decorative />,
	},
};

export const PrimaryOutline = {
	args: {
		children: 'SAVE AS DRAFT',
		variant: 'primary-outline',
	},
};

export const SecondaryOutline = {
	args: {
		children: 'LEARN MORE',
		variant: 'secondary-outline',
	},
};

export const Disabled = {
	args: {
		children: 'PROCESSING',
		disabled: true,
	},
};

export const Text = {
	args: {
		children: 'Read more',
		variant: 'text',
		color: 'strait-blue-600p',
	},
};

export const IconOnly = {
	args: {
		children: undefined,
		variant: 'icon',
		icon: <Icon name="notificationBell" decorative />,
		'aria-label': 'Open notifications',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', { name: 'Open notifications' });

		await expect(button).toBeVisible();
		await expect(button.querySelector('svg')).not.toBeNull();
		await expect(button).toHaveTextContent('');
	},
};

export const IconText = {
	args: {
		children: 'PAUSE',
		variant: 'text',
		color: 'sunset-horizon-300',
		icon: <PauseIcon />,
		iconPosition: 'left',
		className: 'rounded-none bg-cinemata-neutral-200 px-3 py-2 hover:bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-900 dark:hover:bg-cinemata-pacific-deep-950',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const button = canvas.getByRole('button', { name: 'PAUSE' });

		await expect(button).toBeVisible();
		await expect(button.querySelector('svg')).not.toBeNull();
	},
};
