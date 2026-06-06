import PropTypes from 'prop-types';
import { useState } from 'react';
import { DEFAULT_SORT } from '../constants';
import { createEmptyFilters, toggleFilterValue } from '../searchState';
import { Dialog } from '../../shared/components/Dialog';
import { Icon } from '../../shared/components/Icon';
import { FilterPanel } from './FilterPanel';

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

function MobileFilterSheetContent({ filters, sort, filterOptionSections, onReset, onSave, onClose }) {
	const [localFilters, setLocalFilters] = useState(filters);
	const [localSort, setLocalSort] = useState(sort);

	function handleSectionChange(key, value, checked) {
		if (key === 'sort') {
			setLocalSort((current) => ({
				...current,
				popularity: checked ? value : null,
			}));
			return;
		}
		setLocalFilters((current) => toggleFilterValue(current, key, value, checked));
	}

	function handleReset() {
		setLocalFilters(createEmptyFilters());
		setLocalSort(DEFAULT_SORT);
		onReset();
	}

	function handleSave() {
		onSave(localFilters, localSort);
		onClose();
	}

	function handleCancel() {
		onClose();
	}

	const sections = buildSections(localFilters, localSort, filterOptionSections);

	return (
		<>
			<div className="flex-1 overflow-y-auto p-3">
				<FilterPanel sections={sections} onReset={handleReset} onSectionChange={handleSectionChange} />
			</div>
			<div className="flex gap-2 border-t border-border-filter-divider bg-bg-filter-panel p-3">
				<button
					type="button"
					className="inline-flex h-10 flex-1 cursor-pointer appearance-none items-center justify-center rounded-[4px] border-0 bg-bg-filter-header px-4 font-sans text-[14px] leading-5 font-bold text-text-filter-header uppercase shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					style={{ appearance: 'none', border: 0, boxShadow: 'none' }}
					onClick={handleCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					className="inline-flex h-10 flex-1 cursor-pointer appearance-none items-center justify-center rounded-[4px] border-0 bg-bg-filter-chip-active px-4 font-sans text-[14px] leading-5 font-bold text-text-on-primary uppercase shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					style={{ appearance: 'none', border: 0, boxShadow: 'none' }}
					onClick={handleSave}
				>
					Save
				</button>
			</div>
		</>
	);
}

export function MobileFilterSheet({ filters, sort, filterOptionSections, onReset, onSave }) {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<Dialog.Trigger>
				<button
					type="button"
					aria-label="Filters"
					className="inline-flex h-9 cursor-pointer appearance-none items-center gap-2 rounded-[4px] border-0 bg-bg-filter-header px-3 py-2 font-sans text-[12px] leading-4 font-medium text-text-filter-header uppercase shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					style={{ appearance: 'none', border: 0, boxShadow: 'none' }}
				>
					Filters
					<Icon name="caretDown" size={16} decorative />
				</button>
			</Dialog.Trigger>
			<Dialog.Content
				aria-label="Search filters"
				className="flex flex-col overflow-hidden bg-bg-filter-panel"
				fullScreen
			>
				<MobileFilterSheetContent
					filters={filters}
					sort={sort}
					filterOptionSections={filterOptionSections}
					onReset={onReset}
					onSave={onSave}
					onClose={() => setOpen(false)}
				/>
			</Dialog.Content>
		</Dialog>
	);
}

MobileFilterSheet.propTypes = {
	filters: PropTypes.object.isRequired,
	sort: PropTypes.shape({ field: PropTypes.string, ordering: PropTypes.string }).isRequired,
	filterOptionSections: PropTypes.object.isRequired,
	onReset: PropTypes.func,
	onSave: PropTypes.func,
};
