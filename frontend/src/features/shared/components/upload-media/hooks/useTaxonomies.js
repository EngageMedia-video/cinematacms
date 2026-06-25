import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../utils/api';

const DEFAULT_OPTIONS_ENDPOINT = '/api/v1/my_uploads/upload_options';

const EMPTY_OPTIONS = {
	categories: [],
	topics: [],
	content_sensitivities: [],
	languages: [],
	countries: [],
	licenses: [],
};

/**
 * Loads the option lists for the metadata form (categories, topics, content
 * sensitivities, languages, countries, licenses). The endpoint returns ids for
 * the M2M fields and codes for language/country so the client submits exactly
 * what MediaForm expects.
 */
export function useTaxonomies(endpoint = DEFAULT_OPTIONS_ENDPOINT) {
	const query = useQuery({
		queryKey: ['upload-taxonomies', endpoint],
		staleTime: 5 * 60_000,
		queryFn: async ({ signal }) => {
			const response = await apiFetch(endpoint, { signal });
			if (!response.ok) {
				throw new Error(`Failed to load form options: ${response.status}`);
			}
			return response.json();
		},
	});

	return { ...query, options: query.data ?? EMPTY_OPTIONS };
}
