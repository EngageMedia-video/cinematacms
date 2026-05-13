/**
 * Read server-injected initial data from json_script elements in the DOM.
 * Returns available { featured, recommended } data, or null if both tags are absent.
 * Each block is parsed independently so one malformed payload does not discard the other.
 */
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
	const recommended = parseJsonScript('home-initial-data-recommended');

	if (featured === undefined && recommended === undefined) {
		return null;
	}

	return { featured, recommended };
}
