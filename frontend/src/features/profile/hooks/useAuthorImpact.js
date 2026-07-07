import { PROFILE_QUERY_KEYS } from '../queryClient';
import { useProfileQuery } from './useProfileQuery';

export function useAuthorImpact(username) {
	return useProfileQuery({
		queryKey: PROFILE_QUERY_KEYS.impact(username),
		url: username ? `/api/v1/users/${encodeURIComponent(username)}/community-impacts` : '',
	});
}
