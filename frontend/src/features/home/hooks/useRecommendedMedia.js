import { useQuery } from '@tanstack/react-query';

export function useRecommendedMedia() {
	return useQuery({
		queryKey: ['home', 'recommended'],
		queryFn: async () => {
			const r = await fetch('/api/v1/media?show=recommended');
			if (!r.ok) throw new Error(`Failed to fetch recommended media: ${r.status}`);
			return r.json();
		},
	});
}
