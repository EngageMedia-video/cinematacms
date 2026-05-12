import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Tooltip } from './Tooltip';

function TooltipIconButton(props) {
	return (
		<Button
			variant="icon"
			aria-label="Open tooltip"
			icon={<Icon name="infoYellow" size={18} decorative />}
			{...props}
		/>
	);
}

const meta = {
	title: 'Components/Overlays/Tooltip',
	component: Tooltip,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Lightweight tooltip container with configurable placement, hover or click activation, and fully custom content. The trigger can be any single interactive child element.',
			},
		},
	},
	args: {
		placement: 'top',
		trigger: 'hover',
		content: 'Helpful supporting text shown near the trigger.',
	},
	argTypes: {
		content: {
			control: 'text',
			description: 'Tooltip body content. It can be plain text or any React node in code usage.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		placement: {
			control: 'radio',
			options: ['top', 'right', 'bottom', 'left'],
			description: 'Controls which side of the trigger the tooltip appears on.',
			table: {
				type: { summary: "'top' | 'right' | 'bottom' | 'left'" },
				defaultValue: { summary: "'top'" },
			},
		},
		trigger: {
			control: 'radio',
			options: ['hover', 'click'],
			description: 'Determines whether the tooltip opens on hover/focus or on click.',
			table: {
				type: { summary: "'hover' | 'click'" },
				defaultValue: { summary: "'hover'" },
			},
		},
		open: {
			control: false,
			description: 'Controlled open state when the parent manages visibility.',
			table: {
				type: { summary: 'boolean' },
			},
		},
		defaultOpen: {
			control: 'boolean',
			description: 'Initial uncontrolled open state.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		onOpenChange: {
			action: 'open-changed',
			description: 'Called whenever the tooltip visibility changes.',
			table: {
				type: { summary: '(open: boolean) => void' },
			},
		},
		className: {
			control: 'text',
			description: 'Optional class applied to the tooltip wrapper around the trigger.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		contentClassName: {
			control: 'text',
			description: 'Optional class applied directly to the tooltip surface.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "''" },
			},
		},
		children: {
			control: false,
			description: 'A single trigger element, commonly an icon button.',
			table: {
				type: { summary: 'ReactElement' },
			},
		},
	},
	render: (args) => (
		<div className="flex w-[300px] h-[400px] items-center justify-center bg-cinemata-neutral-100 dark:bg-cinemata-pacific-deep-950 p-10">
			<Tooltip {...args}>
				<TooltipIconButton />
			</Tooltip>
		</div>
	),
};

export default meta;

export const Hover = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Open tooltip' });

		await userEvent.hover(trigger);
		await expect(canvas.getByRole('tooltip')).toBeVisible();
	},
};

export const Click = {
	args: {
		trigger: 'click',
		content: 'Click again or click outside to dismiss this tooltip.',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'Open tooltip' });

		await userEvent.click(trigger);
		await expect(canvas.getByRole('tooltip')).toBeVisible();
	},
};

export const RichContent = {
	args: {
		trigger: 'click',
		content: (
			<div className="flex max-w-[220px] flex-col gap-1">
			<p className="body-body-14-bold text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50">Tooltip Title</p>
			<p className="body-body-14-regular text-cinemata-neutral-500 dark:text-cinemata-pacific-deep-300">
					Add any custom content here while keeping the same shared tooltip surface.
				</p>
			</div>
		),
	},
};

export const Controlled = {
	render: (args) => {
		const [open, setOpen] = useState(true);

		return (
			<div className="flex min-h-[240px] items-center justify-center bg-cinemata-neutral-100 dark:bg-cinemata-pacific-deep-950 p-10">
				<Tooltip {...args} trigger="click" open={open} onOpenChange={setOpen}>
					<TooltipIconButton />
				</Tooltip>
			</div>
		);
	},
};
