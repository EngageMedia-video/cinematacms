import { PROFILE_QUERY_KEYS } from '../queryClient';
import { useProfileQuery } from './useProfileQuery';

export function useAuthorMedia(username) {
	return useProfileQuery({
		queryKey: PROFILE_QUERY_KEYS.media(username),
		url: username ? `/api/v1/media?author=${encodeURIComponent(username)}` : '',
	});
}
