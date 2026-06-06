import PropTypes from 'prop-types';
import { Badge } from '../../shared/components/Badge';
import { cn } from '../../shared/utils/classNames';

export function SelectedFilters({ filters = [], onClearAll, onDismiss, variant = 'desktop' }) {
	if (!filters.length) {
		return null;
	}
	const isDesktop = variant === 'desktop';

	return (
		<div
			className={cn(
				'flex items-start',
				isDesktop
					? 'flex-col gap-3 rounded-[16px] bg-bg-filter-selected p-6 max-sm:flex-row max-sm:flex-wrap max-sm:gap-[6px] max-sm:rounded-none max-sm:bg-transparent max-sm:p-0'
					: 'flex-wrap gap-[6px]'
			)}
			aria-label="Selected filters"
		>
			{isDesktop ? (
				<div className="flex w-full items-center gap-4 max-sm:hidden">
					<h2 className="m-0 font-sans text-[18px] leading-7 font-bold text-text-filter-selected-heading">
						Selected
					</h2>
				</div>
			) : null}
			<div className="flex flex-wrap items-start gap-[6px]">
				{filters.map((filter) => (
					<Badge
						key={`${filter.key}:${filter.value}`}
						color="bg/filter-chip-active"
						className="rounded-[4px] px-[6px] py-[2px] font-sans text-[12px] leading-4 font-bold"
						onDismiss={() => onDismiss?.(filter)}
					>
						{filter.label}
					</Badge>
				))}
				<button
					type="button"
					className="cursor-pointer appearance-none rounded-[2px] border-0 bg-transparent px-1 font-sans text-[12px] leading-4 font-bold whitespace-nowrap text-text-accent uppercase shadow-none hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					style={{ appearance: 'none', background: 'transparent', border: 0, boxShadow: 'none' }}
					onClick={onClearAll}
				>
					Clear all
				</button>
			</div>
		</div>
	);
}

SelectedFilters.propTypes = {
	filters: PropTypes.arrayOf(
		PropTypes.shape({
			key: PropTypes.string.isRequired,
			label: PropTypes.string.isRequired,
			value: PropTypes.string.isRequired,
		})
	),
	onClearAll: PropTypes.func,
	onDismiss: PropTypes.func,
	variant: PropTypes.oneOf(['desktop', 'mobile']),
};
