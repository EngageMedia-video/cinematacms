import { useRef } from 'react';
import { FieldGroup } from '../../add-media/single-upload/components/FieldGroup';
import { Text } from '../../shared/components';
import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { UploadMediaItem } from '../../shared/components/UploadMediaItem';
import { getCSRFToken } from '../../add-media/utils/helpers';
import { useReplacementUploadState } from '../hooks/useReplacementUploadState';

function CurrentFileLink({ file }) {
	if (!file?.url) {
		return <span>No media file uploaded yet.</span>;
	}

	return (
		<a href={file.url} target="_blank" rel="noreferrer" className="text-text-link hover:text-text-link-hover">
			{file.name || file.url}
		</a>
	);
}

export function MediaUploadSection({ config, disabled }) {
	const uploaderRef = useRef(null);
	const { status, setStatus, resetStatus } = useReplacementUploadState();

	function ensureUploader() {
		if (uploaderRef.current) {
			return uploaderRef.current;
		}

		if (!window.qq?.FineUploaderBasic) {
			setStatus({ phase: 'error', name: '', progress: 0, error: 'FineUploader is not available.', size: null });
			return null;
		}

		uploaderRef.current = new window.qq.FineUploaderBasic({
			debug: false,
			request: {
				endpoint: config.uploadEndpoint,
				customHeaders: { 'X-CSRFToken': getCSRFToken() || config.csrfToken || '' },
			},
			retry: {
				enableAuto: true,
				maxAutoAttempts: 2,
			},
			validation: {
				itemLimit: 1,
				sizeLimit: config.uploadMaxSize,
				allowedExtensions: config.allowedExtensions || [],
				acceptFiles: 'video/*',
			},
			chunking: {
				enabled: true,
				concurrent: { enabled: true },
				success: { endpoint: config.uploadCompleteEndpoint },
			},
			callbacks: {
				onSubmit: (id, name) => {
					setStatus({ phase: 'uploading', name, progress: 0, error: '', size: null, id });
				},
				onProgress: (id, name, uploadedBytes, totalBytes) => {
					const progress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
					setStatus((current) => ({ ...current, id, name, progress }));
				},
				onComplete: (id, name, response) => {
					if (response?.success) {
						let size = null;
						try {
							size = uploaderRef.current?.getFile(id)?.size ?? null;
						} catch (_error) {
							size = null;
						}
						setStatus({ phase: 'complete', name, progress: 100, error: '', size, id });
					} else {
						setStatus({
							phase: 'error',
							name,
							progress: 0,
							error: 'Upload failed. Please try again.',
							size: null,
							id,
						});
					}
				},
				onError: (id, name, errorReason) => {
					setStatus({
						phase: 'error',
						name,
						progress: 0,
						error: errorReason || 'Upload failed.',
						size: null,
						id,
					});
				},
				onCancel: () => {
					setStatus({ phase: 'cancelled', name: '', progress: 0, error: '', size: null });
				},
			},
		});

		return uploaderRef.current;
	}

	function handleFilesSelected(files) {
		if (!files.length) return;
		const uploader = ensureUploader();
		uploader?.addFiles(files.slice(0, 1));
	}

	async function cancelPendingUpload() {
		if (status.id !== undefined) {
			uploaderRef.current?.cancel(status.id);
		}

		if (config.uploadCancelEndpoint) {
			await fetch(config.uploadCancelEndpoint, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': getCSRFToken() || config.csrfToken || '',
				},
			}).catch(() => null);
		}

		resetStatus();
	}

	function retryUpload() {
		if (status.id === undefined || !uploaderRef.current?.retry) {
			resetStatus();
			return;
		}

		setStatus((current) => ({ ...current, phase: 'uploading', error: '' }));
		uploaderRef.current.retry(status.id);
	}

	function pauseUpload() {
		if (status.id === undefined || !uploaderRef.current?.pauseUpload) {
			return;
		}

		const paused = uploaderRef.current.pauseUpload(status.id);
		if (paused) {
			setStatus((current) => ({ ...current, phase: 'paused', error: '' }));
		}
	}

	function continueUpload() {
		if (status.id === undefined || !uploaderRef.current?.continueUpload) {
			return;
		}

		const continued = uploaderRef.current.continueUpload(status.id);
		if (continued) {
			setStatus((current) => ({ ...current, phase: 'uploading', error: '' }));
		}
	}

	const hasUploadItem = ['uploading', 'paused', 'error', 'complete'].includes(status.phase);
	const uploadItemStatus =
		status.phase === 'complete'
			? 'complete'
			: status.phase === 'error'
				? 'failed'
				: status.phase === 'paused'
					? 'paused'
					: 'uploading';
	const uploadItemStatusText =
		status.phase === 'complete' ? 'Ready' : status.phase === 'error' ? status.error || 'Upload failed' : undefined;

	return (
		<FieldGroup
			title="Media Upload"
			description="Upload a replacement media file only when you want to change the original video. The new file is saved after you click Update Media."
		>
			<div className="rounded-ds-4 border border-border-subtle bg-bg-surface-muted p-4">
				<Text variant="body-14-bold" className="m-0 text-text-strong">
					Current file
				</Text>
				<Text variant="body-14" className="m-0 mt-1 text-text-muted">
					<CurrentFileLink file={config.media?.currentMediaFile} />
				</Text>
			</div>

			<div>
				{hasUploadItem ? (
					<>
						<UploadMediaItem
							className="mt-2"
							title={status.name || 'Uploaded media'}
							fileSize={status.size}
							status={uploadItemStatus}
							statusText={uploadItemStatusText}
							progress={status.progress}
							onCancel={cancelPendingUpload}
							onContinue={continueUpload}
							onDelete={cancelPendingUpload}
							onPause={pauseUpload}
							onRetry={retryUpload}
							onReupload={resetStatus}
						/>
						{status.phase === 'complete' ? (
							<Text variant="body-12" className="m-0 mt-3 text-text-muted">
								Click Update Media below to save this replacement file.
							</Text>
						) : null}
					</>
				) : (
					<MediaDropzone
						accept="video/*"
						multiple={false}
						label="Drag & Drop File or"
						buttonVariant="secondary"
						buttonLabel="CHOOSE MEDIA"
						disabled={disabled}
						onFilesSelected={handleFilesSelected}
					/>
				)}
			</div>
		</FieldGroup>
	);
}
