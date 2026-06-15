import getCSRFToken from '../../../static/js/functions/getCSRFToken';

export { getCSRFToken };

/**
 * Thin JSON fetch helper for the upload feature. Sends the session cookie and
 * the CSRF header on unsafe methods, matching the convention used across the
 * modern-track hooks (notifications, comments, user-settings).
 */
export async function apiFetch(url, { method = 'GET', body, signal } = {}) {
	const headers = {};
	const isUnsafe = method !== 'GET' && method !== 'HEAD';
	if (body !== undefined) {
		headers['Content-Type'] = 'application/json';
	}
	if (isUnsafe) {
		headers['X-CSRFToken'] = getCSRFToken() ?? '';
	}

	return fetch(url, {
		method,
		credentials: 'same-origin',
		headers,
		body: body !== undefined ? JSON.stringify(body) : undefined,
		signal,
	});
}

/** Parse a media friendly_token out of an upload response `media_url`.
 * The chunked uploader returns `{ success, media_url }` where media_url is
 * `/view?m=<token>` (Media.get_absolute_url). There is no token field. */
export function parseFriendlyToken(mediaUrl) {
	if (!mediaUrl || typeof mediaUrl !== 'string') {
		return null;
	}
	const match = mediaUrl.match(/[?&]m=([\w-]+)/);
	return match ? match[1] : null;
}
