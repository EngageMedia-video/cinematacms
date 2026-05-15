import { useQuery } from '@tanstack/react-query';

/**
 * Factory for media list hooks that share the same fetch-and-parse shape.
 * Each call returns a hook bound to a TanStack queryKey and endpoint URL.
 */
export function createMediaQueryHook(queryKey, url, options = {}) {
	return function useMediaQuery() {
		return useQuery({
			queryKey,
			queryFn: async () => {
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
				return response.json();
			},
			...options,
		});
	};
}
