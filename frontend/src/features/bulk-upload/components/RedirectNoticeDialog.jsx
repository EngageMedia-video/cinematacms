import { Dialog, ConfirmationDialogContent, Button } from '../../shared/components';

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
				subtitle="You have only one file selected. A single file is uploaded on the single-upload page. Continue to go there and re-select your file."
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
