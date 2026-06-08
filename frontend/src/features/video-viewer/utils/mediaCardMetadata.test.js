import { describe, expect, it } from 'vitest';

import { DEFAULT_CATEGORY_COLOR, getCategoryBadge } from './mediaCardMetadata';

describe('getCategoryBadge', () => {
	it('returns the first category title and color', () => {
		const result = getCategoryBadge({
			categories_info: [
				{ title: 'Documentary', color: 'bg/secondary' },
				{ title: 'Experimental', color: 'bg/primary' },
			],
		});

		expect(result).toEqual({ badge: 'Documentary', badgeColor: 'bg/secondary' });
	});

	it('falls back to the default color when the category has no color', () => {
		const result = getCategoryBadge({ categories_info: [{ title: 'News' }] });

		expect(result).toEqual({ badge: 'News', badgeColor: DEFAULT_CATEGORY_COLOR });
	});

	it('returns an empty badge when there are no categories', () => {
		expect(getCategoryBadge({})).toEqual({ badge: '', badgeColor: DEFAULT_CATEGORY_COLOR });
		expect(getCategoryBadge({ categories_info: [] })).toEqual({ badge: '', badgeColor: DEFAULT_CATEGORY_COLOR });
		expect(getCategoryBadge({ categories_info: null })).toEqual({ badge: '', badgeColor: DEFAULT_CATEGORY_COLOR });
	});
});
