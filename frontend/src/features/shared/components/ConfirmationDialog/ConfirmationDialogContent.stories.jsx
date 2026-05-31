import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../Button';
import { Dialog, DialogClose, DialogTrigger } from '../Dialog';
import { ConfirmationDialogContent } from './ConfirmationDialogContent';

const meta = {
	title: 'Components/Overlays/Confirmation Dialog',
	component: ConfirmationDialogContent,
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Standardized confirmation dialog content built on top of the shared `Dialog` base. It keeps the layout, typography, and decorative corner image consistent while letting callers compose their own actions and decide which buttons should close the dialog.',
			},
		},
	},
	argTypes: {
		title: {
			control: 'text',
			description: 'Primary confirmation title shown beneath the top illustration.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Submit changes?'" },
			},
		},
		subtitle: {
			control: 'text',
			description: 'Supporting explanation text shown below the title.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'Please review your changes carefully before continuing.'" },
			},
		},
		iconName: {
			control: false,
			description: 'Shared illustration icon displayed above the title.',
			table: {
				type: { summary: 'string' },
				defaultValue: { summary: "'info3d'" },
			},
		},
		actions: {
			control: false,
			description:
				'Optional right-aligned action row. Compose your own buttons here and wrap them with `DialogClose` only when that action should dismiss the dialog.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
		children: {
			control: false,
			description: 'Optional custom content inserted between the subtitle and the action row.',
			table: {
				type: { summary: 'ReactNode' },
			},
		},
	},
	args: {
		title: 'Submit changes?',
		subtitle:
			'As a regular user, your video needs to be reviewed by an admin before being published. You will get an email notification after the review.',
	},
};

export default meta;

export const Default = {
	render: (args) => (
		<div className="flex min-h-[220px] items-center justify-center">
			<Dialog>
				<DialogTrigger>
					<Button>OPEN CONFIRMATION</Button>
				</DialogTrigger>

				<ConfirmationDialogContent
					{...args}
					aria-label="Submit confirmation"
					actions={
						<>
							<DialogClose>
								<Button type="button" variant="primary">
									Cancel
								</Button>
							</DialogClose>
							<DialogClose>
								<Button type="button" variant="tertiary">
									Yes, Submit
								</Button>
							</DialogClose>
						</>
					}
				/>
			</Dialog>
		</div>
	),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'OPEN CONFIRMATION' }));

		const dialog = within(document.body).getByRole('dialog', { name: 'Submit confirmation' });
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveTextContent('Submit changes?');
		await expect(dialog.querySelector('svg[data-icon="info3d"]')).not.toBeNull();
	},
};

export const OpenPreview = {
	render: (args) => (
		<Dialog defaultOpen>
			<ConfirmationDialogContent
				{...args}
				aria-label="Submit confirmation"
				actions={
					<>
						<DialogClose>
							<Button type="button" variant="primary">
								Cancel
							</Button>
						</DialogClose>
						<DialogClose>
							<Button type="button" variant="tertiary">
								Yes, Submit
							</Button>
						</DialogClose>
					</>
				}
			/>
		</Dialog>
	),
};

export const Controlled = {
	render: (args) => {
		const [open, setOpen] = useState(false);

		return (
			<div className="flex min-h-[220px] items-center justify-center">
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger>
						<Button variant="tertiary">SHOW CONFIRMATION</Button>
					</DialogTrigger>

					<ConfirmationDialogContent
						{...args}
						aria-label="Controlled confirmation"
						actions={
							<>
								<Button
									type="button"
									variant="primary"
									onClick={() => {
										args.onCancel?.();
										setOpen(false);
									}}
								>
									Cancel
								</Button>
								<Button
									type="button"
									variant="tertiary"
									onClick={() => {
										args.onConfirm?.();
										setOpen(false);
									}}
								>
									Yes, Submit
								</Button>
							</>
						}
					/>
				</Dialog>
			</div>
		);
	},
};
