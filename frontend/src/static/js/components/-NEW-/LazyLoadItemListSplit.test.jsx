import { describe, expect, it, vi } from 'vitest';

vi.mock('./hooks/useItemListLazyLoad', () => ({
	useItemListLazyLoad: vi.fn(),
}));

vi.mock('../../pages/_PageStore.js', () => ({
	default: {
		on: vi.fn(),
		removeListener: vi.fn(),
	},
}));

vi.mock('./PendingItemsList', () => ({
	PendingItemsList: () => null,
}));

vi.mock('./ListItem', () => ({
	ListItem: () => null,
	listItemProps: vi.fn(() => ({})),
}));

vi.mock('./includes/itemLists/ItemsListHandler', () => ({
	ItemsListHandler: vi.fn(),
}));

vi.mock('./ItemListAsync', () => ({
	ItemListAsync: {
		propTypes: {},
		defaults: {
			maxItems: 99999,
			pageItems: 24,
		},
	},
}));

import { ItemListAsync } from './ItemListAsync';
import { LazyLoadItemListSplit } from './LazyLoadItemListSplit';

describe('LazyLoadItemListSplit defaults', () => {
	it('inherits the shared async list page size', () => {
		expect(LazyLoadItemListSplit.defaults.pageItems).toBe(ItemListAsync.defaults.pageItems);
	});
});
