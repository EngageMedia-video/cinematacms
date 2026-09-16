import { buildMediaSearchUrl, hasActiveSearch } from './useMediaSearch';

describe('useMediaSearch helpers', () => {
	it('repeats multi-select params and includes sort direction', () => {
		const url = buildMediaSearchUrl({
			query: 'labor',
			page: 2,
			filters: {
				country: ['Philippines', 'Indonesia'],
				community_impact: ['saves'],
				category: [],
				topic: [],
				subtitle_language: [],
				license: ['no_license'],
				length: 'less_than_10',
				upload_date: '',
			},
			sort: { popularity: 'views', ordering: 'asc' },
		});

		expect(url).toContain('q=labor');
		expect(url).toContain('country=Philippines&country=Indonesia');
		expect(url).toContain('community_impact=saves');
		expect(url).toContain('license=no_license');
		expect(url).toContain('length=less_than_10');
		expect(url).toContain('sort_by=views');
		expect(url).toContain('ordering=desc');
		expect(url).toContain('page=2');
	});

	it('omits sort params for a query with no chosen sort so the API ranks by relevance', () => {
		const url = buildMediaSearchUrl({ query: 'the train' });

		expect(url).toContain('q=the+train');
		expect(url).not.toContain('sort_by=');
		expect(url).not.toContain('ordering=');
	});

	it('keeps A-Z for filter-only browsing when no sort is chosen', () => {
		const url = buildMediaSearchUrl({ filters: { country: ['Philippines'] } });

		expect(url).toContain('sort_by=title');
		expect(url).toContain('ordering=asc');
	});

	it('sends an explicitly chosen title order even with a query', () => {
		const url = buildMediaSearchUrl({ query: 'the train', sort: { popularity: null, ordering: 'asc' } });

		expect(url).toContain('sort_by=title');
		expect(url).toContain('ordering=asc');
	});

	it('detects active searches from query text or filters', () => {
		expect(hasActiveSearch({ query: '', filters: { country: [] } })).toBe(false);
		expect(hasActiveSearch({ query: 'rights', filters: { country: [] } })).toBe(true);
		expect(hasActiveSearch({ query: '', filters: { country: ['Philippines'] } })).toBe(true);
	});
});
