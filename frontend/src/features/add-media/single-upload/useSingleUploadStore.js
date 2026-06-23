import { create } from 'zustand';

export function createDefaultSingleUploadState() {
	return {
		// Basic details
		title: '',
		summary: '',
		description: '',
		yearProduced: '',

		// Other details
		company: '',
		website: '',
		mediaLanguage: '',
		mediaCountry: '',
		category: [],
		contentSensitivity: [],
		topics: [],
		tags: '',

		// License
		licenseDialogOpen: false,
		noLicense: true,
		selectedLicenseId: '1',
		selectedLicenseFields: {
			commercial: 'yes',
			derivatives: 'yes',
		},

		// Final settings
		allowDownload: true,
		enableComments: true,
		isEncrypted: false,
		mediaStatus: 'public',
		password: '',
		expireEnabled: false,
		startDate: '',
		endDate: '',

		// Admin settings
		featured: false,
		reportedTimes: '0',

		// Thumbnail
		selectedThumbnailFile: null,
		lastSelectedThumbnailFile: '',

		// Form state
		errors: {},
		submitError: '',
		shareStage: null,
	};
}

const useSingleUploadStore = create((set) => ({
	...createDefaultSingleUploadState(),

	// Basic details
	setTitle: (title) => set({ title }),
	setSummary: (summary) => set({ summary }),
	setDescription: (description) => set({ description }),
	setYearProduced: (yearProduced) => set({ yearProduced }),

	// Other details
	setCompany: (company) => set({ company }),
	setWebsite: (website) => set({ website }),
	setMediaLanguage: (mediaLanguage) => set({ mediaLanguage }),
	setMediaCountry: (mediaCountry) => set({ mediaCountry }),
	setCategory: (category) => set({ category }),
	setContentSensitivity: (contentSensitivity) => set({ contentSensitivity }),
	setTopics: (topics) => set({ topics }),
	setTags: (tags) => set({ tags }),

	// License
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

	// Final settings
	setAllowDownload: (allowDownload) => set({ allowDownload }),
	setEnableComments: (enableComments) => set({ enableComments }),
	setIsEncrypted: (isEncrypted) => set({ isEncrypted }),
	setMediaStatus: (mediaStatus) =>
		set((state) => ({ mediaStatus, password: mediaStatus === 'restricted' ? state.password : '' })),
	setPassword: (password) => set({ password }),
	setExpireEnabled: (expireEnabled) =>
		set(expireEnabled ? { expireEnabled } : { expireEnabled, startDate: '', endDate: '' }),
	setStartDate: (startDate) => set({ startDate }),
	setEndDate: (endDate) => set({ endDate }),

	// Admin settings
	setFeatured: (featured) => set({ featured }),
	setReportedTimes: (reportedTimes) => set({ reportedTimes }),

	// Thumbnail
	setSelectedThumbnailFile: (selectedThumbnailFile) =>
		set({ selectedThumbnailFile, lastSelectedThumbnailFile: selectedThumbnailFile?.name ?? '' }),

	// Form state
	setErrors: (errors) => set({ errors }),
	setSubmitError: (submitError) => set({ submitError }),
	setShareStage: (shareStage) => set({ shareStage }),

	reset: () => set(createDefaultSingleUploadState()),
}));

export default useSingleUploadStore;
