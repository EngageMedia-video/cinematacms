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
export const UNKNOWN_RESULT_MESSAGE =
	'This file may already be uploaded. Check your media, then retry only if it is missing.';

const MEDIA_URL_HEADER = 'X-Media-Url';
// Set by the server on the 410 of an upload whose completion failed after it may have saved a media.
const RESULT_HEADER = 'X-Upload-Result';
const RESULT_UNKNOWN = 'unknown';
const PENDING_UPLOAD_PREFIX = 'cinemata-upload:';
// As long as the server keeps an untouched upload (ORPHANED_UPLOAD_CLEANUP_HOURS, 24 by default).
export const REMEMBER_UPLOAD_MS = 24 * 60 * 60 * 1000;
const FINGERPRINT_SAMPLE_BYTES = 1024 * 1024;

class SignInRequired extends Error {}
class UploadGone extends Error {
	/** `resultUnknown`: the upload ended on the server and its media may already exist. */
	constructor(resultUnknown = false) {
		super('The upload is gone.');
		this.resultUnknown = resultUnknown;
	}
}

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

function pathOf(url) {
	try {
		return new URL(url, globalThis.location?.href ?? 'http://localhost').pathname;
	} catch {
		return url;
	}
}

function isSameFile(a, b) {
	return a === b || (a.name === b.name && a.size === b.size && a.lastModified === b.lastModified);
}

function newUploadId() {
	return globalThis.crypto?.randomUUID?.() ?? '';
}

const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** The server's id of the upload at `url`, when it has the format nginx and the application log. */
function serverUploadId(url) {
	const id = url ? pathOf(url).replace(/\/+$/, '').split('/').pop() : '';
	return UPLOAD_ID_PATTERN.test(id) ? id : null;
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
	// Whose uploads this engine remembers; another account on the same browser has its own entries.
	account = globalThis.MediaCMS?.user?.username ?? '',
	httpStack,
}) {
	const items = new Map();
	let nextId = 0;

	// The URL of an upload whose completion this browser has not seen. If the response to the
	// last byte is lost and the page reloads, the server no longer lists the upload as
	// unfinished; asking this URL returns the media it created, so the file is not sent, and
	// the media not created, a second time. The entry is dropped once the upload is seen to end.
	// The key names the same file the server lookup does, plus the account, so a renamed copy and
	// another account's copy are different uploads. It is a hash: the entry outlives the session,
	// and a file name must not stay readable on a shared machine.
	async function pendingKeyOf(item) {
		const subtle = globalThis.crypto?.subtle;
		if (!item.fingerprint || !subtle) return null;
		const mode = metadata.is_draft ? 'draft' : 'final';
		const identity = [endpoint, mode, account, item.fingerprint, item.file.name].join('\n');
		return PENDING_UPLOAD_PREFIX + toHex(await subtle.digest('SHA-256', new TextEncoder().encode(identity)));
	}

	// An entry older than the server keeps an upload points at nothing, so it is not used.
	function readPending(key) {
		try {
			const entry = JSON.parse(storage?.getItem(key));
			return entry?.url && Date.now() - entry.at < REMEMBER_UPLOAD_MS ? entry : null;
		} catch {
			return null;
		}
	}

	function pendingUrl(item) {
		return item.pendingKey ? (readPending(item.pendingKey)?.url ?? null) : null;
	}

	function setPendingUrl(item, url) {
		if (!item.pendingKey) return;
		try {
			if (url) storage?.setItem(item.pendingKey, JSON.stringify({ url, at: Date.now() }));
			else storage?.removeItem(item.pendingKey);
		} catch {
			// Without the entry a lost final response is not recovered; the upload itself is unaffected.
		}
	}

	// An upload nobody comes back to would leave its entry forever.
	function forgetStaleUploads() {
		try {
			const keys = [];
			for (let index = 0; index < (storage?.length ?? 0); index += 1) {
				const key = storage.key(index);
				if (key?.startsWith(PENDING_UPLOAD_PREFIX)) keys.push(key);
			}
			keys.filter((key) => !readPending(key)).forEach((key) => storage.removeItem(key));
		} catch {
			// Storage that cannot be listed keeps its entries; each one is still ignored once stale.
		}
	}
	forgetStaleUploads();

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

	// Two rows of one engine must never drive one upload: they would trade 409 and 423 until the
	// last byte, cancelling one would delete the other's bytes, and both would end on one media.
	// A row that has no upload URL yet may be about to get this one, so the same file counts too.
	function drivenByAnotherItem(item, uploadUrl) {
		const path = pathOf(uploadUrl);
		for (const other of items.values()) {
			if (other === item || other.status === UPLOAD_STATUS.COMPLETE) continue;
			const otherUrl = other.upload?.url;
			if (otherUrl ? pathOf(otherUrl) === path : isSameFile(other.file, item.file)) return true;
		}
		return false;
	}

	// The id sent as X-Upload-Id. Once the upload exists it is the server's id, so the log lines of
	// one upload share one id across reloads and resumes. Only the creation request, which has no
	// server id yet, carries the id minted in the browser.
	function adoptUploadIdOf(item, uploadUrl) {
		item.uuid = serverUploadId(uploadUrl) ?? item.provisionalUuid;
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
					if (status < 500) throw new UploadGone(response.getHeader(RESULT_HEADER) === RESULT_UNKNOWN);
					// Thrown, a server error goes through the retries and keeps the upload URL.
					throw new Error(`Offset check failed with status ${status}.`);
				}
			},
			onUploadUrlAvailable() {
				adoptUploadIdOf(item, item.upload?.url);
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
					item.upload = null;
					// A remembered upload the server no longer has, or one whose completion failed,
					// may have created its media. Sending the file again is the user's decision, through Retry.
					const unknown = item.recalled || cause.resultUnknown;
					setStatus(item, UPLOAD_STATUS.EXPIRED, unknown ? UNKNOWN_RESULT_MESSAGE : EXPIRED_MESSAGE);
					item.recalled = false;
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
		item.pendingKey = item.pendingKey ?? (await pendingKeyOf(item).catch(() => null));
		let uploadUrl;
		try {
			uploadUrl = await findUploadUrl(item);
		} catch {
			// The lookup needs a sign-in; Continue repeats it, so the unfinished upload is still found.
			if (!stale()) setStatus(item, UPLOAD_STATUS.AWAITING_SIGN_IN, SIGN_IN_MESSAGE);
			return;
		}
		if (stale()) return;
		// The same file selected again while its first copy is still here is sent as its own upload.
		const free = (url) => (url && !drivenByAnotherItem(item, url) ? url : null);
		const found = free(uploadUrl);
		const remembered = found ? null : free(pendingUrl(item));
		item.recalled = Boolean(remembered);
		adoptUploadIdOf(item, found ?? remembered);
		item.upload = buildUpload(item, found ?? remembered);
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
				item.provisionalUuid = item.uuid;
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
