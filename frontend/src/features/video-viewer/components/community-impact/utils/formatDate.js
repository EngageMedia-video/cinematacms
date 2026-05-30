const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const FORMAT_OPTIONS = {
	month: 'short',
	day: 'numeric',
	year: 'numeric',
};

export function formatImpactDate(value) {
	if (!value) {
		return '';
	}

	if (DATE_ONLY.test(value)) {
		const [year, month, day] = value.split('-').map(Number);
		return new Intl.DateTimeFormat('en', FORMAT_OPTIONS).format(
			new Date(Date.UTC(year, month - 1, day))
		);
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('en', FORMAT_OPTIONS).format(date);
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

export function getSafeHref(value) {
	if (!value || typeof value !== 'string') {
		return null;
	}

	try {
		const url = new URL(value);
		return SAFE_PROTOCOLS.has(url.protocol) ? url.toString() : null;
	} catch {
		return null;
	}
}
