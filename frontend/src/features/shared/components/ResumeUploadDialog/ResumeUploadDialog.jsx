import { Button } from '../Button';
import { ConfirmationDialogContent } from '../ConfirmationDialog';
import { Dialog } from '../Dialog';
import { formatBytes } from '../../utils/formatBytes';

function describe(uploads) {
	if (uploads.length === 1) {
		const [{ name, storedBytes, totalBytes }] = uploads;
		return {
			title: 'Part of this file is already uploaded',
			subtitle: `“${name}” was partly uploaded before: ${formatBytes(storedBytes)} of ${formatBytes(totalBytes)} is saved. Select OK to continue the upload from there.`,
		};
	}
	return {
		title: 'Parts of these files are already uploaded',
		subtitle: `${uploads.length} files were partly uploaded before. Select OK to continue each upload from the part that is saved.`,
	};
}

/**
 * Tells the user that the server already holds part of the files they selected, and that each
 * upload continues from there. `uploads` holds `{ id, name, storedBytes, totalBytes }` entries;
 * the dialog is open while it has any. Every way of closing the dialog calls `onConfirm`, because
 * the uploads wait for it.
 */
export function ResumeUploadDialog({ uploads = [], onConfirm }) {
	const { title, subtitle } = uploads.length ? describe(uploads) : {};
	return (
		<Dialog open={uploads.length > 0} onOpenChange={(open) => !open && onConfirm()}>
			<ConfirmationDialogContent
				aria-label={title}
				title={title}
				subtitle={subtitle}
				actions={
					<Button variant="primary" onClick={onConfirm}>
						OK
					</Button>
				}
			/>
		</Dialog>
	);
}
