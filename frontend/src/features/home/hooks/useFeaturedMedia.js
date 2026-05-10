import { useQuery } from '@tanstack/react-query';

export function useFeaturedMedia() {
	return useQuery({
		queryKey: ['home', 'featured'],
		queryFn: async () => {
			const r = await fetch('/api/v1/media?show=featured');
			if (!r.ok) throw new Error(`Failed to fetch featured media: ${r.status}`);
			return r.json();
		},
	});
}
