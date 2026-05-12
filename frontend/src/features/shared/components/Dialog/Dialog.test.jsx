import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { Dialog, DialogContent, DialogTrigger } from './Dialog';

describe('Dialog', () => {
	it('opens the dialog content from the trigger and renders it in a centered overlay', async () => {
		const user = userEvent.setup();

		render(
			<Dialog>
				<DialogTrigger>
					<Button>OPEN DIALOG</Button>
				</DialogTrigger>
				<DialogContent aria-label="Upload dialog">
					<div>
						<h2>Upload confirmation</h2>
						<p>Your media is ready to be reviewed before publishing.</p>
					</div>
				</DialogContent>
			</Dialog>
		);

		await user.click(screen.getByRole('button', { name: 'OPEN DIALOG' }));

		const dialog = screen.getByRole('dialog', { name: 'Upload dialog' });

		expect(dialog).toBeVisible();
		expect(document.body.querySelector('[data-dialog-overlay]')).not.toBeNull();
	});

	it('closes when the overlay is clicked', async () => {
		const user = userEvent.setup();

		render(
			<Dialog defaultOpen>
				<DialogContent aria-label="Upload dialog">Dialog body</DialogContent>
			</Dialog>
		);

		const overlay = document.body.querySelector('[data-dialog-overlay]');
		expect(screen.getByRole('dialog', { name: 'Upload dialog' })).toBeVisible();

		await user.click(overlay);

		expect(screen.queryByRole('dialog', { name: 'Upload dialog' })).toBeNull();
	});

	it('supports controlled open state changes', async () => {
		const user = userEvent.setup();
		const handleOpenChange = vi.fn();

		function ControlledDialog() {
			return (
				<Dialog open={true} onOpenChange={handleOpenChange}>
					<DialogTrigger>
						<Button>OPEN DIALOG</Button>
					</DialogTrigger>
					<DialogContent aria-label="Controlled dialog">Dialog body</DialogContent>
				</Dialog>
			);
		}

		render(<ControlledDialog />);

		const overlay = document.body.querySelector('[data-dialog-overlay]');
		await user.click(overlay);

		expect(handleOpenChange).toHaveBeenCalledWith(false);
		expect(screen.getByRole('dialog', { name: 'Controlled dialog' })).toBeVisible();
	});

	it('closes when escape is pressed', async () => {
		const user = userEvent.setup();

		render(
			<Dialog defaultOpen>
				<DialogContent aria-label="Escape dialog">Dialog body</DialogContent>
			</Dialog>
		);

		expect(screen.getByRole('dialog', { name: 'Escape dialog' })).toBeVisible();

		await user.keyboard('{Escape}');

		expect(screen.queryByRole('dialog', { name: 'Escape dialog' })).toBeNull();
	});

	it('traps focus inside the dialog and restores focus to the trigger on close', async () => {
		const user = userEvent.setup();
		const { container } = render(
			<div>
				<button type="button">Outside action</button>
				<Dialog>
					<DialogTrigger>
						<Button>OPEN DIALOG</Button>
					</DialogTrigger>
					<DialogContent aria-label="Focus dialog">
						<div>
							<button type="button">First action</button>
							<button type="button">Second action</button>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		);

		const trigger = screen.getByRole('button', { name: 'OPEN DIALOG' });
		await user.click(trigger);

		expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole('button', { name: 'Second action' })).toHaveFocus();

		await user.tab();
		expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();

		await user.keyboard('{Escape}');
		expect(trigger).toHaveFocus();
		expect(container).not.toHaveAttribute('aria-hidden');
		expect(container).not.toHaveAttribute('inert');
	});

	it('hides the background from assistive tech while the dialog is open', () => {
		const { container } = render(
			<div>
				<button type="button">Outside action</button>
				<Dialog defaultOpen>
					<DialogContent aria-label="Modal dialog">Dialog body</DialogContent>
				</Dialog>
			</div>
		);

		expect(container).toHaveAttribute('aria-hidden', 'true');
		expect(container).toHaveAttribute('inert');
	});
});
