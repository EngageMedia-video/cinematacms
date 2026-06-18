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
		year_produced_custom: '',
		company: '',
		website: '',
		media_language: 'en',
		media_country: '',
		category: [],
		topics: [],
		content_sensitivity: [],
		new_tags: '',
		custom_license: '',
		no_license: false,
		enable_comments: true,
		allow_download: true,
		state: 'public',
		requirePassword: false,
		password: '',
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

	setStep: (currentStep) => set({ currentStep }),
	setSubStep: (subStep) => set({ subStep }),
	setLastError: (lastError) => set({ lastError }),
	reset: () => set({ files: [], currentStep: 1, subStep: 'basic', lastError: null }),
}));

export default useBulkUploadStore;
