function parseJsonScript(id) {
	const element = document.getElementById(id);
	if (!element) {
		throw new Error(`Profile bootstrap failed: no element with id "${id}" found in the DOM.`);
	}

	try {
		return JSON.parse(element.textContent);
	} catch (error) {
		throw new Error(`Profile bootstrap failed: invalid JSON in #${id}: ${error.message}`);
	}
}

export function readInitialDataFromDom() {
	return parseJsonScript('profile-initial-data');
}
