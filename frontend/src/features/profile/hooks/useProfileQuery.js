import { useQuery } from '@tanstack/react-query';

export function useProfileQuery({ enabled = true, queryKey, url }) {
	return useQuery({
		queryKey,
		enabled: enabled && Boolean(url),
		queryFn: async ({ signal }) => {
			const response = await fetch(url, { credentials: 'same-origin', signal });
			if (!response.ok) {
				throw new Error(`Failed to fetch ${url}: ${response.status}`);
			}
			return response.json();
		},
	});
}
