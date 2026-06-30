function parseJsonScript(id) {
	const element = document.getElementById(id);
	if (!element) return null;

	try {
		return JSON.parse(element.textContent);
	} catch {
		return null;
	}
}

export function readInitialDataFromDom() {
	return parseJsonScript('profile-initial-data');
}
