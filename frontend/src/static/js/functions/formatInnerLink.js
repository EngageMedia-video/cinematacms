import urlParse from 'url-parse';

// Join a base URL and a relative path with exactly one slash between them,
// whether or not baseUrl ends with a slash or the path starts with one.
// This is not an edge case: the site config template hardcodes a trailing
// slash (templates/config/installation/site.html emits `url: '{{FRONTEND_HOST}}/'`),
// so site.url ends in "/" on every deployment and the old join produced
// "https://host//media/..." everywhere, fragmenting CDN caches into separate
// // and / namespaces (#788).
function joinWithBase(url, baseUrl) {
	const safeUrl = url == null ? '' : url;
	const safeBase = baseUrl == null ? '' : String(baseUrl).replace(/\/+$/, '');
	return urlParse(safeBase + '/' + safeUrl.replace(/^\/+/, ''), {});
}

export function formatInnerLink(url, baseUrl) {
	let link = urlParse(url, {});

	if ('' === link.origin || 'null' === link.origin || !link.origin) {
		link = joinWithBase(url, baseUrl);
	}

	return link.toString();
}

export function formatMediaLink(url, baseUrl, token = null) {
	let link = urlParse(url, {});

	if ('' === link.origin || 'null' === link.origin || !link.origin) {
		link = joinWithBase(url, baseUrl);
	}

	// Add token parameter for restricted media
	if (token && token.trim() !== '') {
		const searchParams = new URLSearchParams(link.query);
		searchParams.set('token', token);
		link.set('query', searchParams.toString());
	}

	return link.toString();
}
