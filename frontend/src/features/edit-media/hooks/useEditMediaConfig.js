import { useQuery } from '@tanstack/react-query';

const EMPTY_OPTIONS = {
	categories: [],
	contentSensitivities: [],
	licenses: [],
	mediaCountries: [],
	mediaLanguages: [],
	states: [],
	topics: [],
};

const DEFAULT_STATUS_OPTIONS = [
	{ value: 'public', label: 'Public' },
	{ value: 'private', label: 'Private' },
	{ value: 'restricted', label: 'Restricted' },
	{ value: 'unlisted', label: 'Unlisted' },
];

export const EMPTY_EDIT_MEDIA_CONFIG = {
	allowedExtensions: [],
	csrfToken: '',
	editUrl: window.location.href,
	fields: [],
	media: {},
	options: EMPTY_OPTIONS,
	permissions: {},
	statusOptions: DEFAULT_STATUS_OPTIONS,
	uploadCancelEndpoint: '',
	uploadCompleteEndpoint: '',
	uploadEndpoint: '',
	uploadMaxSize: null,
};

export const EDIT_MEDIA_CONFIG_QUERY_KEY = ['edit-media', 'config'];

function normalizeEditMediaConfig(config = {}) {
	const options = { ...EMPTY_OPTIONS, ...(config.options || {}) };

	return {
		...EMPTY_EDIT_MEDIA_CONFIG,
		...config,
		fields: config.fields || EMPTY_EDIT_MEDIA_CONFIG.fields,
		media: config.media || EMPTY_EDIT_MEDIA_CONFIG.media,
		options,
		permissions: config.permissions || EMPTY_EDIT_MEDIA_CONFIG.permissions,
		statusOptions: options.states.length ? options.states : DEFAULT_STATUS_OPTIONS,
	};
}

function getEditMediaConfig() {
	return normalizeEditMediaConfig(window.MediaCMS?.editMediaPage);
}

export function useEditMediaConfig() {
	return useQuery({
		queryKey: EDIT_MEDIA_CONFIG_QUERY_KEY,
		queryFn: getEditMediaConfig,
		initialData: getEditMediaConfig,
		staleTime: Infinity,
		gcTime: Infinity,
	});
}
