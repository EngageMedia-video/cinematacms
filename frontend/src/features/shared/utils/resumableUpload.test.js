import fineUploaderSource from '../../../static/lib/file-uploader/5.13.0/fine-uploader.js?raw';
import {
	CHUNK_RETRY_POLICY,
	FINGERPRINT_PARAM,
	createChunkAttemptTracker,
	createResumableUploader,
	retryDelayMs,
	uploadSessionUrl,
} from './resumableUpload';

const ENDPOINT = '/fu/upload/';
const PART_SIZE = 2e6;
const TOTAL_PARTS = 7;
const FAST_RETRIES = { ...CHUNK_RETRY_POLICY, baseDelayMs: 1, maxDelayMs: 1 };
const SESSION_UUID = '3f2b8c1e-9d4a-4e6b-8a57-1c0d2e3f4a5b';

// A browser-like XMLHttpRequest whose responses come from the test's `server` function.
class FakeXhr {
	static server = () => ({ status: 200, body: { success: true } });
	static requests = [];

	constructor() {
		this.upload = {};
		this.headers = {};
		this.readyState = 0;
	}

	open(method, url) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(name, value) {
		this.headers[name] = value;
	}

	getResponseHeader() {
		return null;
	}

	send(body) {
		this.params =
			typeof body === 'string'
				? Object.fromEntries(new URLSearchParams(body))
				: Object.fromEntries([...body.entries()].filter(([, value]) => typeof value === 'string'));
		FakeXhr.requests.push(this);
		this.timer = setTimeout(() => {
			const { status, body: responseBody } = FakeXhr.server(this);
			this.readyState = 4;
			this.status = status;
			this.responseText = typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody);
			this.onreadystatechange?.();
		}, 0);
	}

	abort() {
		clearTimeout(this.timer);
		this.aborted = true;
		this.readyState = 4;
		this.status = 0;
		this.onreadystatechange?.();
	}
}

const chunkRequests = () => FakeXhr.requests.filter((request) => request.params.qqpartindex !== undefined);
const completionRequests = () => FakeXhr.requests.filter((request) => request.url.includes('done'));
const sendsOf = (part) => chunkRequests().filter((request) => Number(request.params.qqpartindex) === part).length;

function syntheticFile(size = TOTAL_PARTS * PART_SIZE) {
	const bytes = new Uint8Array(size);
	for (let index = 0; index < size; index += 4096) bytes[index] = index % 251;
	return new File([bytes], 'film.mp4', { type: 'video/mp4', lastModified: 1700000000000 });
}

// Answers chunk and completion requests; `chunkResponse` may override the reply for a chunk request.
function uploadServer(chunkResponse = () => null) {
	const answered = new Map();
	return (request) => {
		if (request.url.includes('done')) {
			return { status: 200, body: { success: true, media_url: '/view?m=abc' } };
		}
		const part = Number(request.params.qqpartindex);
		const attempt = (answered.get(part) || 0) + 1;
		answered.set(part, attempt);
		return chunkResponse(part, attempt) || { status: 200, body: { success: true } };
	};
}

function timeoutOnce(...parts) {
	return (part, attempt) =>
		parts.includes(part) && attempt === 1 ? { status: 408, body: '<html>Request Timeout</html>' } : null;
}

function jsonResponse(status, body) {
	return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
}

function noSession() {
	return vi.fn(() => jsonResponse(404, { success: false }));
}

function upload({
	concurrent = false,
	fetchImpl = noSession(),
	file = syntheticFile(),
	build = (options) =>
		createResumableUploader(window.qq.FineUploaderBasic, options, { retryPolicy: FAST_RETRIES, fetchImpl }),
	onUploadChunkSuccess,
} = {}) {
	const errors = [];
	return new Promise((resolve) => {
		const uploader = build({
			request: { endpoint: ENDPOINT, customHeaders: { 'X-CSRFToken': 'csrf-token' } },
			chunking: { concurrent: { enabled: concurrent }, success: { endpoint: `${ENDPOINT}?done` } },
			callbacks: {
				onError: (id, name, reason) => errors.push(reason),
				onUploadChunkSuccess: (id, chunkData) => onUploadChunkSuccess?.(uploader, id, chunkData),
				onComplete: (id, name, response) => resolve({ uploader, id, response, errors }),
				onCancel: () => {
					setTimeout(() => resolve({ uploader, cancelled: true, errors }), 0);
				},
			},
		});
		uploader.addFiles([file]);
	});
}

describe('createResumableUploader with the bundled Fine Uploader', () => {
	let originalXhr;

	beforeEach(() => {
		originalXhr = window.XMLHttpRequest;
		FakeXhr.requests = [];
		FakeXhr.server = uploadServer();
		window.XMLHttpRequest = FakeXhr;
		window.localStorage.clear();
		new Function(fineUploaderSource)();
	});

	afterEach(() => {
		window.XMLHttpRequest = originalXhr;
		window.localStorage.clear();
		delete window.qq;
	});

	it('fails the issue #1002 scenario with the previous file-wide retry allowance', async () => {
		FakeXhr.server = uploadServer(timeoutOnce(0, 2, 4));

		const result = await upload({
			build: (options) =>
				new window.qq.FineUploaderBasic({
					...options,
					chunking: { ...options.chunking, enabled: true, partSize: PART_SIZE },
					retry: { enableAuto: true, maxAutoAttempts: 2, autoAttemptDelay: 0 },
				}),
		});

		expect(result.response.success).toBe(false);
		expect(completionRequests()).toHaveLength(0);
	});

	it.each([
		['sequential', false],
		['concurrent', true],
	])('completes when chunks 0, 2 and 4 each time out once (%s chunks)', async (_label, concurrent) => {
		FakeXhr.server = uploadServer(timeoutOnce(0, 2, 4));

		const result = await upload({ concurrent });

		expect(result.response.success).toBe(true);
		expect(result.errors).toEqual([]);
		expect(completionRequests()).toHaveLength(1);
		for (let part = 0; part < TOTAL_PARTS; part += 1) {
			expect(sendsOf(part)).toBeGreaterThanOrEqual(1);
		}
	});

	it.each([
		['sequential', false],
		['concurrent', true],
	])('stops a chunk that keeps failing after its own retry budget (%s chunks)', async (_label, concurrent) => {
		FakeXhr.server = uploadServer((part) =>
			part === 3 ? { status: 503, body: { success: false, error: 'Service unavailable' } } : null
		);

		const result = await upload({ concurrent });

		expect(result.response.success).toBe(false);
		expect(sendsOf(3)).toBe(CHUNK_RETRY_POLICY.maxRetriesPerChunk + 1);
		expect(result.errors).toEqual(['Service unavailable']);
		expect(completionRequests()).toHaveLength(0);
	});

	it('does not retry a permanent server refusal', async () => {
		FakeXhr.server = uploadServer((part) =>
			part === 1
				? {
						status: 403,
						body: { success: false, error: 'This upload belongs to another account.', preventRetry: true },
					}
				: null
		);

		const result = await upload();

		expect(result.response.success).toBe(false);
		expect(sendsOf(1)).toBe(1);
		expect(result.errors).toEqual(['This upload belongs to another account.']);
	});

	it('resumes the server-verified upload without sending its accepted parts again', async () => {
		const fetchImpl = vi.fn(() =>
			jsonResponse(200, { success: true, uuid: SESSION_UUID, total_parts: TOTAL_PARTS, parts: [0, 1, 2, 4] })
		);

		const result = await upload({ fetchImpl });

		expect(result.response.success).toBe(true);
		const [lookupUrl, lookupInit] = fetchImpl.mock.calls[0];
		const query = new URL(lookupUrl, 'https://cinemata.test').searchParams;
		expect(lookupUrl.startsWith(`${ENDPOINT}session/?`)).toBe(true);
		expect(lookupInit.credentials).toBe('same-origin');
		expect(Object.fromEntries(query)).toEqual({
			filename: 'film.mp4',
			total_size: String(TOTAL_PARTS * PART_SIZE),
			part_size: String(PART_SIZE),
			fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
		});
		expect(chunkRequests().map((request) => Number(request.params.qqpartindex))).toEqual([3, 5, 6]);
		for (const request of FakeXhr.requests) {
			expect(request.params.qquuid).toBe(SESSION_UUID);
		}
		for (const request of chunkRequests()) {
			expect(request.params[FINGERPRINT_PARAM]).toBe(query.get('fingerprint'));
		}
		expect(result.uploader.getUuid(result.id)).toBe(SESSION_UUID);
	});

	it('goes straight to completion when the server already holds every part', async () => {
		const fetchImpl = vi.fn(() =>
			jsonResponse(200, {
				success: true,
				uuid: SESSION_UUID,
				total_parts: TOTAL_PARTS,
				parts: [0, 1, 2, 3, 4, 5, 6],
			})
		);

		const result = await upload({ fetchImpl });

		expect(result.response.success).toBe(true);
		expect(chunkRequests()).toHaveLength(0);
		expect(completionRequests().map((request) => request.params.qquuid)).toEqual([SESSION_UUID]);
	});

	it.each([
		['the server has no matching upload', () => jsonResponse(404, { success: false })],
		['the lookup fails', () => Promise.reject(new TypeError('Failed to fetch'))],
		[
			'the server reports a different layout',
			() => jsonResponse(200, { success: true, uuid: SESSION_UUID, total_parts: 3, parts: [0, 1] }),
		],
	])('drops the saved progress and sends the whole file when %s', async (_label, lookup) => {
		const staleKey = `qqtraditionalresume5.0-film.mp4-${TOTAL_PARTS * PART_SIZE}-${PART_SIZE}-${ENDPOINT}`;
		window.localStorage.setItem(
			staleKey,
			JSON.stringify({
				name: 'film.mp4',
				size: TOTAL_PARTS * PART_SIZE,
				uuid: SESSION_UUID,
				chunking: { enabled: true, parts: TOTAL_PARTS, remaining: [6], inProgress: [] },
				loaded: 6 * PART_SIZE,
				lastUpdated: Date.now(),
			})
		);

		const result = await upload({ fetchImpl: vi.fn(lookup) });

		expect(result.response.success).toBe(true);
		expect(chunkRequests()).toHaveLength(TOTAL_PARTS);
		expect(result.uploader.getUuid(result.id)).not.toBe(SESSION_UUID);
		expect(window.localStorage.getItem(staleKey)).toBeNull();
	});

	it('deletes the server session when an upload is cancelled', async () => {
		const fetchImpl = noSession();

		const result = await upload({
			fetchImpl,
			onUploadChunkSuccess: (uploader, id, chunkData) => {
				if (chunkData.partIndex === 1) setTimeout(() => uploader.cancel(id), 0);
			},
		});

		expect(result.cancelled).toBe(true);
		const uuid = result.uploader.getUuid(0);
		expect(fetchImpl).toHaveBeenCalledWith(`${ENDPOINT}session/${uuid}/`, {
			method: 'DELETE',
			credentials: 'same-origin',
			headers: { 'X-CSRFToken': 'csrf-token' },
		});
	});

	it('does not look up or resume a file small enough for one request', async () => {
		const fetchImpl = noSession();

		const result = await upload({ fetchImpl, file: syntheticFile(1000) });

		expect(result.response.success).toBe(true);
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(FakeXhr.requests).toHaveLength(1);
	});
});

describe('retryDelayMs', () => {
	it.each([
		[1, 1000],
		[2, 2000],
		[3, 4000],
		[5, 16000],
		[6, 30000],
	])('waits longer after each failure of the same chunk (failure %i -> %i ms)', (failures, delay) => {
		expect(retryDelayMs(failures)).toBe(delay);
	});
});

describe('createChunkAttemptTracker', () => {
	const policy = { maxRetriesPerChunk: 2 };

	it.each([
		{
			name: 'failures on different chunks each use their own budget',
			steps: [
				['sent', 0],
				['fail', { allowed: true, failures: 1 }],
				['sent', 0],
				['accepted', 0],
				['sent', 1],
				['fail', { allowed: true, failures: 1 }],
				['sent', 1],
				['accepted', 1],
				['sent', 2],
				['fail', { allowed: true, failures: 1 }],
			],
		},
		{
			name: 'a chunk that fails past its budget is refused',
			steps: [
				['sent', 4],
				['fail', { allowed: true, failures: 1 }],
				['sent', 4],
				['fail', { allowed: true, failures: 2 }],
				['sent', 4],
				['fail', { allowed: false, failures: 3 }],
			],
		},
		{
			name: 'every chunk in flight at a failure is charged',
			steps: [
				['sent', 0],
				['sent', 1],
				['fail', { allowed: true, failures: 1 }],
				['sent', 1],
				['fail', { allowed: true, failures: 2 }],
			],
		},
		{
			name: 'a pause is not a failure',
			steps: [
				['sent', 0],
				['pause'],
				['fail', { allowed: true, failures: 1 }],
				['sent', 0],
				['fail', { allowed: true, failures: 1 }],
			],
		},
		{
			name: 'a manual retry restores the budget',
			steps: [
				['sent', 0],
				['fail', { allowed: true, failures: 1 }],
				['sent', 0],
				['fail', { allowed: true, failures: 2 }],
				['reset'],
				['sent', 0],
				['fail', { allowed: true, failures: 1 }],
			],
		},
	])('$name', ({ steps }) => {
		const tracker = createChunkAttemptTracker(policy);
		for (const [action, value] of steps) {
			if (action === 'sent') tracker.sent('file', value);
			if (action === 'accepted') tracker.accepted('file', value);
			if (action === 'pause') tracker.interrupted('file');
			if (action === 'reset') tracker.reset('file');
			if (action === 'fail') expect(tracker.recordFailure('file')).toEqual(value);
		}
	});
});

describe('uploadSessionUrl', () => {
	it.each([
		['/fu/upload/', '/fu/upload/session/'],
		['/fu/upload/update/abc/', '/fu/upload/update/abc/session/'],
		['/fu/upload', '/fu/upload/session/'],
	])('derives the session endpoint from %s', (endpoint, expected) => {
		expect(uploadSessionUrl(endpoint)).toBe(expected);
	});
});
