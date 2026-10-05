import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchMediaFiltersRow } from './SearchMediaFiltersRow';
import { SearchResultsFilters } from './SearchResultsFilters';

vi.mock('./hooks/usePopup', async () => {
	const { useRef } = await import('react');
	const Content = ({ children }) => children;
	return { usePopup: () => [useRef({ tryToHide() {} }), Content, Content] };
});
vi.mock('./Popup', () => ({ PopupMain: ({ children }) => children }));
vi.mock('../../pages/_PageStore.js', () => ({
	default: { get: () => ({ taxonomies: {}, pages: { search: {} } }), on: vi.fn(), removeListener: vi.fn() },
}));
vi.mock('../../contexts/LinksContext', async () => {
	const { createContext } = await import('react');
	return { default: createContext({ archive: {} }) };
});

afterEach(() => {
	delete window.CinemataAnalytics;
});

describe('legacy search controls', () => {
	it('counts only a changed filter or sort, excluding mount effects and repeated selections', () => {
		window.CinemataAnalytics = { track: vi.fn() };
		render(<SearchMediaFiltersRow onFiltersUpdate={vi.fn()} />);
		expect(window.CinemataAnalytics.track).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Video', exact: true }));
		fireEvent.click(screen.getByRole('button', { name: 'All media types', exact: true }));
		fireEvent.click(screen.getByRole('button', { name: 'Like count', exact: true }));
		fireEvent.click(screen.getByRole('button', { name: 'Like count', exact: true }));
		expect(window.CinemataAnalytics.track.mock.calls).toEqual([
			['search_filter_apply'],
			['search_filter_reset'],
			['search_sort_change'],
		]);
	});
	it('distinguishes sort and reset on advanced filters without sending filter values', () => {
		window.CinemataAnalytics = { track: vi.fn() };
		render(<SearchResultsFilters onFiltersUpdate={vi.fn()} />);
		expect(window.CinemataAnalytics.track).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('Video', { exact: true }));
		fireEvent.click(screen.getAllByText('All', { exact: true })[0]);
		fireEvent.click(screen.getByText('View count', { exact: true }));
		fireEvent.click(screen.getByText('View count', { exact: true }));
		expect(window.CinemataAnalytics.track.mock.calls).toEqual([
			['search_filter_apply'],
			['search_filter_reset'],
			['search_sort_change'],
		]);
	});
});
