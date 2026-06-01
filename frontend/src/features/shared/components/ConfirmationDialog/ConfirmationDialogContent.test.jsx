import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { Dialog, DialogClose, DialogTrigger } from '../Dialog';
import { ConfirmationDialogContent } from './ConfirmationDialogContent';

describe('ConfirmationDialogContent', () => {
	it('renders the standardized confirmation shell with the configured title, subtitle, icon, and action buttons', () => {
		render(
			<Dialog defaultOpen>
				<ConfirmationDialogContent
					aria-label="Submit confirmation"
					title="Submit changes?"
					subtitle="Your updated metadata will be published and become visible to collaborators."
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
		);

		const dialog = screen.getByRole('dialog', { name: 'Submit confirmation' });
		const title = screen.getByRole('heading', { name: 'Submit changes?' });
		const cancelButton = screen.getByRole('button', { name: 'Cancel' });
		const confirmButton = screen.getByRole('button', { name: 'Yes, Submit' });
		const decorativeImage = dialog.querySelector('img');

		expect(dialog).toBeVisible();
		expect(
			screen.getByText('Your updated metadata will be published and become visible to collaborators.')
		).toBeVisible();
		expect(dialog.querySelector('svg[data-icon="info3d"]')).not.toBeNull();
		expect(cancelButton).toBeVisible();
		expect(confirmButton).toBeVisible();
		expect(decorativeImage).not.toBeNull();
	});

	it('renders custom body content above the action row', () => {
		render(
			<Dialog defaultOpen>
				<ConfirmationDialogContent
					aria-label="Submit confirmation"
					actions={
						<DialogClose>
							<Button type="button">Dismiss</Button>
						</DialogClose>
					}
				>
					<div>Additional warning details</div>
				</ConfirmationDialogContent>
			</Dialog>
		);

		expect(screen.getByText('Additional warning details')).toBeVisible();
		expect(screen.getByRole('button', { name: 'Dismiss' })).toBeVisible();
	});

	it('closes when a caller wraps an action in DialogClose', async () => {
		const user = userEvent.setup();

		render(
			<Dialog defaultOpen>
				<ConfirmationDialogContent
					aria-label="Submit confirmation"
					actions={
						<DialogClose>
							<Button type="button">Cancel</Button>
						</DialogClose>
					}
				/>
			</Dialog>
		);

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(screen.queryByRole('dialog', { name: 'Submit confirmation' })).toBeNull();
	});

	it('keeps the dialog open when a custom action is not wrapped in DialogClose', async () => {
		const user = userEvent.setup();
		const handleConfirm = vi.fn();

		render(
			<Dialog defaultOpen>
				<ConfirmationDialogContent
					aria-label="Submit confirmation"
					actions={
						<Button type="button" onClick={handleConfirm}>
							Yes, Submit
						</Button>
					}
				/>
			</Dialog>
		);

		await user.click(screen.getByRole('button', { name: 'Yes, Submit' }));

		expect(handleConfirm).toHaveBeenCalledTimes(1);
		expect(screen.getByRole('dialog', { name: 'Submit confirmation' })).toBeVisible();
	});

	it('works inside the base dialog trigger flow', async () => {
		const user = userEvent.setup();

		render(
			<Dialog>
				<DialogTrigger>
					<Button>OPEN CONFIRMATION</Button>
				</DialogTrigger>
				<ConfirmationDialogContent aria-label="Submit confirmation" />
			</Dialog>
		);

		await user.click(screen.getByRole('button', { name: 'OPEN CONFIRMATION' }));

		expect(screen.getByRole('dialog', { name: 'Submit confirmation' })).toBeVisible();
	});
});
