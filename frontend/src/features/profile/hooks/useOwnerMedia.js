import { PROFILE_QUERY_KEYS } from '../queryClient';
import { useProfileQuery } from './useProfileQuery';

export function useOwnerMedia(username, action, enabled) {
	return useProfileQuery({
		enabled,
		queryKey: PROFILE_QUERY_KEYS[action](username),
		url: action === 'history' ? '/api/v1/user/action/watch' : '/api/v1/user/action/like',
	});
}
