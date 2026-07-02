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
			if (!r.ok) {
				// A private video answers the comments endpoint with a 400 for
				// anyone other than its owner. Surface that as a "disabled" state
				// instead of a generic load error so the panel can explain it.
				if (r.status === 400) {
					let detail;
					try {
						detail = (await r.json())?.detail;
					} catch {
						detail = undefined;
					}
					if (detail === 'media is private') {
						return { results: [], count: 0, commentsDisabled: true };
					}
				}
				throw new Error(`Failed to load comments: ${r.status}`);
			}
			const data = await r.json();
			const results = Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : [];
			return {
				results,
				count: typeof data?.count === 'number' ? data.count : results.length,
				commentsDisabled: false,
			};
		},
	});
}
