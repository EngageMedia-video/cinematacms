import { create } from 'zustand';

export function createDefaultSingleUploadState() {
	return {
		allowDownload: false,
		errors: {},
		submitError: '',
		shareStage: null,
		selectedThumbnailFile: null,
		lastSelectedThumbnailFile: '',
		mediaStatus: 'public',
		requirePassword: false,
		isEditingPassword: false,
		passwordDraft: '',
		savedPassword: '',
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
	setMediaStatus: (mediaStatus) => set({ mediaStatus }),

	setRequirePassword: (requirePassword) =>
		set(
			requirePassword
				? { requirePassword }
				: {
						requirePassword,
						isEditingPassword: false,
						passwordDraft: '',
						savedPassword: '',
					}
		),
	beginEditingPassword: () =>
		set((state) => ({
			passwordDraft: state.savedPassword,
			isEditingPassword: true,
		})),
	setPasswordDraft: (passwordDraft) => set({ passwordDraft }),
	savePassword: () =>
		set((state) => ({
			savedPassword: state.passwordDraft,
			isEditingPassword: false,
		})),

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
