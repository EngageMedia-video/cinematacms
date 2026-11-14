// Reporting a media item from the media page (issue #1051).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const network = vi.hoisted(() => ({ get: [], post: [], delete: [] }));

vi.mock('../../functions', async (importOriginal) => ({
	...(await importOriginal()),
	getRequest: (url, sync, onSuccess, onError) => network.get.push({ url, onSuccess, onError }),
	postRequest: (url, data, config, sync, onSuccess, onError) => network.post.push({ url, data, onSuccess, onError }),
	deleteRequest: (url, config, sync, onSuccess, onError) =>
		network.delete.push({ url, data: config.data, onSuccess, onError }),
}));

function mediaData(overrides = {}) {
	return {
		friendly_token: 'a',
		uid: '00000000-0000-4000-8000-000000000001',
		title: 'A title',
		media_type: 'video',
		state: 'public',
		author_thumbnail: '',
		related_media: [],
		encodings_info: {},
		hls_info: {},
		reported_times: 0,
		...overrides,
	};
}

function reportRequests() {
	return network.post.filter(({ data }) => data.type === 'report');
}

describe('MediaPageStore reportMedia', () => {
	let MediaPageStore;
	let MediaPageActions;
	let reported;
	let failed;
	let retracted;
	let retractFailed;
	let track;

	function loadMedia(overrides) {
		MediaPageActions.loadMediaData();
		network.get.findLast(({ url }) => url.includes('media/a')).onSuccess({ data: mediaData(overrides) });
	}

	beforeAll(async () => {
		const { ensureSidebarStoryMediaCMS } = await import(
			'../../../../features/layout/Sidebar/storybook/sidebarStoryHelpers.jsx'
		);
		ensureSidebarStoryMediaCMS('light');
		window.MediaCMS.mediaId = 'a';
		window.history.replaceState(null, '', '/view?m=a');

		MediaPageStore = (await import('./store.js')).default;
		MediaPageActions = await import('./actions.js');
	});

	beforeEach(() => {
		network.post.length = 0;
		network.delete.length = 0;
		reported = vi.fn();
		failed = vi.fn();
		retracted = vi.fn();
		retractFailed = vi.fn();
		MediaPageStore.on('media_report_retracted', retracted);
		MediaPageStore.on('media_report_retract_failed', retractFailed);
		track = vi.fn();
		MediaPageStore.on('reported_media', reported);
		MediaPageStore.on('media_report_failed', failed);
		window.CinemataAnalytics = { track };
	});

	afterEach(() => {
		MediaPageStore.removeListener('reported_media', reported);
		MediaPageStore.removeListener('media_report_failed', failed);
		MediaPageStore.removeListener('media_report_retracted', retracted);
		MediaPageStore.removeListener('media_report_retract_failed', retractFailed);
		delete window.CinemataAnalytics;
	});

	it('posts the description and records the report once the server confirms it', () => {
		loadMedia();

		MediaPageActions.reportMedia('Shows a private address');

		expect(reportRequests()).toHaveLength(1);
		expect(reportRequests()[0]).toMatchObject({
			url: expect.stringMatching(/media\/a\/actions$/),
			data: { type: 'report', extra_info: 'Shows a private address' },
		});
		expect(reported).not.toHaveBeenCalled();
		expect(track).not.toHaveBeenCalledWith('media_report_success');

		reportRequests()[0].onSuccess({ status: 201, data: { detail: 'action received' } });

		expect(reported).toHaveBeenCalledTimes(1);
		expect(failed).not.toHaveBeenCalled();
		expect(track).toHaveBeenCalledExactlyOnceWith('media_report_success');
	});

	it('still sends a report for media that other viewers reported before', () => {
		loadMedia({ reported_times: 3 });

		MediaPageActions.reportMedia('Spam');

		expect(reportRequests()).toHaveLength(1);
	});

	it('does not send a second report after this page load already reported the media', () => {
		loadMedia();
		MediaPageActions.reportMedia('Spam');
		reportRequests()[0].onSuccess({ status: 201, data: { detail: 'action received' } });

		MediaPageActions.reportMedia('Spam again');

		expect(reportRequests()).toHaveLength(1);
	});

	it.each([
		['the request fails', (request) => request.onError(new Error('Network Error'))],
		['the server answers without a body', (request) => request.onSuccess({ status: 204, data: '' })],
	])('reports a failure and counts nothing when %s', (_label, answer) => {
		loadMedia();

		MediaPageActions.reportMedia('Spam');
		answer(reportRequests()[0]);

		expect(failed).toHaveBeenCalledTimes(1);
		expect(reported).not.toHaveBeenCalled();
		expect(track).not.toHaveBeenCalled();
	});

	it('lets the viewer retry after a failed report', () => {
		loadMedia();
		MediaPageActions.reportMedia('Spam');
		reportRequests()[0].onError(new Error('Network Error'));

		MediaPageActions.reportMedia('Spam');

		expect(reportRequests()).toHaveLength(2);
	});

	it('knows from the media data that this viewer reported the media on an earlier visit', () => {
		loadMedia({ user_has_reported: true });
		expect(MediaPageStore.get('user-reported-media')).toBe(true);

		MediaPageActions.reportMedia('Spam');
		expect(reportRequests()).toHaveLength(0);

		loadMedia({ user_has_reported: false });
		expect(MediaPageStore.get('user-reported-media')).toBe(false);
	});

	it('retracts the report and records it once the server confirms it', () => {
		loadMedia({ user_has_reported: true });

		MediaPageActions.retractMediaReport();

		expect(network.delete).toHaveLength(1);
		expect(network.delete[0]).toMatchObject({
			url: expect.stringMatching(/media\/a\/actions$/),
			data: { type: 'retract_report' },
		});
		expect(retracted).not.toHaveBeenCalled();

		network.delete[0].onSuccess({ status: 200, data: { detail: 'report retracted' } });

		expect(retracted).toHaveBeenCalledTimes(1);
		expect(retractFailed).not.toHaveBeenCalled();
		expect(MediaPageStore.get('user-reported-media')).toBe(false);
		expect(track).toHaveBeenCalledExactlyOnceWith('media_report_retract');
	});

	it('lets the viewer report again after a retraction', () => {
		loadMedia({ user_has_reported: true });
		MediaPageActions.retractMediaReport();
		network.delete[0].onSuccess({ status: 200, data: { detail: 'report retracted' } });

		MediaPageActions.reportMedia('Spam');

		expect(reportRequests()).toHaveLength(1);
	});

	it('does not ask the server to retract a report this viewer never made', () => {
		loadMedia();

		MediaPageActions.retractMediaReport();

		expect(network.delete).toHaveLength(0);
	});

	it('keeps the report and counts nothing when the retraction fails', () => {
		loadMedia({ user_has_reported: true });

		MediaPageActions.retractMediaReport();
		network.delete[0].onError(new Error('Network Error'));

		expect(retractFailed).toHaveBeenCalledTimes(1);
		expect(retracted).not.toHaveBeenCalled();
		expect(MediaPageStore.get('user-reported-media')).toBe(true);
		expect(track).not.toHaveBeenCalled();

		MediaPageActions.retractMediaReport();
		expect(network.delete).toHaveLength(2);
	});
});
