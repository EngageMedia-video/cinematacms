export function formatFileSize(bytes) {
	if (!bytes) {
		return '';
	}
	const mb = bytes / (1024 * 1024);
	if (mb >= 1) {
		return `${mb.toFixed(mb >= 10 ? 0 : 1)}MB`;
	}
	return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}
