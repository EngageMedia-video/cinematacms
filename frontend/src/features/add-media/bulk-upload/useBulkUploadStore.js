import { create } from 'zustand';

export const SUB_STEPS = ['basic', 'thumbnail', 'other', 'final'];

export const UPLOAD_STATUS = {
	UPLOADING: 'uploading',
	PAUSED: 'paused',
	COMPLETE: 'complete',
	FAILED: 'failed',
};

export function createDefaultMetadata() {
	return {
		title: '',
		summary: '',
		description: '',
		year_produced: '',
		company: '',
		website: '',
		media_language: 'en',
		media_country: '',
		category: [],
		topics: [],
		content_sensitivity: [],
		new_tags: '',
		// Mirrors single-upload: a default license id is kept so unchecking
		// "All Rights Reserved" yields a valid license, while no_license defaults
		// on (the submitted custom_license becomes the "None" sentinel).
		custom_license: '1',
		no_license: true,
		enable_comments: true,
		allow_download: true,
		state: 'public',
		password: '',
		// Stream Protection defaults on, matching single-upload.
		is_encrypted: true,
		// Admin-only fields (shown only to admins); reported_times mirrors the
		// hidden "0" the single-upload form posts for non-admins.
		featured: false,
		reported_times: '0',
	};
}

const useBulkUploadStore = create((set) => ({
	files: [],
	currentStep: 1,
	subStep: 'basic',
	lastError: null,

	addFile: ({ id, name, sizeBytes }) =>
		set((state) => {
			if (state.files.some((file) => file.id === id)) {
				return state;
			}
			return {
				files: [
					...state.files,
					{
						id,
						name,
						sizeBytes,
						uploadStatus: UPLOAD_STATUS.UPLOADING,
						progress: 0,
						friendlyToken: null,
						thumbnailUrl: null,
						// Chosen thumbnail image File, sent as uploaded_poster on submit.
						posterFile: null,
						error: null,
						metadata: createDefaultMetadata(),
					},
				],
			};
		}),

	updateFile: (id, patch) =>
		set((state) => ({
			files: state.files.map((file) => (file.id === id ? { ...file, ...patch } : file)),
		})),

	removeFile: (id) =>
		set((state) => ({
			files: state.files.filter((file) => file.id !== id),
		})),

	setMetadata: (id, patch) =>
		set((state) => ({
			files: state.files.map((file) =>
				file.id === id ? { ...file, metadata: { ...file.metadata, ...patch } } : file
			),
		})),

	setPosterFile: (id, posterFile) =>
		set((state) => ({
			files: state.files.map((file) => (file.id === id ? { ...file, posterFile } : file)),
		})),

	setStep: (currentStep) => set({ currentStep }),
	setSubStep: (subStep) => set({ subStep }),
	setLastError: (lastError) => set({ lastError }),
	reset: () => set({ files: [], currentStep: 1, subStep: 'basic', lastError: null }),
}));

export default useBulkUploadStore;
