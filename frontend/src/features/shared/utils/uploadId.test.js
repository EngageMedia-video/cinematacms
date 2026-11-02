import fineUploaderSource from '../../../static/lib/file-uploader/5.13.0/fine-uploader.js?raw';
import { sendUploadIdHeader, UPLOAD_ID_HEADER } from './uploadId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

class FakeXhr {
	static requests = [];

	constructor() {
		this.upload = {};
		this.headers = {};
		this.withCredentials = false;
		FakeXhr.requests.push(this);
	}

	open(method, url) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(name, value) {
		this.headers[name] = value;
	}

	send() {
		setTimeout(() => {
			this.readyState = 4;
			this.status = 200;
			this.responseText = '{"success":true}';
			this.onreadystatechange?.();
		}, 0);
	}

	abort() {}
}

describe('sendUploadIdHeader with the bundled Fine Uploader', () => {
	let originalXhr;

	beforeEach(() => {
		originalXhr = window.XMLHttpRequest;
		FakeXhr.requests = [];
		window.XMLHttpRequest = FakeXhr;
		new Function(fineUploaderSource)();
	});

	afterEach(() => {
		window.XMLHttpRequest = originalXhr;
		delete window.qq;
	});

	function uploadTwoChunks(onSubmitted) {
		return new Promise((resolve) => {
			const uploader = new window.qq.FineUploaderBasic({
				request: { endpoint: '/fu/upload/', customHeaders: { 'X-CSRFToken': 'csrf-token' } },
				chunking: { enabled: true, partSize: 4, success: { endpoint: '/fu/upload/?done' } },
				callbacks: {
					onSubmitted: (id) => onSubmitted(uploader, id),
					onComplete: () => resolve(uploader),
				},
			});
			uploader.addFiles([new File(['abcdefgh'], 'film.mp4', { type: 'video/mp4' })]);
		});
	}

	const posts = () => FakeXhr.requests.filter((request) => request.method === 'POST');

	it('sends the file uuid and the CSRF token on every chunk and on the chunks-done request', async () => {
		let uuid;
		await uploadTwoChunks((uploader, id) => {
			uuid = uploader.getUuid(id);
			sendUploadIdHeader(uploader, id, { 'X-CSRFToken': 'csrf-token' });
		});

		expect(uuid).toMatch(UUID_V4);
		expect(posts().length).toBeGreaterThanOrEqual(3);
		expect(posts().some((request) => request.url.includes('done'))).toBe(true);
		for (const request of posts()) {
			expect(request.headers[UPLOAD_ID_HEADER]).toBe(uuid);
			expect(request.headers['X-CSRFToken']).toBe('csrf-token');
		}
	});

	it('sends no upload id when the caller does not tag the file', async () => {
		await uploadTwoChunks(() => {});

		expect(posts().length).toBeGreaterThan(0);
		for (const request of posts()) {
			expect(request.headers[UPLOAD_ID_HEADER]).toBeUndefined();
		}
	});
});
