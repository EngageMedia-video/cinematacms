import { useImperativeHandle, useRef } from 'react';
import { FieldGroup } from '../../add-media/single-upload/components/FieldGroup';
import { Text } from '../../shared/components';
import { MediaDropzone } from '../../shared/components/MediaDropzone';
import { UploadMediaItem } from '../../shared/components/UploadMediaItem';
import { getCSRFToken } from '../../add-media/utils/helpers';
import { UPLOAD_STATUS, createTusUploader } from '../../shared/utils/tusUpload';
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

export function MediaUploadSection({ config, disabled, ref }) {
	const uploaderRef = useRef(null);
	const { status, setStatus, resetStatus } = useReplacementUploadState();

	// Leaving stops the transfer anyway. Pausing it first lets the upload continue if the page stays.
	useImperativeHandle(ref, () => ({
		pauseBeforeLeave() {
			if (status.phase !== 'uploading' || !uploaderRef.current?.pauseUpload?.(status.id)) return;
			setStatus((current) => ({ ...current, phase: 'paused', error: '' }));
		},
	}));

	function ensureUploader() {
		if (uploaderRef.current) {
			return uploaderRef.current;
		}

		uploaderRef.current = createTusUploader({
			endpoint: config.uploadEndpoint,
			getHeaders: () => ({ 'X-CSRFToken': getCSRFToken() || config.csrfToken || '' }),
			validation: {
				itemLimit: 1,
				sizeLimit: config.uploadMaxSize,
				allowedExtensions: config.allowedExtensions || [],
			},
			callbacks: {
				onSubmitted: (id, name) => {
					setStatus({ phase: 'uploading', name, progress: 0, error: '', size: null, id });
					window.CinemataAnalytics?.uploadEvent('start', id);
				},
				onStatusChange: (id, uploadStatus, message) => {
					if (uploadStatus === UPLOAD_STATUS.AWAITING_SIGN_IN) {
						// Signing in again and pressing Continue resumes from the server's offset.
						setStatus((current) => ({ ...current, phase: 'paused', error: message }));
					} else if (uploadStatus === UPLOAD_STATUS.EXPIRED) {
						setStatus((current) => ({ ...current, phase: 'error', error: message }));
					}
				},
				onProgress: (id, name, uploadedBytes, totalBytes) => {
					const progress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
					setStatus((current) => ({ ...current, id, name, progress }));
				},
				onComplete: (id, name) => {
					window.CinemataAnalytics?.uploadEvent('complete', id);
					const size = uploaderRef.current?.getSize(id) ?? null;
					setStatus({ phase: 'complete', name, progress: 100, error: '', size, id });
				},
				onError: (id, name, errorReason) => {
					window.CinemataAnalytics?.uploadEvent('error', id);
					// A refused file has no id and never became an upload item.
					setStatus((current) => ({
						...current,
						phase: 'error',
						name,
						error: errorReason || 'Upload failed.',
						...(id === null ? { progress: 0, size: null, id: undefined } : { id }),
					}));
				},
				onCancel: (id) => {
					window.CinemataAnalytics?.uploadEvent('cancel', id);
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

	async function clearReplacementUpload() {
		const transferInFlight = ['uploading', 'paused'].includes(status.phase);
		if (transferInFlight && status.id !== undefined) {
			uploaderRef.current?.cancel(status.id);
		}

		if (config.uploadCancelEndpoint) {
			const response = await fetch(config.uploadCancelEndpoint, {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-CSRFToken': getCSRFToken() || config.csrfToken || '',
				},
			}).catch(() => null);

			if (!response?.ok) {
				setStatus((current) => ({
					...current,
					phase: 'error',
					error: 'Could not remove the replacement upload. Please try again.',
				}));
				return;
			}
		}

		// A finished file still counts against itemLimit until reset.
		uploaderRef.current?.reset();
		resetStatus();
		window.CinemataAnalytics?.uploadEvent('discard', status.id);
	}

	function retryUpload() {
		if (status.id === undefined || !uploaderRef.current?.retry) {
			resetStatus();
			return;
		}

		if (uploaderRef.current.retry(status.id)) {
			window.CinemataAnalytics?.uploadEvent('retry', status.id);
			setStatus((current) => ({ ...current, phase: 'uploading', error: '' }));
		} else {
			resetStatus();
		}
	}

	function pauseUpload() {
		if (status.id === undefined || !uploaderRef.current?.pauseUpload) {
			return;
		}

		const paused = uploaderRef.current.pauseUpload(status.id);
		if (paused) {
			window.CinemataAnalytics?.uploadEvent('pause', status.id);
			setStatus((current) => ({ ...current, phase: 'paused', error: '' }));
		}
	}

	function continueUpload() {
		if (status.id === undefined || !uploaderRef.current?.continueUpload) {
			return;
		}

		const continued = uploaderRef.current.continueUpload(status.id);
		if (continued) {
			window.CinemataAnalytics?.uploadEvent('resume', status.id);
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
		status.phase === 'complete'
			? 'Ready'
			: status.phase === 'error'
				? status.error || 'Upload failed'
				: status.error || undefined;

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
							className="mt-2 p-2"
							title={status.name || 'Uploaded media'}
							fileSize={status.size}
							status={uploadItemStatus}
							statusText={uploadItemStatusText}
							progress={status.progress}
							onCancel={clearReplacementUpload}
							onContinue={continueUpload}
							onDelete={clearReplacementUpload}
							onPause={pauseUpload}
							onRetry={retryUpload}
							onReupload={clearReplacementUpload}
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
