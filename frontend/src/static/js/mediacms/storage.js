let STORAGE = null;

function normalizeScope(scope) {
	return scope === 'user' ? 'user' : 'site';
}

function normalizeBytes(value) {
	if (value === null || value === undefined || value === '') {
		return null;
	}
	const bytes = Number(value);
	return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

export function init(settings) {
	STORAGE = {
		scope: 'site',
		usedBytes: null,
	};

	if (void 0 !== settings && null !== settings) {
		STORAGE.scope = normalizeScope(settings.scope);
		STORAGE.usedBytes = normalizeBytes(settings.used_bytes);
	}
}

export function settings() {
	return STORAGE;
}
