import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BulkUploadPage from './BulkUploadPage';
import useBulkUploadStore from '../useBulkUploadStore';

let uploaderListeners;
let uploader;

// Like Fine Uploader 5.13.0, it adds its own beforeunload prompt while a file is in progress.
class FakeUploader {
	constructor({ callbacks }) {
		this.callbacks = callbacks;
		this.inProgress = new Set();
		uploader = this;
		window.addEventListener('beforeunload', (event) => this.inProgress.size > 0 && event.preventDefault(), {
			signal: uploaderListeners.signal,
		});
	}

	getFile() {
		return new File(['video'], 'film.mp4', { type: 'video/mp4' });
	}

	getSize() {
		return 5;
	}

	getUuid(id) {
		return `00000000-0000-4000-8000-00000000000${id}`;
	}

	setCustomHeaders() {}

	cancelAll() {}

	pauseUpload(id) {
		if (!this.inProgress.delete(id)) return false;
		this.callbacks.onStatusChange(id, 'uploading', 'paused');
		return true;
	}

	start(id, name) {
		this.inProgress.add(id);
		this.callbacks.onSubmitted(id, name);
	}

	finish(id, name) {
		this.inProgress.delete(id);
		this.callbacks.onComplete(id, name, { success: true, media_url: `/view?m=token${id}` });
	}
}

function leaveWarningShown() {
	const event = new Event('beforeunload', { cancelable: true });
	window.dispatchEvent(event);
	return event.defaultPrevented;
}

function renderBulkUpload() {
	return render(<BulkUploadPage config={{ maxFiles: 5, isTrustedUser: true }} />);
}

describe('BulkUploadInner leave warning', () => {
	beforeEach(() => {
		uploaderListeners = new AbortController();
		window.qq = { FineUploaderBasic: FakeUploader };
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }))
		);
	});

	afterEach(() => {
		uploaderListeners.abort();
		useBulkUploadStore.getState().reset();
		document.querySelectorAll('body > a').forEach((link) => link.remove());
		delete window.qq;
		delete window.CinemataAnalytics;
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('warns before leaving once bulk uploads are complete but their details are not saved', () => {
		renderBulkUpload();
		expect(leaveWarningShown()).toBe(false);

		act(() => {
			uploader.start(0, 'river.mp4');
			uploader.start(1, 'forest.mp4');
		});
		act(() => {
			uploader.finish(0, 'river.mp4');
			uploader.finish(1, 'forest.mp4');
		});

		expect(leaveWarningShown()).toBe(true);
	});

	it('leaves without a warning after the bulk details are saved as a draft', async () => {
		const navigations = [];
		vi.stubGlobal('location', {
			...window.location,
			get href() {
				return 'http://localhost/upload';
			},
			set href(url) {
				navigations.push({ url, warned: leaveWarningShown() });
			},
		});
		fetch.mockImplementation(async (url, init) => ({
			ok: true,
			status: 200,
			json: async () => (init?.method === 'POST' ? { success: true, url: '/view?m=saved' } : {}),
		}));
		renderBulkUpload();
		act(() => {
			uploader.start(0, 'river.mp4');
			uploader.start(1, 'forest.mp4');
		});
		act(() => {
			uploader.finish(0, 'river.mp4');
			uploader.finish(1, 'forest.mp4');
		});

		fireEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));

		await waitFor(() => expect(navigations).toEqual([{ url: '/', warned: false }]));
	});

	it('does not ask a second time when leaving while another bulk upload is in progress', async () => {
		const uploadEvent = vi.fn();
		window.CinemataAnalytics = { uploadEvent };
		const followedLinks = [];
		// jsdom cannot navigate, so this records the links a browser would follow.
		const recordFollowedLink = (event) => {
			const link = event.target.closest?.('a[href]');
			if (!link) return;
			if (!event.defaultPrevented) followedLinks.push(link.getAttribute('href'));
			event.preventDefault();
		};
		window.addEventListener('click', recordFollowedLink);
		const aboutLink = document.createElement('a');
		aboutLink.setAttribute('href', '/about');
		aboutLink.textContent = 'About the Site';
		document.body.append(aboutLink);

		try {
			renderBulkUpload();
			act(() => {
				uploader.start(0, 'river.mp4');
				uploader.start(1, 'forest.mp4');
			});
			act(() => uploader.finish(0, 'river.mp4'));
			fireEvent.click(aboutLink);
			expect(followedLinks).toEqual([]);

			const warnedWhileFollowing = [];
			aboutLink.addEventListener('click', () => warnedWhileFollowing.push(leaveWarningShown()));
			fireEvent.click(await screen.findByRole('button', { name: 'Leave' }));

			expect(followedLinks).toEqual(['/about']);
			expect(warnedWhileFollowing).toEqual([false]);
			// The transfer paused only because the page is leaving, not by the user.
			expect(uploadEvent.mock.calls.filter(([event]) => event === 'pause')).toEqual([]);
		} finally {
			window.removeEventListener('click', recordFollowedLink);
		}
	});
});
