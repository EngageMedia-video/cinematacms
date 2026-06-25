export const EMPTY_PREVIEW = { title: '', company: '', media_country: '', category: '' };

export function todayIso() {
	const now = new Date();
	const month = String(now.getMonth() + 1).padStart(2, '0');
	const day = String(now.getDate()).padStart(2, '0');
	return `${now.getFullYear()}-${month}-${day}`;
}

export function diffInDays(startIso, endIso) {
	const start = new Date(startIso);
	const end = new Date(endIso);
	return Math.max(0, Math.ceil((end - start) / 86400000));
}

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

export function getUploadStatus(status) {
	const qqStatus = window.qq && window.qq.status;

	if (!qqStatus) {
		return 'uploading';
	}

	switch (status) {
		case qqStatus.UPLOAD_SUCCESSFUL:
			return 'complete';
		case qqStatus.UPLOAD_FAILED:
		case qqStatus.REJECTED:
			return 'failed';
		case qqStatus.PAUSED:
			return 'paused';
		default:
			return 'uploading';
	}
}

export function getStatusLabel(status) {
	switch (status) {
		case 'complete':
			return 'Complete';
		case 'failed':
			return 'Upload failed';
		case 'paused':
			return 'Paused';
		default:
			return 'Uploading';
	}
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
		editUrl,
		friendlyToken,
		name: fileName || '',
		viewUrl,
	};
}

export function updateUploadItemStatus(id, status, statusText) {
	const listEl = document.querySelector('.qq-file-id-' + id);
	const itemEl = listEl ? listEl.querySelector('.upload-media-item') : null;

	if (!itemEl) {
		return;
	}

	itemEl.setAttribute('data-upload-status', status);

	if (statusText) {
		const statusEl = itemEl.querySelector('.qq-upload-status-text-selector');

		if (statusEl) {
			statusEl.textContent = statusText;
		}
	}
}
