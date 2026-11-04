// Stored originals are named "<media uid hex>.<uploaded name>" (files/models.py original_media_file_path).
const STORAGE_UID_PREFIX = /^[0-9a-f]{32}\./;

function urlFileExtension(url) {
	const path = url.split(/[?#]/)[0];
	const fileName = path.slice(path.lastIndexOf('/') + 1).replace(STORAGE_UID_PREFIX, '');
	const dotIndex = fileName.lastIndexOf('.');
	return 0 < dotIndex ? fileName.slice(dotIndex) : '';
}

// The browser saves a `download` name as given, so a title without the
// file's extension leaves local players unable to recognise the file.
export function originalDownloadFilename(title, originalUrl) {
	const extension = originalUrl ? urlFileExtension(originalUrl) : '';
	if (!extension || title.toLowerCase().endsWith(extension.toLowerCase())) {
		return title;
	}
	return title + extension;
}
