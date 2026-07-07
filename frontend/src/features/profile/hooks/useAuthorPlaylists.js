import { PROFILE_QUERY_KEYS } from '../queryClient';
import { useProfileQuery } from './useProfileQuery';

export function useAuthorPlaylists(username) {
	return useProfileQuery({
		queryKey: PROFILE_QUERY_KEYS.playlists(username),
		url: username ? `/api/v1/playlists?author=${encodeURIComponent(username)}` : '',
	});
}
