import { Button } from '../Button';
import { ConfirmationDialogContent } from '../ConfirmationDialog';
import { Dialog } from '../Dialog';

export function UnsavedChangesDialog({ open, onStay, onLeave }) {
	return (
		<Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onStay()}>
			<ConfirmationDialogContent
				aria-label="Leave this page?"
				title="Leave this page?"
				subtitle="You have unsaved changes. If you leave now, they will be lost."
				actions={
					<>
						<Button variant="secondary-outline" onClick={onStay}>
							Stay
						</Button>
						<Button variant="primary" onClick={onLeave}>
							Leave
						</Button>
					</>
				}
			/>
		</Dialog>
	);
}
