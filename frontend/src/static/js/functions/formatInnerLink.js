import urlParse from 'url-parse';

export function formatInnerLink( url, baseUrl ){

	let link = urlParse( url, {} );

	if( '' === link.origin || 'null' === link.origin || ! link.origin ){
		const safeUrl = (url == null) ? '' : url;
		link = urlParse( baseUrl + '/' + safeUrl.replace(/^\/+/, ''), {} );
	}

	return link.toString();
}

export function formatMediaLink( url, baseUrl, password = null ){
	let link = urlParse( url, {} );

	if( '' === link.origin || 'null' === link.origin || ! link.origin ){
		const safeUrl = (url == null) ? '' : url;
		link = urlParse( baseUrl + '/' + safeUrl.replace(/^\/+/, ''), {} );
	}

	// Add password parameter for restricted media
	if( password && password.trim() !== '' ){
		const searchParams = new URLSearchParams(link.query);
		searchParams.set('password', password);
		link.set('query', searchParams.toString());
	}

	return link.toString();
}
