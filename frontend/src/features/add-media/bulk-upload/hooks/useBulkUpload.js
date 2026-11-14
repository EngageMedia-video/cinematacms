import { useCallback, useEffect, useMemo, useRef } from 'react';
import useBulkUploadStore, { UPLOAD_STATUS } from '../useBulkUploadStore';
import { useBulkUploadConfig } from '../bulkUploadConfig';
import { apiFetch, getCSRFToken, parseFriendlyToken } from '../../../shared/utils/api';
import { UPLOAD_STATUS as TRANSFER_STATUS, createTusUploader } from '../../../shared/utils/tusUpload';

/**
 * Drives N concurrent tus uploads and mirrors each file's progress/status into
 * the Zustand store. Retries and resume follow the shared upload engine
 * (shared/utils/tusUpload): transient failures retry automatically, and after a
 * page reload, selecting the same file again resumes from the bytes the server
 * already holds.
 */
export function useBulkUpload() {
	const config = useBulkUploadConfig();
	const uploaderRef = useRef(null);
	const filesByIdRef = useRef(new Map());
	const pausingBeforeLeaveRef = useRef(false);

	const addFile = useBulkUploadStore((state) => state.addFile);
	const updateFile = useBulkUploadStore((state) => state.updateFile);
	const removeFile = useBulkUploadStore((state) => state.removeFile);
	const setLastError = useBulkUploadStore((state) => state.setLastError);

	useEffect(() => {
		let disposing = false;
		const uploader = createTusUploader({
			endpoint: config.uploadEndpoint,
			getHeaders: () => ({ 'X-CSRFToken': getCSRFToken() ?? '' }),
			// Mark every bulk upload as a private draft on creation; the server
			// keeps it out of the admin review queue until the user submits.
			metadata: { is_draft: '1' },
			validation: {
				itemLimit: config.maxFiles,
				sizeLimit: config.maxSizeBytes || undefined,
				allowedExtensions: config.allowedExtensions || [],
			},
			callbacks: {
				onSubmitted(id, name) {
					window.CinemataAnalytics?.uploadEvent('start', id);
					filesByIdRef.current.set(id, uploader.getFile(id));
					addFile({ id, name, sizeBytes: uploader.getSize(id) });
					setLastError(null);
				},
				onProgress(id, name, uploadedBytes, totalBytes) {
					const progress = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
					// Once all bytes are sent the server is creating the media; show
					// "Processing..." (like single-upload) instead of a full progress bar
					// until onComplete fires.
					updateFile(id, {
						progress,
						uploadStatus: progress >= 100 ? UPLOAD_STATUS.PROCESSING : UPLOAD_STATUS.UPLOADING,
					});
				},
				onComplete(id, name, response) {
					if (response?.media_url) {
						window.CinemataAnalytics?.uploadEvent('complete', id);
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
						window.CinemataAnalytics?.uploadEvent('error', id);
						updateFile(id, { uploadStatus: UPLOAD_STATUS.FAILED, error: 'Upload failed.' });
					}
				},
				onError(id, name, errorReason) {
					window.CinemataAnalytics?.uploadEvent('error', id);
					if (id === null || id === undefined) {
						setLastError(errorReason || 'Upload error.');
						return;
					}
					updateFile(id, { uploadStatus: UPLOAD_STATUS.FAILED, error: errorReason || 'Upload failed.' });
				},
				onCancel(id) {
					if (!disposing) window.CinemataAnalytics?.uploadEvent('cancel', id);
					removeFile(id);
					filesByIdRef.current.delete(id);
					return true;
				},
				onStatusChange(id, status, message) {
					if (status === TRANSFER_STATUS.PAUSED) {
						if (!pausingBeforeLeaveRef.current) window.CinemataAnalytics?.uploadEvent('pause', id);
						updateFile(id, { uploadStatus: UPLOAD_STATUS.PAUSED, error: null });
					} else if (status === TRANSFER_STATUS.AWAITING_SIGN_IN) {
						// Signing in again and pressing Continue resumes from the server's offset.
						updateFile(id, { uploadStatus: UPLOAD_STATUS.PAUSED, error: message });
					} else if (status === TRANSFER_STATUS.EXPIRED) {
						updateFile(id, { uploadStatus: UPLOAD_STATUS.FAILED, error: message });
					}
				},
			},
		});

		uploaderRef.current = uploader;

		// The engine counts every file it holds against the item limit. A row can leave the
		// store without the engine hearing of it (a deleted media, a partial submit, a reset),
		// so release the engine's file whenever its row is gone.
		const releaseRemovedRows = (state) => {
			const rowIds = new Set(state.files.map((file) => file.id));
			for (const id of [...filesByIdRef.current.keys()]) {
				if (!rowIds.has(id)) {
					filesByIdRef.current.delete(id);
					uploader.remove(id);
				}
			}
		};
		const stopReleasing = useBulkUploadStore.subscribe(releaseRemovedRows);

		return () => {
			stopReleasing();
			disposing = true;
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

	// Leaving stops the transfers anyway. Pausing them first lets them continue if the
	// page stays. The user did not pause them, so no pause event is tracked.
	const pauseBeforeLeave = useCallback(() => {
		pausingBeforeLeaveRef.current = true;
		useBulkUploadStore
			.getState()
			.files.filter((file) => [UPLOAD_STATUS.UPLOADING, UPLOAD_STATUS.PROCESSING].includes(file.uploadStatus))
			.forEach((file) => uploaderRef.current?.pauseUpload(file.id));
		pausingBeforeLeaveRef.current = false;
	}, []);

	const resume = useCallback(
		(id) => {
			if (uploaderRef.current?.continueUpload(id)) {
				window.CinemataAnalytics?.uploadEvent('resume', id);
				updateFile(id, { uploadStatus: UPLOAD_STATUS.UPLOADING, error: null });
			}
		},
		[updateFile]
	);

	const cancel = useCallback(
		(id) => {
			// Abort the in-flight/queued upload, then drop the row unconditionally;
			// guard it so a throw can't stop us from clearing the row (removeFile is
			// idempotent).
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
			// The retry continues from the bytes the server holds, so the progress stays.
			updateFile(id, { uploadStatus: UPLOAD_STATUS.UPLOADING, error: null });
			if (uploaderRef.current?.retry(id)) window.CinemataAnalytics?.uploadEvent('retry', id);
		},
		[updateFile]
	);

	const reupload = useCallback(
		(id) => {
			const file = filesByIdRef.current.get(id);
			// Removing the row releases the engine's file, so the replacement fits the item limit.
			removeFile(id);
			if (file && uploaderRef.current) {
				uploaderRef.current.addFiles([file]);
			}
		},
		[removeFile]
	);

	// Stable action bag so consumers — and the context provider value built from
	// it — don't get a brand-new reference on every render.
	return useMemo(
		() => ({ addFiles, pause, pauseBeforeLeave, resume, cancel, retry, reupload }),
		[addFiles, pause, pauseBeforeLeave, resume, cancel, retry, reupload]
	);
}
