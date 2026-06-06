import PropTypes from 'prop-types';
import { Badge } from '../../shared/components/Badge';
import { cn } from '../../shared/utils/classNames';

export function SelectedFilters({ filters = [], onDismiss, variant = 'desktop' }) {
	if (!filters.length) {
		return null;
	}
	const isDesktop = variant === 'desktop';

	return (
		<div
			className={cn(
				'flex items-start',
				isDesktop
					? 'flex-col gap-3 rounded-[8px] bg-bg-panel-selected p-6 max-sm:flex-row max-sm:flex-wrap max-sm:gap-[6px] max-sm:rounded-none max-sm:bg-transparent max-sm:p-0'
					: 'flex-wrap gap-[6px]'
			)}
			aria-label="Selected filters"
		>
			{isDesktop ? (
				<div className="flex w-full items-center gap-4 max-sm:hidden">
					<h2 className="m-0 font-['Barlow_Semi_Condensed',Arial,sans-serif] text-[20px] leading-6 font-medium text-text-panel-heading">
						Selected
					</h2>
				</div>
			) : null}
			<div className="flex flex-wrap items-start gap-[6px]">
				{filters.map((filter) => (
					<Badge
						key={`${filter.key}:${filter.value}`}
						color="--selected-filter-chip-bg"
						className="rounded-[4px] border-0 py-[2px] px-[6px] font-sans text-[12px] leading-4 font-bold text-text-on-primary [--selected-filter-chip-bg:var(--bg-chip-active)] sm:border sm:border-border-chip-active sm:pr-[6px] sm:pl-2 sm:text-text-accent sm:[--selected-filter-chip-bg:transparent]"
						onDismiss={() => onDismiss?.(filter)}
					>
						{filter.label}
					</Badge>
				))}
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
	onDismiss: PropTypes.func,
	variant: PropTypes.oneOf(['desktop', 'mobile']),
};
