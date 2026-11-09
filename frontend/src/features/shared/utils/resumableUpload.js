// Shared retry and resume contract for the Fine Uploader 5.13 upload flows.
//
// Retries: Fine Uploader counts automatic retries per file, so a few separated
// network blips can fail a long upload. Here every chunk has its own retry budget
// and each retry waits longer than the last.
//
// Resume: before a file is added, the server is asked for the caller's unfinished
// upload of the same file (name, size, part size and a content fingerprint). The
// parts it reports, verified on disk, are written into Fine Uploader's own resume
// record, so only the missing parts are sent. Without a server match the stale
// record is dropped and the file uploads from the start.

export const UPLOAD_PART_SIZE = 2e6;

export const CHUNK_RETRY_POLICY = Object.freeze({
	maxRetriesPerChunk: 5,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
});

export const FINGERPRINT_PARAM = 'qqfingerprint';

// Matches the server's retention (ORPHANED_UPLOAD_CLEANUP_HOURS), after which resuming is impossible.
const RESUME_RECORD_DAYS = 1;
const FINGERPRINT_SAMPLE_BYTES = 1024 * 1024;
// A failure while no chunk is in flight belongs to the whole request: a small file or the chunks-done call.
const WHOLE_REQUEST = -1;

export function retryDelayMs(failures, policy = CHUNK_RETRY_POLICY) {
	return Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** Math.max(0, failures - 1));
}

/**
 * Counts, per file and per chunk, the sends that ended without the server accepting the chunk.
 * A failed request aborts the file's other in-flight chunks, and they are sent again too, so
 * every chunk in flight at a failure is charged.
 */
export function createChunkAttemptTracker(policy = CHUNK_RETRY_POLICY) {
	const files = new Map();

	function stateFor(id) {
		if (!files.has(id)) files.set(id, { inFlight: new Set(), failures: new Map() });
		return files.get(id);
	}

	return {
		sent(id, partIndex) {
			stateFor(id).inFlight.add(partIndex);
		},
		accepted(id, partIndex) {
			stateFor(id).inFlight.delete(partIndex);
		},
		// A pause aborts the chunks in flight without any of them failing.
		interrupted(id) {
			stateFor(id).inFlight.clear();
		},
		reset(id) {
			files.delete(id);
		},
		recordFailure(id) {
			const state = stateFor(id);
			const charged = state.inFlight.size ? [...state.inFlight] : [WHOLE_REQUEST];
			let failures = 0;
			for (const part of charged) {
				const count = (state.failures.get(part) || 0) + 1;
				state.failures.set(part, count);
				failures = Math.max(failures, count);
			}
			state.inFlight.clear();
			return { allowed: failures <= policy.maxRetriesPerChunk, failures };
		},
	};
}

export function uploadSessionUrl(uploadEndpoint) {
	return `${uploadEndpoint.replace(/\/?$/, '/')}session/`;
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

// Fine Uploader 5.13's localStorage key for a traditional-endpoint resume record (_getLocalStorageId).
function resumeRecordKey(name, size, partSize, endpoint) {
	return `qqtraditionalresume5.0-${name}-${size}-${partSize}-${endpoint}`;
}

function readStorage() {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

function writeResumeRecord(key, file, session, partSize) {
	const storage = readStorage();
	if (!storage) return;
	const accepted = new Set(session.parts);
	const remaining = [];
	let loaded = 0;
	for (let index = 0; index < session.total_parts; index += 1) {
		if (accepted.has(index)) {
			loaded += Math.min(partSize, file.size - index * partSize);
		} else {
			remaining.push(index);
		}
	}
	const record = {
		name: file.name,
		size: file.size,
		uuid: session.uuid,
		chunking: { enabled: true, parts: session.total_parts, remaining, inProgress: [] },
		loaded,
		lastUpdated: Date.now(),
	};
	try {
		storage.setItem(key, JSON.stringify(record));
	} catch {
		// Without a record the file uploads from the start.
	}
}

function removeResumeRecord(key) {
	try {
		readStorage()?.removeItem(key);
	} catch {
		// nothing to remove
	}
}

async function lookUpSession({ sessionUrl, file, fingerprint, partSize, fetchImpl }) {
	const query = new URLSearchParams({
		filename: file.name,
		total_size: String(file.size),
		part_size: String(partSize),
		fingerprint,
	});
	const response = await fetchImpl(`${sessionUrl}?${query}`, {
		credentials: 'same-origin',
		headers: { Accept: 'application/json' },
	});
	if (!response.ok) return null;
	const session = await response.json();
	const expectedParts = Math.ceil(file.size / partSize);
	if (!session?.uuid || session.total_parts !== expectedParts || !Array.isArray(session.parts)) return null;
	return session;
}

function filesFrom(data) {
	if (data instanceof File) return [data];
	if (Array.isArray(data)) return data.every((item) => item instanceof File) ? data : null;
	if (typeof FileList !== 'undefined' && data instanceof FileList) return Array.from(data);
	return null;
}

/**
 * Builds a Fine Uploader (FineUploader or FineUploaderBasic) with the shared retry and resume
 * contract. Options and callbacks are the caller's; retry, resume and part size are set here.
 */
export function createResumableUploader(Uploader, options, settings = {}) {
	const endpoint = options.request.endpoint;
	const {
		retryPolicy = CHUNK_RETRY_POLICY,
		partSize = UPLOAD_PART_SIZE,
		fetchImpl = (...args) => globalThis.fetch(...args),
	} = settings;
	const sessionUrl = uploadSessionUrl(endpoint);
	const baseParams = options.request.params || {};
	const callbacks = options.callbacks || {};
	const tracker = createChunkAttemptTracker(retryPolicy);
	const fingerprints = new WeakMap();
	const retryScheduled = new Set();
	let uploader;

	const call = (name, self, args) => callbacks[name]?.apply(self, args);

	uploader = new Uploader({
		...options,
		retry: {
			// Fine Uploader UI's default note prints maxAutoAttempts, which is unbounded here.
			autoRetryNote: 'Retrying...',
			...options.retry,
			enableAuto: true,
			// The per-chunk budget below decides; the file-wide counter must never stop a retry first.
			maxAutoAttempts: Number.MAX_SAFE_INTEGER,
			autoAttemptDelay: retryPolicy.baseDelayMs / 1000,
		},
		chunking: { ...options.chunking, enabled: true, partSize },
		resume: { ...options.resume, enabled: true, recordsExpireIn: RESUME_RECORD_DAYS },
		callbacks: {
			...callbacks,
			onSubmitted(id, ...rest) {
				const fingerprint = fingerprints.get(uploader.getFile?.(id));
				if (fingerprint) uploader.setParams({ ...baseParams, [FINGERPRINT_PARAM]: fingerprint }, id);
				return call('onSubmitted', this, [id, ...rest]);
			},
			onUploadChunk(id, name, chunkData) {
				tracker.sent(id, chunkData.partIndex);
				return call('onUploadChunk', this, [id, name, chunkData]);
			},
			onUploadChunkSuccess(id, chunkData, ...rest) {
				tracker.accepted(id, chunkData.partIndex);
				return call('onUploadChunkSuccess', this, [id, chunkData, ...rest]);
			},
			onStatusChange(id, oldStatus, newStatus) {
				if (newStatus === 'paused') tracker.interrupted(id);
				return call('onStatusChange', this, [id, oldStatus, newStatus]);
			},
			// Fine Uploader reports a failure it will retry before retrying it; only a final failure reaches the caller.
			onError(id, ...rest) {
				if (retryScheduled.has(id)) return undefined;
				return call('onError', this, [id, ...rest]);
			},
			onAutoRetry(id, ...rest) {
				retryScheduled.delete(id);
				return call('onAutoRetry', this, [id, ...rest]);
			},
			onManualRetry(id, ...rest) {
				const allowed = call('onManualRetry', this, [id, ...rest]);
				if (allowed !== false) tracker.reset(id);
				return allowed;
			},
			onCancel(id, ...rest) {
				const allowed = call('onCancel', this, [id, ...rest]);
				if (allowed !== false) {
					tracker.reset(id);
					if (uploader.getSize?.(id) > partSize) {
						const csrfToken = options.request.customHeaders?.['X-CSRFToken'];
						fetchImpl(`${sessionUrl}${uploader.getUuid(id)}/`, {
							method: 'DELETE',
							credentials: 'same-origin',
							headers: csrfToken ? { 'X-CSRFToken': csrfToken } : {},
						}).catch(() => {});
					}
				}
				return allowed;
			},
			onComplete(id, ...rest) {
				tracker.reset(id);
				return call('onComplete', this, [id, ...rest]);
			},
		},
	});

	// Fine Uploader 5.13 caps automatic retries per file in this private method; it is the only
	// place a retry can be refused, so the per-chunk budget and backoff are applied here.
	const shouldAutoRetry = uploader._shouldAutoRetry;
	if (typeof shouldAutoRetry === 'function') {
		uploader._shouldAutoRetry = function (id, ...rest) {
			const { allowed, failures } = tracker.recordFailure(id);
			if (!allowed) return false;
			this._options.retry.autoAttemptDelay = retryDelayMs(failures, retryPolicy) / 1000;
			const retrying = shouldAutoRetry.call(this, id, ...rest);
			if (retrying) retryScheduled.add(id);
			return retrying;
		};
	}

	// Fine Uploader reads a file's resume record while adding it, so the server's answer has to be
	// in place first. Its own button and drop zone call addFiles too, so they are covered as well.
	const addFiles = uploader.addFiles;
	if (typeof addFiles === 'function') {
		uploader.addFiles = function (data, ...rest) {
			const files = filesFrom(data);
			if (!files) return addFiles.call(this, data, ...rest);
			Promise.all(files.map((file) => prepareResume(file)))
				.catch(() => {})
				.then(() => addFiles.call(this, files, ...rest));
			return undefined;
		};
	}

	async function prepareResume(file) {
		const key = resumeRecordKey(file.name, file.size, partSize, endpoint);
		if (file.size <= partSize) return;
		try {
			const fingerprint = await fileFingerprint(file);
			if (fingerprint) fingerprints.set(file, fingerprint);
			const session = fingerprint
				? await lookUpSession({ sessionUrl, file, fingerprint, partSize, fetchImpl })
				: null;
			if (session) {
				writeResumeRecord(key, file, session, partSize);
			} else {
				removeResumeRecord(key);
			}
		} catch {
			// An unverified record could skip parts the server lacks, so start over instead.
			removeResumeRecord(key);
		}
	}

	return uploader;
}
