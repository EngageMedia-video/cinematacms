export const EMPTY_PREVIEW = { title: '', company: '', media_country: '', category: '' };

export function findLabel(options = [], value) {
	const option = options.find((item) => String(item.value ?? item.code) === String(value));
	return option?.label || option?.title || '';
}

export function toCodeOptions(items = []) {
	return items.map((item) => ({ value: item.code, label: item.title }));
}

export function toIdOptions(items = []) {
	return items.map((item) => ({ value: item.id, label: item.title }));
}

export function getAddMediaConfig() {
	return (window.MediaCMS && window.MediaCMS.addMediaPage) || {};
}

export function getCSRFToken() {
	let cookieVal = null;

	if (document.cookie && '' !== document.cookie) {
		const cookies = document.cookie.split(';');
		let i = 0;

		while (i < cookies.length) {
			const cookie = cookies[i].trim();

			if ('csrftoken=' === cookie.substring(0, 10)) {
				cookieVal = decodeURIComponent(cookie.substring(10));
				break;
			}

			i += 1;
		}
	}

	return cookieVal;
}

export function getUploadedMediaDetails(response, fileName) {
	const viewUrl = response && response.media_url ? response.media_url : '';
	const editUrl = viewUrl ? viewUrl.replace('/view?', '/edit?') : '';
	let friendlyToken = '';

	if (viewUrl) {
		try {
			const parsedUrl = new URL(viewUrl, window.location.origin);
			friendlyToken = parsedUrl.searchParams.get('m') || '';
		} catch (_error) {
			const match = viewUrl.match(/[?&]m=([^&]+)/);
			friendlyToken = match ? decodeURIComponent(match[1]) : '';
		}
	}

	return {
		duration: response?.duration ?? '',
		editUrl,
		friendlyToken,
		name: fileName || '',
		posterUrl: response?.poster_url ?? '',
		spritesUrl: response?.sprites_url ?? '',
		spriteNumSecs: response?.sprite_num_secs ?? '',
		thumbnailTime: response?.thumbnail_time ?? '',
		viewUrl,
	};
}
