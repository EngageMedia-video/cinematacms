import { EXPIRED_MESSAGE, SIGN_IN_MESSAGE, UPLOAD_STATUS, createTusUploader, fileFingerprint } from './tusUpload';

const ENDPOINT = '/fu/tus/';
const CONTENT = 'abcdefghijklmnopqrstuvwxyz'; // 26 bytes, sent in chunks of 10, 10 and 6
const CHUNK_SIZE = 10;
const MEDIA_URL = '/view?m=abc123';

// A tus 1.0 server in memory, reached through tus-js-client's HTTP stack interface.
// `intercept(request)` may return a response to send instead of the server's own.
function createTusServer() {
	const server = {
		uploads: new Map(),
		requests: [],
		intercept: () => null,
		nextId: 1,
		async handle(request) {
			server.requests.push(request);
			const forced = server.intercept(request);
			if (forced) return forced;
			const { method, url, headers, body } = request;
			const path = new URL(url, 'http://localhost').pathname;
			if (method === 'POST') {
				const location = `${ENDPOINT}upload-${server.nextId++}/`;
				server.uploads.set(location, { length: Number(headers['Upload-Length']), text: '' });
				return { status: 201, headers: { Location: location } };
			}
			const upload = server.uploads.get(path);
			if (!upload) return { status: 404 };
			if (method === 'DELETE') {
				server.uploads.delete(path);
				return { status: 204 };
			}
			const done = () => (upload.text.length === upload.length ? { 'X-Media-Url': MEDIA_URL } : {});
			if (method === 'HEAD') {
				return {
					status: 200,
					headers: {
						'Upload-Offset': String(upload.text.length),
						'Upload-Length': String(upload.length),
						...done(),
					},
				};
			}
			if (Number(headers['Upload-Offset']) !== upload.text.length) return { status: 409 };
			upload.text += await body.text();
			return { status: 204, headers: { 'Upload-Offset': String(upload.text.length), ...done() } };
		},
	};
	server.httpStack = {
		getName: () => 'FakeTusServer',
		createRequest(method, url) {
			const request = { method, url, headers: {} };
			return {
				getMethod: () => method,
				getURL: () => url,
				setHeader: (name, value) => {
					request.headers[name] = value;
				},
				getHeader: (name) => request.headers[name],
				setProgressHandler: () => {},
				abort: () => Promise.resolve(),
				getUnderlyingObject: () => null,
				async send(body) {
					request.body = body;
					const response = await server.handle(request);
					if (response.networkError) throw new Error('network error');
					return {
						getStatus: () => response.status,
						getHeader: (name) => response.headers?.[name] ?? null,
						getBody: () => response.body ?? '',
						getUnderlyingObject: () => null,
					};
				},
			};
		},
	};
	return server;
}

function makeFile(text = CONTENT, name = 'clip.mp4') {
	return new File([text], name, { type: 'video/mp4', lastModified: 1700000000000 });
}

function setup({ lookup = { uploads: [] }, ...options } = {}) {
	const server = createTusServer();
	const events = [];
	const statuses = [];
	const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => lookup }));
	const uploader = createTusUploader({
		endpoint: ENDPOINT,
		chunkSize: CHUNK_SIZE,
		retryDelays: [1, 1, 1],
		httpStack: server.httpStack,
		fetchImpl,
		getHeaders: () => ({ 'X-CSRFToken': 'token-1' }),
		callbacks: {
			onSubmitted: (id, name) => events.push(['submitted', id, name]),
			onStatusChange: (id, status, message) => statuses.push([id, status, message]),
			onComplete: (id, name, response) => events.push(['complete', id, response]),
			onError: (id, name, message) => events.push(['error', id, message]),
			onCancel: (id) => events.push(['cancel', id]),
		},
		...options,
	});
	const settled = (status) => vi.waitFor(() => expect(statuses.map((entry) => entry[1])).toContain(status));
	const patches = () => server.requests.filter((request) => request.method === 'PATCH');
	const storedText = () => [...server.uploads.values()].map((upload) => upload.text);
	return { server, uploader, events, statuses, fetchImpl, settled, patches, storedText };
}

describe('createTusUploader', () => {
	it('creates the upload, sends the file in chunks and reports the media URL', async () => {
		const { server, uploader, events, settled, patches, storedText } = setup({ metadata: { is_draft: '1' } });

		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.COMPLETE);

		expect(storedText()).toEqual([CONTENT]);
		expect(patches().map((request) => request.headers['Upload-Offset'])).toEqual(['0', '10', '20']);
		expect(events).toEqual([
			['submitted', 0, 'clip.mp4'],
			['complete', 0, { media_url: MEDIA_URL }],
		]);
		const creation = server.requests[0];
		expect(creation.method).toBe('POST');
		expect(creation.headers['Upload-Metadata']).toContain(`filename ${btoa('clip.mp4')}`);
		expect(creation.headers['Upload-Metadata']).toContain(`is_draft ${btoa('1')}`);
		expect(creation.headers['Upload-Metadata']).toContain('fingerprint ');
	});

	it('sends the current headers and one upload id on every request', async () => {
		let token = 'token-1';
		const { server, uploader, settled } = setup({ getHeaders: () => ({ 'X-CSRFToken': token }) });
		server.intercept = (request) => {
			if (request.method === 'PATCH') token = 'token-2';
			return null;
		};

		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.COMPLETE);

		expect(server.requests.map((request) => request.headers['X-CSRFToken'])).toEqual([
			'token-1',
			'token-1',
			'token-2',
			'token-2',
		]);
		const uploadIds = new Set(server.requests.map((request) => request.headers['X-Upload-Id']));
		expect(uploadIds.size).toBe(1);
		expect([...uploadIds][0]).toBe(uploader.getUuid(0));
	});

	it('recovers from three separated interruptions without failing the upload', async () => {
		const { server, uploader, events, settled, storedText } = setup();
		const failed = new Set();
		server.intercept = (request) => {
			const offset = request.headers['Upload-Offset'];
			if (request.method !== 'PATCH' || failed.has(offset)) return null;
			failed.add(offset);
			return { status: 503 };
		};

		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.COMPLETE);

		expect([...failed]).toEqual(['0', '10', '20']);
		expect(storedText()).toEqual([CONTENT]);
		expect(events.filter(([name]) => name === 'error')).toEqual([]);
	});

	it('continues from the server offset when the response to a stored chunk is lost', async () => {
		const { server, uploader, settled, patches, storedText } = setup();
		let lost = false;
		server.intercept = (request) => {
			if (request.method !== 'PATCH' || lost) return null;
			lost = true;
			// The server stores the chunk, but the browser never sees the answer.
			return request.body.text().then((text) => {
				server.uploads.get(new URL(request.url, 'http://localhost').pathname).text += text;
				return { networkError: true };
			});
		};

		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.COMPLETE);

		expect(storedText()).toEqual([CONTENT]);
		expect(patches().map((request) => request.headers['Upload-Offset'])).toEqual(['0', '10', '20']);
	});

	it('gives up after the retries are used and reports the server message once', async () => {
		const { server, uploader, events, settled } = setup();
		server.intercept = (request) => (request.method === 'PATCH' ? { status: 503 } : null);

		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.FAILED);

		expect(server.requests.filter((request) => request.method === 'PATCH')).toHaveLength(4);
		expect(events.filter(([name]) => name === 'error')).toEqual([['error', 0, 'Upload failed.']]);
	});

	it('does not retry a refusal and shows its message', async () => {
		const { server, uploader, events, settled } = setup();
		server.intercept = (request) =>
			request.method === 'POST' ? { status: 413, body: JSON.stringify({ error: 'Too large.' }) } : null;

		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.FAILED);

		expect(server.requests).toHaveLength(1);
		expect(events.at(-1)).toEqual(['error', 0, 'Too large.']);
	});

	it('retries a failed upload from the bytes the server holds', async () => {
		const { server, uploader, settled, patches, storedText, statuses } = setup();
		let down = true;
		server.intercept = (request) =>
			down && request.method === 'PATCH' && request.headers['Upload-Offset'] === '10' ? { status: 503 } : null;
		uploader.addFiles([makeFile()]);
		await settled(UPLOAD_STATUS.FAILED);
		down = false;
		statuses.length = 0;
		server.requests.length = 0;

		expect(uploader.retry(0)).toBe(true);
		await settled(UPLOAD_STATUS.COMPLETE);

		expect(patches().map((request) => request.headers['Upload-Offset'])).toEqual(['10', '20']);
		expect(storedText()).toEqual([CONTENT]);
	});

	describe('resume after a reload', () => {
		it('continues the upload the server reports for the reselected file', async () => {
			const file = makeFile();
			const context = setup({ lookup: { uploads: [{ url: `${ENDPOINT}upload-9/`, size: 26, offset: 10 }] } });
			context.server.uploads.set(`${ENDPOINT}upload-9/`, { length: 26, text: CONTENT.slice(0, 10) });

			context.uploader.addFiles([file]);
			await context.settled(UPLOAD_STATUS.COMPLETE);

			expect(context.server.requests.map((request) => request.method)).toEqual(['HEAD', 'PATCH', 'PATCH']);
			expect(context.patches().map((request) => request.headers['Upload-Offset'])).toEqual(['10', '20']);
			expect(context.storedText()).toEqual([CONTENT]);
			const lookupUrl = new URL(context.fetchImpl.mock.calls[0][0], 'http://localhost');
			expect(lookupUrl.pathname).toBe(ENDPOINT);
			expect(Object.fromEntries(lookupUrl.searchParams)).toEqual({
				filename: 'clip.mp4',
				total_size: '26',
				fingerprint: await fileFingerprint(file),
			});
		});

		it('finishes without sending bytes when the server already holds the whole file', async () => {
			const context = setup({ lookup: { uploads: [{ url: `${ENDPOINT}upload-9/`, size: 26, offset: 26 }] } });
			context.server.uploads.set(`${ENDPOINT}upload-9/`, { length: 26, text: CONTENT });

			context.uploader.addFiles([makeFile()]);
			await context.settled(UPLOAD_STATUS.COMPLETE);

			expect(context.patches()).toEqual([]);
			expect(context.events.at(-1)).toEqual(['complete', 0, { media_url: MEDIA_URL }]);
		});

		it('uploads from the start when the lookup fails', async () => {
			const context = setup();
			context.fetchImpl.mockRejectedValue(new Error('offline'));

			context.uploader.addFiles([makeFile()]);
			await context.settled(UPLOAD_STATUS.COMPLETE);

			expect(context.server.requests[0].method).toBe('POST');
			expect(context.storedText()).toEqual([CONTENT]);
		});

		it('gives a different fingerprint to a file with other content of the same size', async () => {
			const first = await fileFingerprint(makeFile());
			const second = await fileFingerprint(makeFile(CONTENT.toUpperCase()));

			expect(first).toMatch(/^[0-9a-f]{64}$/);
			expect(second).not.toBe(first);
		});
	});

	describe('sign-in recovery', () => {
		it('waits for sign-in on 401 without using retries, then continues from the server offset', async () => {
			const { server, uploader, events, statuses, settled, patches, storedText } = setup();
			let signedIn = true;
			server.intercept = (request) => {
				if (request.method === 'PATCH' && request.headers['Upload-Offset'] === '10' && signedIn) {
					signedIn = false;
				}
				return signedIn ? null : { status: 401 };
			};

			uploader.addFiles([makeFile()]);
			await settled(UPLOAD_STATUS.AWAITING_SIGN_IN);

			expect(statuses.at(-1)).toEqual([0, UPLOAD_STATUS.AWAITING_SIGN_IN, SIGN_IN_MESSAGE]);
			expect(patches()).toHaveLength(2);
			expect(events.filter(([name]) => name === 'error')).toEqual([]);

			signedIn = true;
			server.intercept = () => null;
			statuses.length = 0;
			expect(uploader.continueUpload(0)).toBe(true);
			await settled(UPLOAD_STATUS.COMPLETE);

			expect(storedText()).toEqual([CONTENT]);
			expect(server.uploads.size).toBe(1);
		});

		it('never starts a second upload when the server refuses the offset check', async () => {
			const { server, uploader, statuses, settled } = setup();
			let gone = false;
			server.intercept = (request) => {
				if (request.method === 'PATCH' && request.headers['Upload-Offset'] === '10' && !gone) {
					gone = true;
					return { status: 503 };
				}
				return gone && request.method === 'HEAD' ? { status: 410 } : null;
			};

			uploader.addFiles([makeFile()]);
			await settled(UPLOAD_STATUS.EXPIRED);

			expect(statuses.at(-1)).toEqual([0, UPLOAD_STATUS.EXPIRED, EXPIRED_MESSAGE]);
			expect(server.requests.filter((request) => request.method === 'POST')).toHaveLength(1);
		});

		it('sends an expired upload again as a new upload on retry', async () => {
			const { server, uploader, statuses, settled } = setup();
			let gone = false;
			server.intercept = (request) => {
				if (request.method === 'PATCH' && !gone) {
					gone = true;
					return { status: 503 };
				}
				return request.method === 'HEAD' && request.url.includes('upload-1') ? { status: 410 } : null;
			};
			uploader.addFiles([makeFile()]);
			await settled(UPLOAD_STATUS.EXPIRED);
			statuses.length = 0;

			expect(uploader.retry(0)).toBe(true);
			await settled(UPLOAD_STATUS.COMPLETE);

			expect(server.uploads.get(`${ENDPOINT}upload-2/`).text).toBe(CONTENT);
		});
	});

	describe('pause, continue and cancel', () => {
		it('pauses between chunks and continues from the server offset', async () => {
			const { server, uploader, statuses, settled, patches, storedText } = setup();
			server.intercept = (request) => {
				if (request.method === 'PATCH' && request.headers['Upload-Offset'] === '10') uploader.pauseUpload(0);
				return null;
			};

			uploader.addFiles([makeFile()]);
			await settled(UPLOAD_STATUS.PAUSED);
			await new Promise((resolve) => setTimeout(resolve, 5));
			const sentWhilePaused = patches().length;
			server.intercept = () => null;
			statuses.length = 0;

			expect(uploader.continueUpload(0)).toBe(true);
			await settled(UPLOAD_STATUS.COMPLETE);

			expect(sentWhilePaused).toBe(2);
			expect(storedText()).toEqual([CONTENT]);
		});

		it('deletes the unfinished upload on the server when cancelled', async () => {
			const { server, uploader, events, settled } = setup();
			server.intercept = (request) => {
				if (request.method === 'PATCH' && request.headers['Upload-Offset'] === '10') uploader.pauseUpload(0);
				return null;
			};
			uploader.addFiles([makeFile()]);
			await settled(UPLOAD_STATUS.PAUSED);

			uploader.cancel(0);

			await vi.waitFor(() => expect(server.requests.at(-1).method).toBe('DELETE'));
			expect(server.requests.at(-1).headers['X-CSRFToken']).toBe('token-1');
			expect(events.at(-1)).toEqual(['cancel', 0]);
			expect(uploader.getFile(0)).toBeUndefined();
		});

		it('keeps a completed upload on the server when reset', async () => {
			const { server, uploader, settled } = setup();
			uploader.addFiles([makeFile()]);
			await settled(UPLOAD_STATUS.COMPLETE);

			uploader.reset();
			await new Promise((resolve) => setTimeout(resolve, 5));

			expect(server.requests.some((request) => request.method === 'DELETE')).toBe(false);
		});
	});

	describe('validation', () => {
		const cases = [
			['a file type that is not allowed', makeFile(CONTENT, 'notes.txt'), /invalid extension.*mp4, mov/],
			['an empty file', makeFile(''), /is empty/],
			['a file over the size limit', makeFile(CONTENT.repeat(2)), /too large/],
		];

		it.each(cases)('refuses %s without contacting the server', async (_name, file, message) => {
			const { server, uploader, events, fetchImpl } = setup({
				validation: { allowedExtensions: ['mp4', 'mov'], sizeLimit: 30 },
			});

			uploader.addFiles([file]);

			expect(events).toEqual([['error', null, expect.stringMatching(message)]]);
			expect(server.requests).toEqual([]);
			expect(fetchImpl).not.toHaveBeenCalled();
		});

		it('refuses files past the item limit with the caller’s message', async () => {
			const { uploader, events, settled } = setup({
				validation: { itemLimit: 1 },
				messages: { tooManyItems: (count, limit) => `${count} files, limit ${limit}` },
			});

			uploader.addFiles([makeFile(), makeFile(CONTENT, 'second.mp4')]);
			await settled(UPLOAD_STATUS.COMPLETE);

			expect(events).toContainEqual(['error', null, '2 files, limit 1']);
			expect(events.filter(([name]) => name === 'submitted')).toEqual([['submitted', 0, 'clip.mp4']]);
		});
	});
});
