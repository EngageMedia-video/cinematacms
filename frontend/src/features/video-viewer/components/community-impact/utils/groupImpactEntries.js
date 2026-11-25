import { COMMUNITY_IMPACT_GROUPS } from '../impactIcons';

function entriesOf(value) {
	if (Array.isArray(value)) {
		return value;
	}

	return Array.isArray(value?.entries) ? value.entries : [];
}

// The year the impact happened. Legacy entries have no year, so they fall back to
// the year they were reported, as the server's ordering does.
export function impactYear(entry = {}) {
	if (entry.year) {
		return Number(entry.year);
	}

	const match = /^(\d{4})/.exec(entry.event_date || '');
	return match ? Number(match[1]) : null;
}

function newestFirst(a, b) {
	return (
		(impactYear(b) ?? 0) - (impactYear(a) ?? 0) ||
		String(b.event_date || '').localeCompare(String(a.event_date || ''))
	);
}

/**
 * The film page's impact groups that have entries, in display order. A group that
 * collects several stored categories lists their entries newest first.
 */
export function groupImpactEntries(impacts = {}) {
	return COMMUNITY_IMPACT_GROUPS.map((group) => ({
		...group,
		entries: group.categories
			.flatMap((category) =>
				entriesOf(impacts?.[category]).map((entry) => ({ ...entry, category: entry.category ?? category }))
			)
			.sort(newestFirst),
	})).filter((group) => group.entries.length > 0);
}

// Playlists that hold the film, and how many there are in all.
export function getImpactPlaylists(impacts = {}) {
	const saves = impacts?.saves ?? {};
	const playlists = Array.isArray(saves.playlists) ? saves.playlists : [];
	const total = Number(saves.totalCount?.playlists);

	return { playlists, count: Number.isFinite(total) && total > 0 ? total : playlists.length };
}
