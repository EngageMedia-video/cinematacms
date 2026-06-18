import { useCallback, useEffect, useMemo, useRef } from 'react';
import useBulkUploadStore, { UPLOAD_STATUS } from '../useBulkUploadStore';
import { useBulkUploadConfig } from '../bulkUploadConfig';
import { apiFetch, getCSRFToken, parseFriendlyToken } from '../../shared/utils/api';

/**
 * Drives N concurrent chunked uploads through the bundled FineUploader engine
 * (the same engine the Django backend was built for) and mirrors each file's
 * progress/status into the Zustand store. Pause/resume is client-side only
 * (decision D5): a page reload loses the chunk cursor, which the REUPLOAD action
 * recovers from.
 */
export function useBulkUpload() {
	const config = useBulkUploadConfig();
	const uploaderRef = useRef(null);
	const filesByIdRef = useRef(new Map());

	const addFile = useBulkUploadStore((state) => state.addFile);
	const updateFile = useBulkUploadStore((state) => state.updateFile);
	const removeFile = useBulkUploadStore((state) => state.removeFile);
	const setLastError = useBulkUploadStore((state) => state.setLastError);

	useEffect(() => {
		const qq = typeof window !== 'undefined' ? window.qq : undefined;
		if (!qq || !qq.FineUploaderBasic) {
			console.warn('FineUploader library is not loaded; bulk upload is disabled.');
			return undefined;
		}

		let uploader;
		uploader = new qq.FineUploaderBasic({
			autoUpload: true,
			request: {
				endpoint: config.uploadEndpoint,
				customHeaders: { 'X-CSRFToken': getCSRFToken() ?? '' },
				// Mark every bulk upload as a private draft on creation; the server
				// keeps it out of the admin review queue until the user submits.
				params: { is_draft: 1 },
			},
			chunking: {
				enabled: true,
				concurrent: { enabled: true },
				success: { endpoint: `${config.uploadEndpoint}?${config.chunksDoneParam}` },
			},
			retry: { enableAuto: false },
			validation: {
				itemLimit: config.maxFiles,
				sizeLimit: config.maxSizeBytes || undefined,
				allowedExtensions: config.allowedExtensions || [],
				acceptFiles: 'video/*',
			},
			callbacks: {
				onSubmitted(id, name) {
					filesByIdRef.current.set(id, uploader.getFile(id));
					addFile({ id, name, sizeBytes: uploader.getSize(id) });
					setLastError(null);
				},
				onProgress(id, name, uploadedBytes, totalBytes) {
					const progress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
					updateFile(id, { progress, uploadStatus: UPLOAD_STATUS.UPLOADING });
				},
				onComplete(id, name, response) {
					if (response && response.success && response.media_url) {
						const friendlyToken = parseFriendlyToken(response.media_url);
						updateFile(id, {
							uploadStatus: UPLOAD_STATUS.COMPLETE,
							progress: 100,
							friendlyToken,
							error: null,
						});
						// The chunked uploader generates a thumbnail synchronously on
						// create (set_thumbnail), so fetch the media's poster for the
						// Quick Preview. Best-effort: the placeholder stays if it isn't
						// ready (e.g. before encoding produces a frame).
						if (friendlyToken) {
							apiFetch(`/api/v1/media/${friendlyToken}`)
								.then((res) => (res.ok ? res.json() : null))
								.then((data) => {
									const thumbnailUrl = data && (data.thumbnail_url || data.poster_url);
									if (thumbnailUrl) {
										updateFile(id, { thumbnailUrl });
									}
								})
								.catch(() => {
									// preview thumbnail is non-critical; ignore failures.
								});
						}
					} else {
						updateFile(id, {
							uploadStatus: UPLOAD_STATUS.FAILED,
							error: (response && response.error) || 'Upload failed.',
						});
					}
				},
				onError(id, name, errorReason) {
					if (id === null || id === undefined) {
						setLastError(errorReason || 'Upload error.');
						return;
					}
					updateFile(id, { uploadStatus: UPLOAD_STATUS.FAILED, error: errorReason || 'Upload failed.' });
				},
				onCancel(id) {
					removeFile(id);
					filesByIdRef.current.delete(id);
					return true;
				},
				onStatusChange(id, oldStatus, newStatus) {
					if (newStatus === 'paused') {
						updateFile(id, { uploadStatus: UPLOAD_STATUS.PAUSED });
					}
				},
			},
		});

		uploaderRef.current = uploader;
		return () => {
			uploaderRef.current?.cancelAll();
			uploaderRef.current = null;
			filesByIdRef.current.clear();
		};
	}, [config, addFile, updateFile, removeFile, setLastError]);

	const addFiles = useCallback((fileList) => {
		if (uploaderRef.current) {
			uploaderRef.current.addFiles(fileList);
		}
	}, []);

	const pause = useCallback((id) => {
		uploaderRef.current?.pauseUpload(id);
	}, []);

	const resume = useCallback(
		(id) => {
			if (uploaderRef.current?.continueUpload(id)) {
				updateFile(id, { uploadStatus: UPLOAD_STATUS.UPLOADING });
			}
		},
		[updateFile]
	);

	const cancel = useCallback(
		(id) => {
			// Abort the in-flight/queued upload, then drop the row unconditionally.
			// The FineUploader method is `cancel(id)` (not `cancelUpload`); guard it
			// so a throw can't stop us from clearing the row (removeFile is idempotent
			// and onCancel may not fire for a paused item).
			try {
				uploaderRef.current?.cancel(id);
			} catch {
				// best-effort abort; the row is removed regardless.
			}
			removeFile(id);
			filesByIdRef.current.delete(id);
		},
		[removeFile]
	);

	const retry = useCallback(
		(id) => {
			updateFile(id, { uploadStatus: UPLOAD_STATUS.UPLOADING, progress: 0, error: null });
			uploaderRef.current?.retry(id);
		},
		[updateFile]
	);

	const reupload = useCallback(
		(id) => {
			const file = filesByIdRef.current.get(id);
			removeFile(id);
			filesByIdRef.current.delete(id);
			if (file && uploaderRef.current) {
				uploaderRef.current.addFiles([file]);
			}
		},
		[removeFile]
	);

	// Stable action bag so consumers — and the context provider value built from
	// it — don't get a brand-new reference on every render.
	return useMemo(
		() => ({ addFiles, pause, resume, cancel, retry, reupload }),
		[addFiles, pause, resume, cancel, retry, reupload]
	);
}
