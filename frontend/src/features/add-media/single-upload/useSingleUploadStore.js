import { create } from 'zustand';

export function createDefaultSingleUploadState() {
	return {
		allowDownload: true,
		errors: {},
		submitError: '',
		shareStage: null,
		selectedThumbnailFile: null,
		lastSelectedThumbnailFile: '',
		mediaStatus: 'public',
		password: '',
		expireEnabled: false,
		startDate: '',
		endDate: '',
		licenseDialogOpen: false,
		noLicense: true,
		selectedLicenseId: '1',
		selectedLicenseFields: {
			commercial: 'yes',
			derivatives: 'yes',
		},
	};
}

const useSingleUploadStore = create((set) => ({
	...createDefaultSingleUploadState(),

	setAllowDownload: (allowDownload) => set({ allowDownload }),
	setErrors: (errors) => set({ errors }),
	setSubmitError: (submitError) => set({ submitError }),
	setShareStage: (shareStage) => set({ shareStage }),
	setSelectedThumbnailFile: (selectedThumbnailFile) =>
		set({ selectedThumbnailFile, lastSelectedThumbnailFile: selectedThumbnailFile?.name ?? '' }),
	setMediaStatus: (mediaStatus) =>
		set((state) => ({ mediaStatus, password: mediaStatus === 'restricted' ? state.password : '' })),
	setPassword: (password) => set({ password }),

	setExpireEnabled: (expireEnabled) =>
		set(expireEnabled ? { expireEnabled } : { expireEnabled, startDate: '', endDate: '' }),
	setStartDate: (startDate) => set({ startDate }),
	setEndDate: (endDate) => set({ endDate }),

	setLicenseDialogOpen: (licenseDialogOpen) => set({ licenseDialogOpen }),
	setNoLicense: (noLicense) => set({ noLicense }),
	setSelectedLicenseField: (field, value) =>
		set((state) => ({
			selectedLicenseFields: { ...state.selectedLicenseFields, [field]: value },
		})),
	applySelectedLicense: (selectedLicenseId) =>
		set({
			selectedLicenseId,
			noLicense: false,
			licenseDialogOpen: false,
		}),

	reset: () => set(createDefaultSingleUploadState()),
}));

export default useSingleUploadStore;
