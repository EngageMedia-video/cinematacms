/**
 * Read server-injected initial data from json_script elements in the DOM.
 * Returns available home data, or null if all tags are absent.
 * Each block is parsed independently so one malformed payload does not discard the other.
 */
import { HOME_QUERY_KEYS } from './queryClient';

function parseJsonScript(id) {
	const el = document.getElementById(id);
	if (!el) {
		return undefined;
	}

	try {
		return JSON.parse(el.textContent);
	} catch {
		return undefined;
	}
}

export function readInitialDataFromDom() {
	const featured = parseJsonScript('home-initial-data-featured');
	const indexFeatured = parseJsonScript('home-initial-data-index-featured');

	if (featured === undefined && indexFeatured === undefined) {
		return null;
	}

	return { featured, indexFeatured };
}

function isMediaListPayload(value) {
	return Array.isArray(value) || Array.isArray(value?.results);
}

export function seedHomeInitialData(queryClient, initialData) {
	if (isMediaListPayload(initialData?.featured)) {
		queryClient.setQueryData(HOME_QUERY_KEYS.featured, initialData.featured);
	}
	if (Array.isArray(initialData?.indexFeatured)) {
		queryClient.setQueryData(HOME_QUERY_KEYS.indexFeatured, initialData.indexFeatured);
	}
}
