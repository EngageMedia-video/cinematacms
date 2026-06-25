import { create } from 'zustand';

// Drops a single field error so live validation can take over after submit.
function withoutError(errors, field) {
	if (!(field in errors)) {
		return errors;
	}

	const next = { ...errors };
	delete next[field];
	return next;
}

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
		thumbnailTime: null,

		// Form state
		errors: {},
		submitError: '',
		shareStage: null,
	};
}

const useSingleUploadStore = create((set) => ({
	...createDefaultSingleUploadState(),

	// Basic details
	setTitle: (title) => set((state) => ({ title, errors: withoutError(state.errors, 'title') })),
	setSummary: (summary) => set((state) => ({ summary, errors: withoutError(state.errors, 'summary') })),
	setDescription: (description) => set({ description }),
	setYearProduced: (yearProduced) =>
		set((state) => ({ yearProduced, errors: withoutError(state.errors, 'year_produced') })),

	// Other details
	setCompany: (company) => set({ company }),
	setWebsite: (website) => set((state) => ({ website, errors: withoutError(state.errors, 'website') })),
	setMediaLanguage: (mediaLanguage) =>
		set((state) => ({ mediaLanguage, errors: withoutError(state.errors, 'media_language') })),
	setMediaCountry: (mediaCountry) =>
		set((state) => ({ mediaCountry, errors: withoutError(state.errors, 'media_country') })),
	setCategory: (category) => set((state) => ({ category, errors: withoutError(state.errors, 'category') })),
	setContentSensitivity: (contentSensitivity) => set({ contentSensitivity }),
	setTopics: (topics) => set((state) => ({ topics, errors: withoutError(state.errors, 'topics') })),
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
		set((state) => ({
			mediaStatus,
			password: mediaStatus === 'restricted' ? state.password : '',
			errors: mediaStatus === 'restricted' ? state.errors : withoutError(state.errors, 'password'),
		})),
	setPassword: (password) => set((state) => ({ password, errors: withoutError(state.errors, 'password') })),
	setExpireEnabled: (expireEnabled) =>
		set(expireEnabled ? { expireEnabled } : { expireEnabled, startDate: '', endDate: '' }),
	setStartDate: (startDate) => set({ startDate }),
	setEndDate: (endDate) => set({ endDate }),

	// Admin settings
	setFeatured: (featured) => set({ featured }),
	setReportedTimes: (reportedTimes) => set({ reportedTimes }),

	// Thumbnail
	setSelectedThumbnailFile: (selectedThumbnailFile) =>
		set({
			selectedThumbnailFile,
			lastSelectedThumbnailFile: selectedThumbnailFile?.name ?? '',
			thumbnailTime: null,
		}),
	setThumbnailTime: (thumbnailTime) =>
		set({
			thumbnailTime,
			selectedThumbnailFile: null,
			lastSelectedThumbnailFile: '',
		}),

	// Form state
	setErrors: (errors) => set({ errors }),
	setSubmitError: (submitError) => set({ submitError }),
	setShareStage: (shareStage) => set({ shareStage }),

	reset: () => set(createDefaultSingleUploadState()),
}));

export default useSingleUploadStore;
