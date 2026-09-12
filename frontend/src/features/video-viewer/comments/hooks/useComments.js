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
				// The endpoint answers 403 for any film the viewer cannot open —
				// private, or restricted without a token. Surface that as a
				// "disabled" state instead of a generic load error so the panel can
				// explain it. 400 with this detail is the pre-#907 shape of the same
				// refusal, kept so a cached bundle still renders against an old server.
				if (r.status === 403) {
					return { results: [], count: 0, commentsDisabled: true };
				}
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
