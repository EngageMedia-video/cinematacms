import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { Dialog, DialogContent, DialogTrigger } from './Dialog';

const meta = {
	title: 'Components/Overlays/Dialog',
	component: Dialog,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Base shared dialog with a shadcn-style compound API: `Dialog`, `DialogTrigger`, and `DialogContent`. It opens in the middle of the screen with a `pacific-deep/950` backdrop at `80%` opacity, and the dialog body accepts any custom content.',
			},
		},
	},
	argTypes: {
		defaultOpen: {
			control: 'boolean',
			description: 'Initial uncontrolled open state for the dialog root.',
			table: {
				type: { summary: 'boolean' },
				defaultValue: { summary: 'false' },
			},
		},
		open: {
			control: false,
			description: 'Controlled open state when the dialog is managed from outside.',
			table: {
				type: { summary: 'boolean' },
			},
		},
		onOpenChange: {
			action: 'open-changed',
			description: 'Called whenever the dialog requests an open-state change.',
			table: {
				type: { summary: '(open: boolean) => void' },
			},
		},
	},
	args: {
		defaultOpen: false,
	},
};

export default meta;

export const Default = {
	render: (args) => (
		<div className="flex min-h-[220px] items-center justify-center">
			<Dialog {...args}>
				<DialogTrigger>
					<Button>OPEN DIALOG</Button>
				</DialogTrigger>

				<DialogContent
					aria-label="Upload dialog"
					className="w-full max-w-[480px] rounded-[8px] bg-bg-surface-raised p-6"
				>
					<div className="space-y-2">
						<h2 className="heading-h4 text-cinemata-neutral-900 dark:text-cinemata-white">
							Upload confirmation
						</h2>
						<p className="body-body-16-regular text-cinemata-neutral-600 dark:text-cinemata-strait-blue-50">
							Your media is ready to be reviewed before publishing.
						</p>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const trigger = canvas.getByRole('button', { name: 'OPEN DIALOG' });

		await userEvent.click(trigger);
		await expect(within(document.body).getByRole('dialog', { name: 'Upload dialog' })).toBeVisible();
	},
};

export const OpenPreview = {
	args: {
		defaultOpen: true,
	},
	render: (args) => (
		<Dialog {...args}>
			<DialogContent
				aria-label="Invite dialog"
				className="w-full max-w-[480px] rounded-[8px] bg-bg-surface-raised p-6"
			>
				<div className="space-y-2">
					<h2 className="heading-h4 text-cinemata-neutral-900 dark:text-cinemata-white">
						Invite collaborators
					</h2>
					<p className="body-body-16-regular text-cinemata-neutral-600 dark:text-cinemata-strait-blue-50">
						Share this workspace with the editorial team to continue the review together.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	),
};

export const Controlled = {
	render: (args) => {
		const [open, setOpen] = useState(false);

		return (
			<div className="flex min-h-[220px] items-center justify-center">
				<Dialog
					{...args}
					open={open}
					onOpenChange={(nextOpen) => {
						setOpen(nextOpen);
						args.onOpenChange?.(nextOpen);
					}}
				>
					<DialogTrigger>
						<Button variant="tertiary">SHOW DETAILS</Button>
					</DialogTrigger>

					<DialogContent
						aria-label="Details dialog"
						className="w-full max-w-[480px] rounded-[8px] bg-bg-surface-raised p-6"
					>
						<div className="space-y-2">
							<h2 className="heading-h4 text-cinemata-neutral-900 dark:text-cinemata-white">
								Review details
							</h2>
							<p className="body-body-16-regular text-cinemata-neutral-600 dark:text-cinemata-strait-blue-50">
								This example is controlled by external component state.
							</p>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		);
	},
};
