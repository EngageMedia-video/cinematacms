import { Dialog, ConfirmationDialogContent, Button } from '../../../shared/components';

/**
 * Mandatory notice shown when the bulk selection becomes exactly one file
 * (decision D2). It has a single Continue action — there is no "stay on bulk"
 * option — and on Continue the user is redirected to the single-upload page.
 */
export function RedirectNoticeDialog({ open, onContinue }) {
	return (
		<Dialog open={open} onOpenChange={() => {}}>
			<ConfirmationDialogContent
				aria-label="Switch to single upload"
				title="Switching to Single Upload"
				subtitle="You have only one file. Single files are handled on the single-upload tab — continue to move it there and finish adding details. Your upload is kept; you won't need to upload again."
				iconName="info3d"
				actions={
					<Button variant="primary" onClick={onContinue}>
						Continue
					</Button>
				}
			/>
		</Dialog>
	);
}
