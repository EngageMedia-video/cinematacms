import '../../../static/css/tailwind.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import searchQueryClient from '../queryClient';
import { DEFAULT_SORT, SEARCH_PAGE_SIZE } from '../constants';
import { useMediaSearch, hasActiveSearch } from '../hooks/useMediaSearch';
import { useSearchFilterOptions } from '../hooks/useSearchFilterOptions';
import {
	buildBrowserSearch,
	clearFilterValue,
	createEmptyFilters,
	parseSearchState,
	toggleFilterValue,
} from '../searchState';
import { Button } from '../../shared/components/Button';
import { Icon } from '../../shared/components/Icon';
import { HorizontalMovieItem } from '../../shared/components/MovieItem/MovieItem';
import { getMediaDurationLabel } from '../../home/utils/mediaList';
import { FilterPanel } from './FilterPanel';
import { MobileFilterSheet } from './MobileFilterSheet';
import { SelectedFilters } from './SelectedFilters';

function buildSections(filters, sort, filterOptionSections) {
	return [
		{
			key: 'category',
			label: 'Category',
			selectMode: 'multi',
			selectedValues: filters.category,
			options: filterOptionSections.category,
		},
		{
			key: 'topic',
			label: 'Topic',
			selectMode: 'multi',
			selectedValues: filters.topic,
			options: filterOptionSections.topic,
		},
		{
			key: 'subtitle_language',
			label: 'Subtitle Language',
			selectMode: 'multi',
			selectedValues: filters.subtitle_language,
			options: filterOptionSections.subtitle_language,
		},
		{
			key: 'country',
			label: 'Country of Origin',
			selectMode: 'multi',
			selectedValues: filters.country,
			options: filterOptionSections.country,
		},
		{
			key: 'length',
			label: 'Length',
			selectMode: 'single',
			selectedValues: filters.length,
			options: filterOptionSections.length,
		},
		{
			key: 'upload_date',
			label: 'Upload Date',
			selectMode: 'single',
			selectedValues: filters.upload_date,
			options: filterOptionSections.upload_date,
		},
		{
			key: 'sort',
			label: 'Popularity',
			selectMode: 'single',
			selectedValues: sort.popularity,
			options: filterOptionSections.sort,
		},
		{
			key: 'license',
			label: 'License',
			selectMode: 'multi',
			selectedValues: filters.license,
			options: filterOptionSections.license,
		},
		{
			key: 'community_impact',
			label: 'Community Impact',
			selectMode: 'multi',
			selectedValues: filters.community_impact,
			options: filterOptionSections.community_impact,
		},
	];
}

const DEFAULT_CATEGORY_COLOR = 'bg/primary';

function getInitialState() {
	if (typeof window === 'undefined') {
		return {
			filters: createEmptyFilters(),
			page: 1,
			query: '',
			sort: DEFAULT_SORT,
		};
	}

	return parseSearchState(window.location.search);
}

function getSelectedLabel(options, value) {
	return options.find((option) => option.value === value)?.label || value;
}

function buildSelectedFilters(filters, sections) {
	const selectedFilters = [];
	const filterSections = [
		['category', sections.category],
		['topic', sections.topic],
		['country', sections.country],
		['subtitle_language', sections.subtitle_language],
		['license', sections.license],
		['community_impact', sections.community_impact],
		['length', sections.length],
		['upload_date', sections.upload_date],
	];

	for (const [key, options] of filterSections) {
		const value = filters[key];
		const values = Array.isArray(value) ? value : value ? [value] : [];
		for (const selectedValue of values) {
			selectedFilters.push({
				key,
				value: selectedValue,
				label: getSelectedLabel(options, selectedValue),
			});
		}
	}

	return selectedFilters;
}

function getAuthorName(item) {
	return item.author_name || item.user || '';
}

function getAuthorLink(item) {
	return item.author_profile || '';
}

function getCountryNames(item) {
	if (Array.isArray(item.media_country_info)) {
		const countries = item.media_country_info.map((country) => country?.title).filter(Boolean);
		return countries.length ? countries : [item.media_country].filter(Boolean);
	}

	if (item.media_country_info?.title) {
		return [item.media_country_info.title];
	}

	return [item.media_country].filter(Boolean);
}

function SearchResultItem({ item }) {
	const categories = Array.isArray(item.categories_info) ? item.categories_info : [];
	const firstCategory = categories[0];
	const metadata = [
		...getCountryNames(item),
		item.views != null ? `${Number(item.views).toLocaleString()} views` : null,
	];

	return (
		<HorizontalMovieItem
			title={item.title}
			imageSrc={item.thumbnail_url}
			link={item.url}
			duration={getMediaDurationLabel(item)}
			subtitle={getAuthorName(item)}
			subtitleLink={getAuthorLink(item)}
			metadata={metadata}
			badge={firstCategory?.title || ''}
			badgeColor={firstCategory?.color || DEFAULT_CATEGORY_COLOR}
			posterClassName="aspect-video w-[120px] sm:w-[220px]"
		/>
	);
}

function SearchSortButton({ sort, onToggle }) {
	const isAsc = sort.ordering === 'asc';
	const label = isAsc ? 'A–Z' : 'Z–A';
	const disabled = Boolean(sort.popularity);

	return (
		<button
			type="button"
			className="inline-flex h-9 cursor-pointer appearance-none items-center justify-center gap-2 rounded-[4px] border-0 bg-bg-filter-sort px-3 py-2 font-sans text-[12px] leading-4 font-medium text-text-filter-sort uppercase shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
			style={{ appearance: 'none', border: 0, boxShadow: 'none' }}
			onClick={onToggle}
			disabled={disabled}
			aria-label={disabled ? 'Sort by title (disabled while popularity sort is active)' : `Sort ${label}`}
		>
			<Icon name="sortArrows" size={20} decorative />
			<span>{label}</span>
		</button>
	);
}

function Pagination({ count = 0, page, pageSize, onPageChange }) {
	const totalPages = Math.max(1, Math.ceil(count / pageSize));

	if (totalPages <= 1) {
		return null;
	}

	return (
		<nav className="mt-8 flex items-center justify-center gap-3" aria-label="Search pagination">
			<Button variant="secondary-outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
				Previous
			</Button>
			<span className="text-[14px] leading-5 text-text-muted">
				Page {page} of {totalPages}
			</span>
			<Button variant="secondary-outline" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
				Next
			</Button>
		</nav>
	);
}

function SearchPageContent() {
	const initialState = useMemo(getInitialState, []);
	const [query, setQuery] = useState(initialState.query);
	const [filters, setFilters] = useState(initialState.filters);
	const [sort, setSort] = useState(initialState.sort);
	const [page, setPage] = useState(initialState.page);
	const filterOptions = useSearchFilterOptions();
	const search = useMediaSearch({ filters, page, query, sort });
	const activeSearch = hasActiveSearch({ filters, query });
	const results = search.data?.results ?? [];
	const count = search.data?.count ?? 0;

	useEffect(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const browserSearch = buildBrowserSearch({ filters, page, query, sort });
		const target = browserSearch.startsWith('?') ? `${window.location.pathname}${browserSearch}` : browserSearch;
		const current = `${window.location.pathname}${window.location.search}`;

		if (target !== current) {
			window.history.replaceState(null, '', target);
		}
	}, [filters, page, query, sort]);

	useEffect(() => {
		function handlePopState() {
			const nextState = parseSearchState(window.location.search);
			setQuery(nextState.query);
			setFilters(nextState.filters);
			setSort(nextState.sort);
			setPage(nextState.page);
		}

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	const sections = useMemo(
		() => buildSections(filters, sort, filterOptions.sections),
		[filterOptions.sections, filters, sort]
	);

	const selectedFilters = useMemo(
		() => buildSelectedFilters(filters, filterOptions.sections),
		[filters, filterOptions.sections]
	);

	function handleSectionChange(key, value, checked) {
		if (key === 'sort') {
			setSort((currentSort) => ({
				...currentSort,
				popularity: checked ? value : null,
			}));
			setPage(1);
			return;
		}

		setFilters((currentFilters) => toggleFilterValue(currentFilters, key, value, checked));
		setPage(1);
	}

	function handleClearAll() {
		setFilters(createEmptyFilters());
		setSort(DEFAULT_SORT);
		setPage(1);
	}

	function handleDismiss(filter) {
		setFilters((currentFilters) => clearFilterValue(currentFilters, filter.key, filter.value));
		setPage(1);
	}

	function handleSortToggle() {
		setSort((currentSort) => ({
			...currentSort,
			ordering: currentSort.ordering === 'asc' ? 'desc' : 'asc',
		}));
		setPage(1);
	}

	const trimmedQuery = query.trim();
	const resultsLabel =
		activeSearch && !search.isLoading
			? `${count.toLocaleString()} result${count === 1 ? '' : 's'}${trimmedQuery ? ` for ${trimmedQuery}` : ''}`
			: 'Select filters to browse videos';

	return (
		<div
			data-modern-track
			className="mx-auto min-h-screen w-full max-w-[1515px] overflow-x-hidden px-4 py-6 text-text-primary sm:px-[27px]"
		>
			<header className="mb-6 flex max-w-[760px] flex-col gap-2">
				<h1 className="m-0 font-['Barlow_Semi_Condensed',Arial,sans-serif] text-[24px] leading-[30px] font-medium text-text-primary">
					Search
				</h1>
				<p className="m-0 font-sans text-[16px] leading-6 text-text-muted">
					Narrow your results by topic, country, language, duration, and more using the filters panel.
				</p>
			</header>

			<div className="grid gap-8 sm:grid-cols-[317px_minmax(0,1fr)]">
				<div className="max-sm:hidden">
					<div className="sticky top-[calc(var(--header-height,90px)+16px)]">
						<FilterPanel
							sections={sections}
							onReset={handleClearAll}
							onSectionChange={handleSectionChange}
						/>
					</div>
				</div>

				<main className="flex min-w-0 flex-col gap-6">
					<div className="flex flex-col gap-4">
						<div className="sm:hidden">
							<MobileFilterSheet
								filters={filters}
								sort={sort}
								filterOptionSections={filterOptions.sections}
								onReset={handleClearAll}
								onSave={(pendingFilters, pendingSort) => {
									setFilters(pendingFilters);
									setSort(pendingSort);
									setPage(1);
								}}
							/>
						</div>
						<SelectedFilters
							filters={selectedFilters}
							onDismiss={handleDismiss}
							onClearAll={handleClearAll}
						/>
					</div>

					<section className="rounded-[8px] bg-bg-filter-panel px-4 py-6 sm:p-6">
						<div className="mb-6 flex items-center justify-between gap-3">
							<p className="m-0 font-sans text-[14px] leading-5 text-text-primary">{resultsLabel}</p>
							<SearchSortButton sort={sort} onToggle={handleSortToggle} />
						</div>

						{filterOptions.isError ? (
							<p className="mb-4 text-[12px] leading-4 text-text-danger">
								Some filter options could not load.
							</p>
						) : null}

						{search.isLoading || filterOptions.isLoading ? (
							<div className="grid gap-x-8 gap-y-6 xl:grid-cols-2" aria-label="Loading results">
								{Array.from({ length: 8 }, (_, index) => (
									<div key={index} className="h-[102px] animate-pulse rounded-[6px] bg-bg-skeleton" />
								))}
							</div>
						) : null}

						{activeSearch && search.isError ? (
							<div className="rounded-[4px] border border-border-danger bg-bg-surface p-4 text-text-danger">
								Search results could not load.
							</div>
						) : null}

						{activeSearch && !search.isLoading && !search.isError && results.length === 0 ? (
							<div className="rounded-[4px] border border-border-filter-divider bg-bg-surface p-6 text-text-muted">
								No results match these filters.
							</div>
						) : null}

						{activeSearch && results.length ? (
							<>
								<div className="grid gap-x-8 gap-y-6 xl:grid-cols-2">
									{results.map((item) => (
										<SearchResultItem key={item.friendly_token || item.url} item={item} />
									))}
								</div>
								<Pagination
									count={count}
									page={page}
									pageSize={SEARCH_PAGE_SIZE}
									onPageChange={setPage}
								/>
							</>
						) : null}
					</section>
				</main>
			</div>
		</div>
	);
}

export function SearchPage() {
	return (
		<QueryClientProvider client={searchQueryClient}>
			<SearchPageContent />
		</QueryClientProvider>
	);
}
