import useSingleUploadStore, { createDefaultSingleUploadState } from './useSingleUploadStore';

beforeEach(() => {
	useSingleUploadStore.getState().reset();
});

describe('useSingleUploadStore', () => {
	it('provides default single-upload form state', () => {
		const state = createDefaultSingleUploadState();

		expect(state.allowDownload).toBe(true);
		expect(state.mediaStatus).toBe('public');
		expect(state.noLicense).toBe(true);
		expect(state.selectedThumbnailFile).toBeNull();
		expect(state.thumbnailTime).toBeNull();
		expect(state.selectedLicenseId).toBe('1');
		expect(state.selectedLicenseFields).toEqual({ commercial: 'yes', derivatives: 'yes' });
	});

	it('keeps custom thumbnail upload and frame selection mutually exclusive', () => {
		const store = useSingleUploadStore.getState();
		const file = new File(['poster'], 'poster.png', { type: 'image/png' });

		store.setSelectedThumbnailFile(file);
		expect(useSingleUploadStore.getState()).toMatchObject({
			selectedThumbnailFile: file,
			lastSelectedThumbnailFile: 'poster.png',
			thumbnailTime: null,
		});

		store.setThumbnailTime(20);
		expect(useSingleUploadStore.getState()).toMatchObject({
			selectedThumbnailFile: null,
			lastSelectedThumbnailFile: '',
			thumbnailTime: 20,
		});

		store.setSelectedThumbnailFile(file);
		expect(useSingleUploadStore.getState()).toMatchObject({
			selectedThumbnailFile: file,
			lastSelectedThumbnailFile: 'poster.png',
			thumbnailTime: null,
		});
	});

	it('resets password when restricted status is disabled', () => {
		const store = useSingleUploadStore.getState();

		store.setMediaStatus('restricted');
		store.setPassword('secret');
		store.setMediaStatus('public');

		expect(useSingleUploadStore.getState()).toMatchObject({
			mediaStatus: 'public',
			password: '',
		});
	});

	it('resets visibility dates when expiration is disabled', () => {
		const store = useSingleUploadStore.getState();

		store.setExpireEnabled(true);
		store.setStartDate('2026-01-01');
		store.setEndDate('2026-01-31');
		store.setExpireEnabled(false);

		expect(useSingleUploadStore.getState()).toMatchObject({
			expireEnabled: false,
			startDate: '',
			endDate: '',
		});
	});

	it('applies selected license details', () => {
		const store = useSingleUploadStore.getState();

		store.setSelectedLicenseField('commercial', 'no');
		store.setSelectedLicenseField('derivatives', 'sharealike');
		store.applySelectedLicense('4');

		expect(useSingleUploadStore.getState()).toMatchObject({
			licenseDialogOpen: false,
			noLicense: false,
			selectedLicenseId: '4',
			selectedLicenseFields: { commercial: 'no', derivatives: 'sharealike' },
		});
	});
});
