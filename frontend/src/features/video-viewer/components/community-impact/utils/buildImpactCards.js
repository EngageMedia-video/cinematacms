import { COMMUNITY_IMPACT_CARDS, getImpactIconConfig } from '../impactIcons';
import { describeImpactEntry } from './describeImpactEntry';

export const LIST_CARD_PREVIEW_COUNT = 2;

function normalizeEntry(entry) {
	return {
		...entry,
		date: entry.date || entry.event_date,
		summary: entry.summary ?? describeImpactEntry(entry),
		title: entry.title || entry.location || '',
		url: entry.url || entry.link || '',
	};
}

// The API sends a list per category; saves (and older academic data) arrive as a
// summary object with counts instead.
function normalizeCategory(data = {}) {
	if (Array.isArray(data)) {
		return { entries: data.map(normalizeEntry), totalCount: data.length };
	}

	const entries = Array.isArray(data.entries) ? data.entries.map(normalizeEntry) : [];
	return { ...data, entries, totalCount: data.totalCount ?? entries.length };
}

function countOf(totalCount) {
	if (typeof totalCount === 'number') {
		return totalCount;
	}

	if (totalCount && typeof totalCount === 'object') {
		return Object.values(totalCount).reduce((sum, value) => sum + (Number(value) || 0), 0);
	}

	return 0;
}

function impactYear(entry) {
	if (entry.year) {
		return entry.year;
	}

	const year = Number.parseInt(String(entry.date || '').slice(0, 4), 10);
	return Number.isNaN(year) ? -Infinity : year;
}

// Matches the API's newest-impact-first order, so entries merged from two
// categories interleave the same way a single category does.
export function sortImpactEntries(entries) {
	return [...entries].sort(
		(a, b) => impactYear(b) - impactYear(a) || String(b.date || '').localeCompare(String(a.date || ''))
	);
}

function savesSummaryEntry({ lastEventAt, totalCount }) {
	const saves = typeof totalCount === 'object' ? Number(totalCount?.saves) || 0 : Number(totalCount) || 0;
	const playlists = typeof totalCount === 'object' ? Number(totalCount?.playlists) || 0 : 0;

	return {
		date: lastEventAt,
		dateLabel: 'Last Saved',
		title: playlists
			? `${saves.toLocaleString()} saves in ${playlists.toLocaleString()} playlists`
			: `${saves.toLocaleString()} community saves and playlists`,
		titleParts: playlists
			? [
					{ text: saves.toLocaleString(), accent: true },
					' saves in ',
					{ text: playlists.toLocaleString(), accent: true },
					' playlists',
				]
			: [{ text: saves.toLocaleString(), accent: true }, ' community saves and playlists'],
		url: '',
	};
}

function reportedSummaryEntry({ label, lastReportedAt, totalCount }) {
	const count = Number(totalCount) || 0;

	return {
		date: lastReportedAt,
		dateLabel: 'Last Reported',
		title: `Used in ${count.toLocaleString()} ${label || 'academic contexts'}`,
		titleParts: ['Used in ', { text: count.toLocaleString(), accent: true }, ` ${label || 'academic contexts'}`],
		url: '',
	};
}

function buildCard(card, groups) {
	const sources = card.categories.map((category) => normalizeCategory(groups[category] ?? {}));
	const entries = sortImpactEntries(sources.flatMap((source) => source.entries));
	const config = getImpactIconConfig(card.key);
	const base = {
		key: card.key,
		layout: card.layout,
		label: config.label,
		iconName: config.iconName,
		iconShellClassName: config.iconShellClassName,
	};

	if (card.key === 'saves') {
		const [saves] = sources;
		const playlists = typeof saves.totalCount === 'object' ? Number(saves.totalCount?.playlists) || 0 : 0;
		const value = card.describe(playlists || countOf(saves.totalCount));
		return {
			...base,
			count: countOf(saves.totalCount),
			value,
			subtitle: value,
			entries: [savesSummaryEntry(saves)],
		};
	}

	// Older academic data is a bare count; show it the way the card did before.
	const summaryOnly = sources.filter((source) => !source.entries.length && countOf(source.totalCount) > 0);
	const count = entries.length + summaryOnly.reduce((sum, source) => sum + countOf(source.totalCount), 0);
	const value = card.describe(count);

	return {
		...base,
		count,
		value,
		subtitle: value,
		entries: [...entries, ...summaryOnly.map(reportedSummaryEntry)],
	};
}

// Turns the API's per-category groups into the cards shown on the film page, in
// display order, leaving out cards with nothing to show.
export function buildImpactCards(groups = {}) {
	return COMMUNITY_IMPACT_CARDS.map((card) => buildCard(card, groups)).filter((card) => card.count > 0);
}
