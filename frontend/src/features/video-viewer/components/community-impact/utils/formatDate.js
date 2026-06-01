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
		return new Intl.DateTimeFormat('en', FORMAT_OPTIONS).format(new Date(Date.UTC(year, month - 1, day)));
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('en', FORMAT_OPTIONS).format(date);
}

const RELATIVE_TIME_UNITS = [
	{ unit: 'year', seconds: 31536000 },
	{ unit: 'month', seconds: 2592000 },
	{ unit: 'day', seconds: 86400 },
	{ unit: 'hour', seconds: 3600 },
	{ unit: 'minute', seconds: 60 },
	{ unit: 'second', seconds: 1 },
];

export function formatRelativeImpactTime(value, now = new Date()) {
	if (!value) {
		return '';
	}

	const date = new Date(value);
	const referenceDate = now instanceof Date ? now : new Date(now);

	if (Number.isNaN(date.getTime()) || Number.isNaN(referenceDate.getTime())) {
		return '';
	}

	const diffInSeconds = (date.getTime() - referenceDate.getTime()) / 1000;
	const absDiffInSeconds = Math.abs(diffInSeconds);
	const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
	const { unit, seconds } =
		RELATIVE_TIME_UNITS.find((candidate) => absDiffInSeconds >= candidate.seconds) ??
		RELATIVE_TIME_UNITS[RELATIVE_TIME_UNITS.length - 1];

	return formatter.format(Math.round(diffInSeconds / seconds), unit);
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
