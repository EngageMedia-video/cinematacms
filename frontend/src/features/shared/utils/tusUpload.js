// Shared upload engine for the single, bulk and file-replacement flows, built on tus-js-client.
//
// The server's offset is the authority: every start, retry and resume asks the server how many
// bytes it holds (HEAD) and continues from there. Before a file is sent, the server is asked for
// the caller's unfinished upload of the same file (name, size and a content fingerprint), so
// selecting the file again after a reload, or after signing in again, continues that upload.
// The browser also remembers the URL of an upload until it sees that upload end, which recovers
// the media of an upload whose final response was lost.

// The package's default entry is its Node build, which cannot read a browser File.
import { DetailedError, Upload } from 'tus-js-client/lib.esm/browser/index.js';
import { formatBytes } from './formatBytes';
import { UPLOAD_ID_HEADER } from './uploadId';

// nginx hands a request to the application only once its body is complete, so an interrupted
// request stores nothing. The chunk size bounds how much one interruption can cost.
export const UPLOAD_CHUNK_SIZE = 8 * 1024 * 1024;

// Waits between automatic retries. tus-js-client starts the list again whenever a retry makes progress.
export const RETRY_DELAYS_MS = Object.freeze([1000, 2000, 4000, 8000, 16000, 30000]);

export const UPLOAD_STATUS = Object.freeze({
	UPLOADING: 'uploading',
	PAUSED: 'paused',
	AWAITING_SIGN_IN: 'awaiting-sign-in',
	EXPIRED: 'expired',
	FAILED: 'failed',
	COMPLETE: 'complete',
});

export const SIGN_IN_MESSAGE = 'Your session ended. Sign in again in another tab, then continue this upload.';
export const EXPIRED_MESSAGE = 'This upload expired. Retry to send the file again.';

const MEDIA_URL_HEADER = 'X-Media-Url';
const PENDING_UPLOAD_PREFIX = 'cinemata-upload:';
const FINGERPRINT_SAMPLE_BYTES = 1024 * 1024;

class SignInRequired extends Error {}
class UploadGone extends Error {}

function toHex(buffer) {
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 of the file's size, modification time, first and last MiB; null when Web Crypto is unavailable. */
export async function fileFingerprint(file) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle || typeof file?.slice !== 'function') return null;
	const head = file.slice(0, FINGERPRINT_SAMPLE_BYTES);
	const tail = file.slice(Math.max(FINGERPRINT_SAMPLE_BYTES, file.size - FINGERPRINT_SAMPLE_BYTES));
	const prefix = new TextEncoder().encode(`${file.size}:${file.lastModified || 0}:`);
	const parts = [prefix, new Uint8Array(await head.arrayBuffer()), new Uint8Array(await tail.arrayBuffer())];
	const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		bytes.set(part, offset);
		offset += part.length;
	}
	return toHex(await subtle.digest('SHA-256', bytes));
}

function browserStorage() {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

function newUploadId() {
	return globalThis.crypto?.randomUUID?.() ?? '';
}

function extensionOf(name) {
	const dot = name.lastIndexOf('.');
	return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function serverMessage(error) {
	try {
		return JSON.parse(error?.originalResponse?.getBody() || '{}').error || '';
	} catch {
		return '';
	}
}

/**
 * Creates the upload engine for one page.
 *
 * `callbacks` (all optional): onSubmitted(id, name), onProgress(id, name, sentBytes, totalBytes),
 * onStatusChange(id, status, message), onComplete(id, name, { media_url }), onError(id, name, message)
 * and onCancel(id). `onError` runs once an upload has failed for good, and with a null id when a
 * selected file is refused. `getHeaders` is read before every request, so a CSRF token issued by a
 * new sign-in is picked up.
 */
export function createTusUploader({
	endpoint,
	getHeaders = () => ({}),
	metadata = {},
	validation = {},
	messages = {},
	callbacks = {},
	chunkSize = UPLOAD_CHUNK_SIZE,
	retryDelays = RETRY_DELAYS_MS,
	fetchImpl = (...args) => globalThis.fetch(...args),
	storage = browserStorage(),
	httpStack,
}) {
	const items = new Map();
	let nextId = 0;

	// The URL of an upload whose completion this browser has not seen. If the response to the
	// last byte is lost and the page reloads, the server no longer lists the upload as
	// unfinished; asking this URL returns the media it created, so the file is not sent, and
	// the media not created, a second time. The entry is dropped once the upload is seen to end.
	// The key names the same file the server lookup does, so a renamed copy is a different upload.
	const pendingKey = (item) =>
		`${PENDING_UPLOAD_PREFIX}${endpoint}:${metadata.is_draft ? 'draft' : 'final'}:${item.fingerprint}:${item.file.name}`;

	function pendingUrl(item) {
		if (!item.fingerprint) return null;
		try {
			return storage?.getItem(pendingKey(item)) || null;
		} catch {
			return null;
		}
	}

	function setPendingUrl(item, url) {
		if (!item.fingerprint) return;
		try {
			if (url) storage?.setItem(pendingKey(item), url);
			else storage?.removeItem(pendingKey(item));
		} catch {
			// Without the entry a lost final response is not recovered; the upload itself is unaffected.
		}
	}

	const notify = (name, ...args) => callbacks[name]?.(...args);

	function setStatus(item, status, message = '') {
		item.status = status;
		notify('onStatusChange', item.id, status, message);
	}

	function refusal(file) {
		const { allowedExtensions = [], sizeLimit, itemLimit } = validation;
		if (itemLimit && items.size >= itemLimit) {
			return (
				messages.tooManyItems?.(items.size + 1, itemLimit) ??
				`Too many items (${items.size + 1}) would be uploaded. Item limit is ${itemLimit}.`
			);
		}
		if (allowedExtensions.length && !allowedExtensions.includes(extensionOf(file.name))) {
			return `${file.name} has an invalid extension. Valid extension(s): ${allowedExtensions.join(', ')}.`;
		}
		if (file.size === 0) return `${file.name} is empty, please select files again without it.`;
		if (sizeLimit && file.size > sizeLimit) {
			return `${file.name} is too large, maximum file size is ${formatBytes(sizeLimit)}.`;
		}
		return '';
	}

	async function findUploadUrl(item) {
		if (!item.fingerprint) return null;
		const query = new URLSearchParams({
			filename: item.file.name,
			total_size: String(item.file.size),
			fingerprint: item.fingerprint,
			// A draft (bulk) upload and a non-draft (single) upload of one file are different uploads.
			...(metadata.is_draft ? { is_draft: metadata.is_draft } : {}),
		});
		let response;
		try {
			response = await fetchImpl(`${endpoint}?${query}`, {
				credentials: 'same-origin',
				headers: { Accept: 'application/json' },
			});
		} catch {
			// Without an answer the file uploads from the start.
			return null;
		}
		// Starting a new upload now would abandon the bytes the server holds for this file.
		if (response.status === 401) throw new SignInRequired();
		if (!response.ok) return null;
		try {
			const found = (await response.json())?.uploads?.[0];
			return found?.url ? new URL(found.url, globalThis.location?.href).toString() : null;
		} catch {
			return null;
		}
	}

	function buildUpload(item, uploadUrl) {
		return new Upload(item.file, {
			endpoint,
			uploadUrl,
			chunkSize,
			retryDelays: [...retryDelays],
			// The engine does its own lookup and bookkeeping (findUploadUrl, pendingUrl).
			storeFingerprintForResuming: false,
			metadata: {
				...metadata,
				filename: item.file.name,
				...(item.fingerprint ? { fingerprint: item.fingerprint } : {}),
			},
			...(httpStack ? { httpStack } : {}),
			onBeforeRequest(request) {
				const headers = { ...getHeaders(), ...(item.uuid ? { [UPLOAD_ID_HEADER]: item.uuid } : {}) };
				Object.entries(headers).forEach(([name, value]) => request.setHeader(name, value));
			},
			onAfterResponse(request, response) {
				const status = response.getStatus();
				const mediaUrl = response.getHeader(MEDIA_URL_HEADER);
				if (mediaUrl) item.mediaUrl = mediaUrl;
				if (status === 401) throw new SignInRequired();
				// tus-js-client answers any failed HEAD except 423 by silently creating a new upload,
				// which would send the whole file again and could create a second media.
				if (request.getMethod() === 'HEAD' && status >= 400 && status !== 423) {
					if (status < 500) throw new UploadGone();
					// Thrown, a server error goes through the retries and keeps the upload URL.
					throw new Error(`Offset check failed with status ${status}.`);
				}
			},
			onUploadUrlAvailable() {
				setPendingUrl(item, item.upload?.url);
			},
			onShouldRetry(error) {
				if (error.causingError instanceof SignInRequired || error.causingError instanceof UploadGone) {
					return false;
				}
				const status = error.originalResponse ? error.originalResponse.getStatus() : 0;
				const retryable = status < 400 || status >= 500 || status === 409 || status === 423;
				return retryable && globalThis.navigator?.onLine !== false;
			},
			onProgress(sentBytes, totalBytes) {
				notify('onProgress', item.id, item.file.name, sentBytes, totalBytes);
			},
			onSuccess() {
				setPendingUrl(item, null);
				setStatus(item, UPLOAD_STATUS.COMPLETE);
				notify('onComplete', item.id, item.file.name, { media_url: item.mediaUrl || '' });
			},
			onError(error) {
				const cause = error instanceof DetailedError ? error.causingError : null;
				if (cause instanceof SignInRequired) {
					setStatus(item, UPLOAD_STATUS.AWAITING_SIGN_IN, SIGN_IN_MESSAGE);
				} else if (cause instanceof UploadGone) {
					setPendingUrl(item, null);
					if (item.recalled) {
						// Only this browser remembered the upload and the server no longer has it,
						// so nothing can be continued or duplicated: send the file as a new upload.
						item.recalled = false;
						item.upload = buildUpload(item, null);
						item.upload.start();
						return;
					}
					item.upload = null;
					setStatus(item, UPLOAD_STATUS.EXPIRED, EXPIRED_MESSAGE);
				} else {
					const message = serverMessage(error) || 'Upload failed.';
					setStatus(item, UPLOAD_STATUS.FAILED, message);
					notify('onError', item.id, item.file.name, message);
				}
			},
		});
	}

	async function begin(item) {
		// Cancelling, pausing, or beginning again while the fingerprint and the lookup run makes
		// this start stale, so a file never ends up with two transfers.
		const token = {};
		item.startToken = token;
		const stale = () =>
			items.get(item.id) !== item || item.startToken !== token || item.status !== UPLOAD_STATUS.UPLOADING;

		item.fingerprint = item.fingerprint ?? (await fileFingerprint(item.file).catch(() => null));
		let uploadUrl;
		try {
			uploadUrl = await findUploadUrl(item);
		} catch {
			// The lookup needs a sign-in; Continue repeats it, so the unfinished upload is still found.
			if (!stale()) setStatus(item, UPLOAD_STATUS.AWAITING_SIGN_IN, SIGN_IN_MESSAGE);
			return;
		}
		if (stale()) return;
		const remembered = uploadUrl ? null : pendingUrl(item);
		item.recalled = Boolean(remembered);
		item.upload = buildUpload(item, uploadUrl ?? remembered);
		item.upload.start();
	}

	function discard(item) {
		items.delete(item.id);
		item.startToken = null;
		if (item.status !== UPLOAD_STATUS.COMPLETE) setPendingUrl(item, null);
		if (item.upload && item.status !== UPLOAD_STATUS.COMPLETE) {
			// Terminating deletes the bytes the server holds for the unfinished upload.
			item.upload.abort(true).catch(() => {});
		}
	}

	return {
		addFiles(fileList) {
			for (const file of Array.from(fileList || [])) {
				const message = refusal(file);
				if (message) {
					notify('onError', null, file.name, message);
					continue;
				}
				const item = { id: nextId++, uuid: newUploadId(), file, status: UPLOAD_STATUS.UPLOADING };
				items.set(item.id, item);
				notify('onSubmitted', item.id, file.name);
				begin(item);
			}
		},
		pauseUpload(id) {
			const item = items.get(id);
			if (item?.status !== UPLOAD_STATUS.UPLOADING) return false;
			item.startToken = null;
			item.upload?.abort();
			setStatus(item, UPLOAD_STATUS.PAUSED);
			return true;
		},
		/** Continues a paused upload, or one waiting for the user to sign in again. */
		continueUpload(id) {
			const item = items.get(id);
			if (![UPLOAD_STATUS.PAUSED, UPLOAD_STATUS.AWAITING_SIGN_IN].includes(item?.status)) return false;
			setStatus(item, UPLOAD_STATUS.UPLOADING);
			if (item.upload) item.upload.start();
			else begin(item);
			return true;
		},
		/** Retries a failed upload from the server's offset, or sends an expired one again. */
		retry(id) {
			const item = items.get(id);
			if (![UPLOAD_STATUS.FAILED, UPLOAD_STATUS.EXPIRED].includes(item?.status)) return false;
			setStatus(item, UPLOAD_STATUS.UPLOADING);
			if (item.upload) item.upload.start();
			else begin(item);
			return true;
		},
		cancel(id) {
			const item = items.get(id);
			if (!item) return;
			discard(item);
			notify('onCancel', id);
		},
		/** Forgets one file without calling onCancel, so it no longer counts against the item limit. */
		remove(id) {
			const item = items.get(id);
			if (item) discard(item);
		},
		cancelAll() {
			[...items.keys()].forEach((id) => this.cancel(id));
		},
		/** Forgets every file without calling onCancel; unfinished uploads are deleted on the server. */
		reset() {
			[...items.values()].forEach(discard);
		},
		getFile: (id) => items.get(id)?.file,
		getSize: (id) => items.get(id)?.file.size,
		getUuid: (id) => items.get(id)?.uuid,
	};
}
