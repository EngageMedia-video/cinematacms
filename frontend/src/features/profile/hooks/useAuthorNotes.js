import { useQuery } from '@tanstack/react-query';
import { PROFILE_QUERY_KEYS } from '../queryClient';
import { fetchAllPages } from './useAuthorMedia';

// Private journal notes are owner-only and paginated (DRF PageNumberPagination).
// Only fetch when the profile belongs to the current user.
export function useAuthorNotes(username, enabled) {
	const url = username ? `/api/v1/users/${encodeURIComponent(username)}/private-journal` : '';

	return useQuery({
		queryKey: PROFILE_QUERY_KEYS.notes(username),
		enabled: Boolean(url) && Boolean(enabled),
		queryFn: ({ signal }) => fetchAllPages(url, signal),
	});
}
