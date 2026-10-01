const RELATIVE_TIME_UNITS = [
	{ unit: 'year', seconds: 31536000 },
	{ unit: 'month', seconds: 2592000 },
	{ unit: 'day', seconds: 86400 },
	{ unit: 'hour', seconds: 3600 },
	{ unit: 'minute', seconds: 60 },
	{ unit: 'second', seconds: 1 },
];

export function formatRelativeTime(value, now = new Date()) {
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
