import { useQuery } from '@tanstack/react-query';

export function commentsQueryKey(friendlyToken) {
	return ['comments', friendlyToken];
}

export function useComments(friendlyToken, { enabled = true } = {}) {
	return useQuery({
		queryKey: commentsQueryKey(friendlyToken),
		enabled: enabled && !!friendlyToken,
		queryFn: async () => {
			const r = await fetch(`/api/v1/media/${encodeURIComponent(friendlyToken)}/comments`, {
				headers: { Accept: 'application/json' },
				credentials: 'same-origin',
			});
			if (!r.ok) throw new Error(`Failed to load comments: ${r.status}`);
			const data = await r.json();
			return Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
		},
	});
}
