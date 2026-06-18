import { UploadMediaItem } from '../../../../shared/components';
import { useBulkUploadActions } from '../../BulkUploadActionsContext';

/**
 * One file row in Step 1. Delegates rendering to the shared `UploadMediaItem`
 * (same component the single-upload flow uses), wiring its per-status actions
 * to the bulk upload engine. Status strings (uploading/paused/complete/failed)
 * map 1:1 to the store's UPLOAD_STATUS values.
 */
export function UploadFileRow({ file }) {
	const { pause, resume, cancel, retry, reupload, deleteFile } = useBulkUploadActions();
	const { id, name, sizeBytes, uploadStatus, progress } = file;

	return (
		<li>
			<UploadMediaItem
				title={name}
				fileSize={sizeBytes}
				status={uploadStatus}
				progress={progress}
				onPause={() => pause(id)}
				onContinue={() => resume(id)}
				onCancel={() => cancel(id)}
				onRetry={() => retry(id)}
				onReupload={() => reupload(id)}
				onDelete={() => deleteFile(id)}
			/>
		</li>
	);
}
