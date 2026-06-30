import { PROFILE_QUERY_KEYS } from '../queryClient';
import { useProfileQuery } from './useProfileQuery';

export function useSimilarProfiles(username, country) {
	const locationQuery = country ? `&location=${encodeURIComponent(country)}` : '';
	return useProfileQuery({
		queryKey: PROFILE_QUERY_KEYS.similar(username, country),
		url: username && country ? `/api/v1/users?page_size=6${locationQuery}` : '',
	});
}
