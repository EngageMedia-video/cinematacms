export function normalizeList(data) {
	if (Array.isArray(data)) return data;
	return Array.isArray(data?.results) ? data.results : [];
}
