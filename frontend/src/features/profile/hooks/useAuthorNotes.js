import { useQuery } from '@tanstack/react-query';
import { PROFILE_QUERY_KEYS } from '../queryClient';

// Private journal notes, owner-only. The endpoint aggregates server-side to one
// row per film (latest note + note_count), paginated by film, so a single
// request draws the tab — no client-side grouping or multi-page walk.
export function useAuthorNotes(username, enabled) {
	const url = username ? `/api/v1/users/${encodeURIComponent(username)}/private-journal` : '';

	return useQuery({
		queryKey: PROFILE_QUERY_KEYS.notes(username),
		enabled: Boolean(url) && Boolean(enabled),
		queryFn: async ({ signal }) => {
			const response = await fetch(url, { credentials: 'same-origin', signal });
			if (!response.ok) {
				throw new Error(`Failed to fetch ${url}: ${response.status}`);
			}
			return response.json();
		},
	});
}
