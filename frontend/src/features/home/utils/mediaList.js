/**
 * TanStack Query returns the raw API shape; the API may return either a
 * paginated envelope `{ results: [...] }` or a bare array depending on the
 * endpoint version. This normalizes both shapes to a plain array.
 */
export function normalizeMediaList(data) {
	if (Array.isArray(data)) return data;
	return data?.results ?? [];
}
