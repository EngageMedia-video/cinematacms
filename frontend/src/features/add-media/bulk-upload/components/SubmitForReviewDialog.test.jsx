import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmitForReviewDialog } from './SubmitForReviewDialog';

describe('SubmitForReviewDialog', () => {
	it('does not cancel from overlay dismissal while submitting', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<SubmitForReviewDialog open onCancel={onCancel} onConfirm={vi.fn()} isSubmitting />);

		await user.click(document.body.querySelector('[data-dialog-overlay]'));

		expect(onCancel).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog', { name: 'Submit for review' })).toBeVisible();
	});

	it('allows overlay dismissal when not submitting', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<SubmitForReviewDialog open onCancel={onCancel} onConfirm={vi.fn()} />);

		await user.click(document.body.querySelector('[data-dialog-overlay]'));

		expect(onCancel).toHaveBeenCalledTimes(1);
	});
});
