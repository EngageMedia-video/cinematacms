import urlParse from 'url-parse';

let BASE_URL = null;
let ENDPOINTS = null;

function endpointsIter(ret, endpoints) {
	const baseUrl = BASE_URL.toString().replace(/\/+$/, "");

	for (let k in endpoints) {
		if ("string" === typeof endpoints[k]) {
			ret[k] = baseUrl + "/" + endpoints[k].replace(/^\//g, "");
		} else {
			endpointsIter(ret[k], endpoints[k]);
		}
	}
}

function formatEndpoints(endpoints) {
	const baseUrl = BASE_URL.toString();
	const ret = endpoints;
	endpointsIter(ret, endpoints);
	return ret;
}

export function init(base_url, endpoints) {
	BASE_URL = urlParse(base_url);

	ENDPOINTS = formatEndpoints({
		media: endpoints.media,
		featured: endpoints.media + "?show=featured",
		recommended: endpoints.media + "?show=recommended",
		playlists: endpoints.playlists,
		users: endpoints.members,
		topmessage: "topmessage",
		homepagepopup: "homepagepopup",
		indexfeatured: "indexfeatured",
		user: {
			liked: endpoints.liked,
			history: endpoints.history,
			playlists: endpoints.playlists + "?author=",
		},
		archive: {
			tags: endpoints.tags,
			categories: endpoints.categories,
			topics: endpoints.topics,
			countries: endpoints.countries,
			languages: endpoints.languages,
		},
		manage: {
			media: endpoints.manage_media,
			users: endpoints.manage_users,
			comments: endpoints.manage_comments,
		},
		search: {
			query: endpoints.search + "?q=",
			titles: endpoints.search + "?show=titles&q=",
			tag: endpoints.search + "?t=",
			category: endpoints.search + "?c=",
			topic: endpoints.search + "?topic=",
			country: endpoints.search + "?country=",
			language: endpoints.search + "?language=",
		},
	});
}

export function endpoints() {
	return ENDPOINTS;
}
