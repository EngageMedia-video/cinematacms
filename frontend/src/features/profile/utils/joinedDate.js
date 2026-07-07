function toDateOnly(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getCalendarYearsElapsed(joined, now) {
	let years = now.getFullYear() - joined.getFullYear();
	const anniversaryThisYear = new Date(joined.getFullYear() + years, joined.getMonth(), joined.getDate());
	if (anniversaryThisYear.getTime() > toDateOnly(now).getTime()) {
		years -= 1;
	}
	return years;
}

export function getJoinedLabel(dateAdded, now = new Date()) {
	const joined = new Date(dateAdded);
	if (Number.isNaN(joined.getTime())) return '';

	const years = getCalendarYearsElapsed(joined, now);
	if (years >= 1) {
		return `Member for ${years} ${years === 1 ? 'year' : 'years'}`;
	}

	return `Joined ${new Intl.DateTimeFormat(undefined, {
		month: 'short',
		year: 'numeric',
	}).format(joined)}`;
}
