import { expect, within } from 'storybook/test';
import { Icon } from '../Icon';
import { Link } from './Link';

const meta = {
	title: 'Components/Actions/Link',
	component: Link,
	tags: ['autodocs'],
	args: {
		children: 'Learn more',
		href: '#',
		variant: 'text',
	},
	argTypes: {
		align: {
			control: 'radio',
			options: ['left', 'center', 'right', 'between'],
			description: 'Horizontal alignment of link content (button variants only).',
			table: {
				type: { summary: "'left' | 'center' | 'right' | 'between'" },
				defaultValue: { summary: "'center'" },
			},
		},
		children: {
			control: 'text',
			description: 'Visible link label.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		className: {
			control: 'text',
			description: 'Optional extra classes to override text color, background, etc.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		href: {
			control: 'text',
			description: 'URL the link points to.',
			table: {
				type: { summary: 'string' },
			},
		},
		icon: {
			control: false,
			description: 'Optional icon element (button variants only).',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		iconPosition: {
			control: 'radio',
			options: ['left', 'right'],
			description: 'Controls whether the icon appears before or after the label.',
			table: {
				type: { summary: "'left' | 'right'" },
				defaultValue: { summary: "'left'" },
			},
		},
		variant: {
			control: 'radio',
			options: ['text', 'primary', 'secondary', 'tertiary', 'special', 'primary-outline', 'secondary-outline'],
			description: 'Visual style. Use `text` for a plain link or any button variant for a button-styled link.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'text'" },
			},
		},
	},
};

export default meta;

export const Text = {
	args: {
		children: 'Powered by CinemataCMS',
		className: 'body-body-12-regular text-cinemata-pacific-deep-400 dark:text-cinemata-strait-blue-300',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const link = canvas.getByRole('link', { name: 'Powered by CinemataCMS' });

		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute('href', '#');
	},
};

export const Primary = {
	args: {
		children: 'SIGN UP',
		variant: 'primary',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const link = canvas.getByRole('link', { name: 'SIGN UP' });

		await expect(link).toBeVisible();
		await expect(link).toHaveClass('body-body-14-bold');
	},
};

export const TertiaryWithIcon = {
	args: {
		children: 'DONATE',
		variant: 'tertiary',
		icon: <Icon name="donate" decorative />,
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
		iconPosition: 'right',
	},
};

export const PrimaryOutline = {
	args: {
		children: 'VIEW DOCS',
		variant: 'primary-outline',
	},
};

export const SecondaryOutline = {
	args: {
		children: 'CONTACT US',
		variant: 'secondary-outline',
	},
};

export const CustomTextColor = {
	args: {
		children: 'Terms & Privacy',
		className:
			'body-body-12-regular hover:opacity-90 text-cinemata-pacific-deep-400 dark:text-cinemata-strait-blue-300',
	},
};
