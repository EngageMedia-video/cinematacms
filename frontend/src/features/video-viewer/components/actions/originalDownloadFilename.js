function urlFileExtension(url) {
	const path = url.split(/[?#]/)[0];
	const fileName = path.slice(path.lastIndexOf('/') + 1);
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
