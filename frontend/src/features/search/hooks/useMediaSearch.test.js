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

	it('detects active searches from query text or filters', () => {
		expect(hasActiveSearch({ query: '', filters: { country: [] } })).toBe(false);
		expect(hasActiveSearch({ query: 'rights', filters: { country: [] } })).toBe(true);
		expect(hasActiveSearch({ query: '', filters: { country: ['Philippines'] } })).toBe(true);
	});
});
