/**
 * Read server-injected initial data from json_script elements in the DOM.
 * Returns { featured, recommended } or null if either tag is absent or malformed.
 * On parse error, degrades gracefully so the app falls back to client-side fetch.
 */
export function readInitialDataFromDom() {
	try {
		const featuredEl = document.getElementById('home-initial-data-featured');
		const recommendedEl = document.getElementById('home-initial-data-recommended');

		if (!featuredEl || !recommendedEl) {
			return null;
		}

		const featured = JSON.parse(featuredEl.textContent);
		const recommended = JSON.parse(recommendedEl.textContent);

		return { featured, recommended };
	} catch {
		return null;
	}
}
