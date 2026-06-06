import { useQuery } from '@tanstack/react-query';
import {
	COMMUNITY_IMPACT_OPTIONS,
	LENGTH_OPTIONS,
	LICENSE_OPTIONS,
	POPULARITY_OPTIONS,
	UPLOAD_DATE_OPTIONS,
} from '../constants';

async function fetchJson(url, signal) {
	const response = await fetch(url, { signal, credentials: 'same-origin' });
	if (!response.ok) {
		throw new Error(`Request failed: ${response.status}`);
	}
	return response.json();
}

function normalizeTaxonomyOptions(items, valueKey = 'title') {
	if (!Array.isArray(items)) {
		return [];
	}

	return items
		.map((item) => ({
			value: item[valueKey],
			label: item.title,
			count: item.media_count,
		}))
		.filter((item) => item.value && item.label);
}

function useFilterList(key, url, valueKey) {
	return useQuery({
		queryKey: ['search', 'filter-options', key],
		queryFn: async ({ signal }) => normalizeTaxonomyOptions(await fetchJson(url, signal), valueKey),
	});
}

export function useSearchFilterOptions() {
	const categories = useFilterList('categories', '/api/v1/categories');
	const topics = useFilterList('topics', '/api/v1/topics');
	const countries = useFilterList('countries', '/api/v1/countries');
	const subtitleLanguages = useFilterList('subtitle-languages', '/api/v1/subtitle-languages', 'code');

	return {
		isLoading: categories.isLoading || topics.isLoading || countries.isLoading || subtitleLanguages.isLoading,
		isError: categories.isError || topics.isError || countries.isError || subtitleLanguages.isError,
		sections: {
			category: categories.data ?? [],
			topic: topics.data ?? [],
			country: countries.data ?? [],
			subtitle_language: subtitleLanguages.data ?? [],
			length: LENGTH_OPTIONS,
			upload_date: UPLOAD_DATE_OPTIONS,
			sort: POPULARITY_OPTIONS,
			license: LICENSE_OPTIONS,
			community_impact: COMMUNITY_IMPACT_OPTIONS,
		},
	};
}
