export function resolveAvatarSrc(url) {
	if (typeof url !== 'string') return null;
	const trimmed = url.trim();
	if (trimmed === '' || trimmed === 'None' || trimmed === 'null' || trimmed === 'undefined') return null;
	return trimmed;
}
