import { useQuery, useQueryClient } from '@tanstack/react-query';

export const EDIT_MEDIA_STATE_QUERY_KEY = ['edit-media', 'state'];

function firstLicenseFields(licenses, selectedLicenseId) {
	const selected =
		licenses.find((license) => String(license.id) === String(selectedLicenseId)) ?? licenses[0] ?? null;
	return {
		commercial: selected?.allowCommercial ?? 'yes',
		derivatives: selected?.allowModifications ?? 'yes',
	};
}

function createEditMediaState(config) {
	const media = config.media || {};
	const licenses = config.options.licenses;
	const initialLicenseId = media.selectedLicenseId || licenses[0]?.id || '';

	return {
		title: media.title || '',
		summary: media.summary || '',
		description: media.description || '',
		yearProduced: media.yearProduced || '',
		company: media.company || '',
		website: media.website || '',
		mediaLanguage: media.mediaLanguage || '',
		mediaCountry: media.mediaCountry || '',
		category: media.category || [],
		contentSensitivity: media.contentSensitivity || [],
		topics: media.topics || [],
		tags: media.tags || '',
		licenseDialogOpen: false,
		noLicense: media.noLicense ?? true,
		selectedLicenseId: initialLicenseId,
		selectedLicenseFields: firstLicenseFields(licenses, initialLicenseId),
		allowDownload: media.allowDownload ?? true,
		enableComments: media.enableComments ?? true,
		isEncrypted: media.isEncrypted ?? false,
		mediaStatus: media.mediaStatus || 'private',
		password: '',
		expireEnabled: Boolean(media.visibilityStart || media.visibilityEnd),
		startDate: media.visibilityStart || '',
		endDate: media.visibilityEnd || '',
		featured: media.featured ?? false,
		isReviewed: media.isReviewed ?? false,
		reportedTimes: media.reportedTimes || '0',
		addDate: media.addDate || '',
		allowWhisperTranslate: media.allowWhisperTranslate ?? false,
		selectedThumbnailFile: null,
		lastSelectedThumbnailFile: '',
		thumbnailTime: null,
		thumbnailFrame: null,
		errors: media.errors || {},
		submitError: '',
	};
}

function withoutError(errors, field) {
	if (!(field in errors)) return errors;
	const nextErrors = { ...errors };
	delete nextErrors[field];
	return nextErrors;
}

export function useEditMediaState(config) {
	const queryClient = useQueryClient();
	const licenses = config.options.licenses;
	const queryKey = [...EDIT_MEDIA_STATE_QUERY_KEY, config.media?.friendlyToken || 'new'];
	const initialState = () => createEditMediaState(config);
	const { data: state = initialState() } = useQuery({
		queryKey,
		queryFn: initialState,
		initialData: initialState,
		staleTime: Infinity,
		gcTime: Infinity,
	});

	function updateState(updater) {
		queryClient.setQueryData(queryKey, (current) => {
			const base = current || initialState();
			return typeof updater === 'function' ? updater(base) : { ...base, ...updater };
		});
	}

	function patch(next) {
		updateState(next);
	}

	function patchAndClear(next, field) {
		updateState((current) => ({
			...current,
			...next,
			errors: withoutError(current.errors, field),
		}));
	}

	return {
		...state,
		setTitle: (title) => patchAndClear({ title }, 'title'),
		setSummary: (summary) => patchAndClear({ summary }, 'summary'),
		setDescription: (description) => patch({ description }),
		setYearProduced: (yearProduced) => patchAndClear({ yearProduced }, 'year_produced'),
		setCompany: (company) => patch({ company }),
		setWebsite: (website) => patchAndClear({ website }, 'website'),
		setMediaLanguage: (mediaLanguage) => patchAndClear({ mediaLanguage }, 'media_language'),
		setMediaCountry: (mediaCountry) => patchAndClear({ mediaCountry }, 'media_country'),
		setCategory: (category) => patchAndClear({ category }, 'category'),
		setContentSensitivity: (contentSensitivity) => patch({ contentSensitivity }),
		setTopics: (topics) => patchAndClear({ topics }, 'topics'),
		setTags: (tags) => patch({ tags }),
		setLicenseDialogOpen: (licenseDialogOpen) => patch({ licenseDialogOpen }),
		setNoLicense: (noLicense) =>
			updateState((current) => ({
				...current,
				noLicense,
				selectedLicenseId: noLicense ? current.selectedLicenseId : current.selectedLicenseId || licenses[0]?.id || '',
			})),
		setSelectedLicenseField: (field, value) =>
			updateState((current) => ({
				...current,
				selectedLicenseFields: { ...current.selectedLicenseFields, [field]: value },
			})),
		applySelectedLicense: (selectedLicenseId) =>
			patch({ selectedLicenseId, noLicense: false, licenseDialogOpen: false }),
		setAllowDownload: (allowDownload) => patch({ allowDownload }),
		setEnableComments: (enableComments) => patch({ enableComments }),
		setIsEncrypted: (isEncrypted) => patch({ isEncrypted }),
		setMediaStatus: (mediaStatus) =>
			updateState((current) => ({
				...current,
				mediaStatus,
				password: mediaStatus === 'restricted' ? current.password : '',
				errors: mediaStatus === 'restricted' ? current.errors : withoutError(current.errors, 'password'),
			})),
		setPassword: (password) => patchAndClear({ password }, 'password'),
		setExpireEnabled: (expireEnabled) =>
			patch(expireEnabled ? { expireEnabled } : { expireEnabled, startDate: '', endDate: '' }),
		setStartDate: (startDate) => patch({ startDate }),
		setEndDate: (endDate) => patch({ endDate }),
		setFeatured: (featured) => patch({ featured }),
		setIsReviewed: (isReviewed) => patch({ isReviewed }),
		setReportedTimes: (reportedTimes) => patch({ reportedTimes }),
		setAddDate: (addDate) => patch({ addDate }),
		setAllowWhisperTranslate: (allowWhisperTranslate) => patch({ allowWhisperTranslate }),
		setSelectedThumbnailFile: (selectedThumbnailFile) =>
			patch({
				selectedThumbnailFile,
				lastSelectedThumbnailFile: selectedThumbnailFile?.name ?? '',
				thumbnailTime: null,
				thumbnailFrame: null,
			}),
		setThumbnailTime: (thumbnailTime, thumbnailFrame = null) =>
			patch({ thumbnailTime, thumbnailFrame, selectedThumbnailFile: null, lastSelectedThumbnailFile: '' }),
		setErrors: (errors) => patch({ errors }),
		setSubmitError: (submitError) => patch({ submitError }),
	};
}
