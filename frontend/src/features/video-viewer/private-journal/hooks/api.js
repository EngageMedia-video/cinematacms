import getCSRFToken from '../../../../static/js/functions/getCSRFToken';

export function privateJournalQueryKey(friendlyToken) {
	return ['private-journal', friendlyToken];
}

export function getPrivateJournalUrl(friendlyToken, uid) {
	const base = `/api/v1/media/${encodeURIComponent(friendlyToken)}/private-journal${
		uid ? `/${encodeURIComponent(uid)}` : ''
	}`;
	const token = getRestrictedMediaToken();
	return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export function getJsonHeaders() {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'X-CSRFToken': getCSRFToken() ?? '',
	};
}

function getRestrictedMediaToken() {
	if (typeof window === 'undefined') return '';
	try {
		return new URLSearchParams(window.location.search).get('token') || '';
	} catch {
		return '';
	}
}
