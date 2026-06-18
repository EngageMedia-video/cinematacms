import { Dialog, ConfirmationDialogContent, Button } from '../../../shared/components';

/**
 * "Submit For Review?" confirmation, shown to regular (non-trusted) users before
 * submitting. Trusted users skip this and submit directly.
 */
export function SubmitForReviewDialog({ open, onCancel, onConfirm, isSubmitting = false }) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					if (isSubmitting) {
						return;
					}
					onCancel?.();
				}
			}}
		>
			<ConfirmationDialogContent
				aria-label="Submit for review"
				title="Submit For Review?"
				subtitle="As a regular user, your video needs to be reviewed by an admin before being published. You will get an email notification after the review."
				iconName="info3d"
				actions={
					<>
						<Button variant="secondary-outline" onClick={onCancel} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button variant="primary" onClick={onConfirm} disabled={isSubmitting}>
							{isSubmitting ? 'Submitting…' : 'Yes, Submit'}
						</Button>
					</>
				}
			/>
		</Dialog>
	);
}
