import { describe, expect, it } from 'vitest';
import { buildImpactCards, sortImpactEntries } from './buildImpactCards';

function entry(title, fields = {}) {
	return { uid: title, title, ...fields };
}

describe('buildImpactCards', () => {
	it('builds the cards in display order with their design labels', () => {
		const cards = buildImpactCards({
			curated: [entry('Climate watchlist')],
			saves: { totalCount: { saves: 3, playlists: 2 }, lastEventAt: '2026-05-28T08:00:00Z' },
			teaching: [entry('Media and Climate Justice', { year: 2025 })],
			award: [entry('Best Documentary', { year: 2021 })],
			screening: [entry('Hanoi Doc Week', { year: 2024 })],
			article: [entry('A review', { year: 2023 })],
			referenced: [entry('Tide Lines', { year: 2022 })],
		});

		expect(cards.map((card) => [card.key, card.layout, card.label])).toEqual([
			['saves', 'summary', 'User Playlists'],
			['academic', 'summary', 'Academic Usage'],
			['award', 'summary', 'Awards'],
			['screening', 'list', 'Screenings'],
			['article', 'list', 'Reviews and Features'],
			['referenced', 'list', 'Referenced in Works'],
		]);
	});

	it('summarises counts the way the design words them', () => {
		const cards = buildImpactCards({
			saves: { totalCount: { saves: 181, playlists: 1 } },
			teaching: [entry('Course', { year: 2025 })],
			award: [entry('Prize A'), entry('Prize B'), entry('Prize C')],
		});
		const values = Object.fromEntries(cards.map((card) => [card.key, card.value]));

		expect(values).toEqual({
			saves: 'In 1 playlist',
			academic: 'Used in 1 class',
			award: '3 recognitions',
		});
	});

	it('hides Cinemata Curated Playlists until that feature is built', () => {
		const cards = buildImpactCards({
			curated: [entry('Climate watchlist'), entry('University library')],
			award: [entry('Best Documentary', { year: 2021 })],
		});

		expect(cards.map((card) => card.key)).toEqual(['award']);
	});

	it('merges teaching with old academic entries and articles with old features', () => {
		const cards = buildImpactCards({
			teaching: [entry('Course 2025', { year: 2025 })],
			academic: [entry('Legacy course', { event_date: '2024-03-01' })],
			article: [entry('Review 2021', { year: 2021 })],
			featured: [entry('Feature 2023', { event_date: '2023-07-15' })],
		});
		const byKey = Object.fromEntries(cards.map((card) => [card.key, card]));

		expect(byKey.academic.value).toBe('Used in 2 classes');
		expect(byKey.academic.entries.map((item) => item.title)).toEqual(['Course 2025', 'Legacy course']);
		expect(byKey.article.entries.map((item) => item.title)).toEqual(['Feature 2023', 'Review 2021']);
		expect(cards.map((card) => card.key)).not.toContain('featured');
		expect(cards.map((card) => card.key)).not.toContain('teaching');
	});

	it('keeps an older academic count that has no entries', () => {
		const [card] = buildImpactCards({
			academic: { label: 'University Courses', lastReportedAt: '2026-02-14', totalCount: 14 },
		});

		expect(card.key).toBe('academic');
		expect(card.value).toBe('Used in 14 classes');
		expect(card.entries[0].title).toBe('Used in 14 University Courses');
	});

	it('leaves out cards with nothing to show', () => {
		const cards = buildImpactCards({
			screening: [],
			saves: { totalCount: { saves: 0, playlists: 0 } },
			curated: { entries: [], totalCount: 0 },
			award: [entry('Only award', { year: 2020 })],
		});

		expect(cards.map((card) => card.key)).toEqual(['award']);
	});

	it('adds a one-line summary to entries for the detail dialog', () => {
		const [card] = buildImpactCards({
			screening: [
				entry('Hanoi Doc Week', {
					category: 'screening',
					year: 2024,
					city: 'Hanoi',
					country_label: 'Viet Nam',
				}),
			],
		});

		expect(card.entries[0].summary).toBe('Hanoi, Viet Nam');
	});
});

describe('sortImpactEntries', () => {
	it('orders by the impact year, falling back to the reported date for older entries', () => {
		const sorted = sortImpactEntries([
			entry('2019 screening', { year: 2019, date: '2026-06-01' }),
			entry('Legacy 2021', { date: '2021-03-03' }),
			entry('2024 screening', { year: 2024, date: '2026-05-01' }),
			entry('Legacy 2021 later', { date: '2021-09-09' }),
		]);

		expect(sorted.map((item) => item.title)).toEqual([
			'2024 screening',
			'Legacy 2021 later',
			'Legacy 2021',
			'2019 screening',
		]);
	});
});
