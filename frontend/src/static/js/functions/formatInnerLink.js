import urlParse from 'url-parse';

export function formatInnerLink(url, baseUrl) {
	let link = urlParse(url, {});

	if ('' === link.origin || 'null' === link.origin || !link.origin) {
		const safeUrl = url == null ? '' : url;
		link = urlParse(baseUrl + '/' + safeUrl.replace(/^\/+/, ''), {});
	}

	return link.toString();
}

export function formatMediaLink(url, baseUrl, token = null) {
	let link = urlParse(url, {});

	if ('' === link.origin || 'null' === link.origin || !link.origin) {
		const safeUrl = url == null ? '' : url;
		link = urlParse(baseUrl + '/' + safeUrl.replace(/^\/+/, ''), {});
	}

	// Add token parameter for restricted media
	if (token && token.trim() !== '') {
		const searchParams = new URLSearchParams(link.query);
		searchParams.set('token', token);
		link.set('query', searchParams.toString());
	}

	return link.toString();
}
