const YEAR_IN_MS = 365.25 * 24 * 60 * 60 * 1000;

export function getJoinedLabel(dateAdded, now = new Date()) {
	const joined = new Date(dateAdded);
	if (Number.isNaN(joined.getTime())) return '';

	const years = Math.floor((now.getTime() - joined.getTime()) / YEAR_IN_MS);
	if (years >= 1) {
		return `Member for ${years} ${years === 1 ? 'year' : 'years'}`;
	}

	return `Joined ${new Intl.DateTimeFormat(undefined, {
		month: 'short',
		year: 'numeric',
	}).format(joined)}`;
}
