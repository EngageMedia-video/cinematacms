import PropTypes from 'prop-types';
import { FilterCategory } from './FilterCategory';

export function FilterPanel({ onReset, onSectionChange, sections = [] }) {
	return (
		<aside className="w-full rounded-[8px] bg-bg-panel-primary px-4 py-6 text-text-primary sm:max-w-[317px]">
			<div className="mb-4 flex items-end justify-between gap-3">
				<h2 className="m-0 font-['Barlow_Semi_Condensed',Arial,sans-serif] text-[20px] leading-6 font-medium text-text-primary">
					Choose Filters
				</h2>
				<button
					type="button"
					aria-label="Reset Filters"
					className="cursor-pointer appearance-none border-0 bg-transparent p-0 text-right font-sans text-[12px] leading-4 font-bold whitespace-nowrap text-text-accent uppercase shadow-none hover:text-text-link-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					style={{ appearance: 'none', background: 'transparent', border: 0, boxShadow: 'none' }}
					onClick={onReset}
				>
					Reset Filters
				</button>
			</div>

			<div className="flex flex-col gap-2">
				{sections.map((section) => (
					<FilterCategory
						key={section.key}
						defaultExpanded={section.defaultExpanded}
						name={section.key}
						label={section.label}
						options={section.options}
						selectMode={section.selectMode}
						selectedValues={section.selectedValues}
						onChange={(value, checked) => onSectionChange?.(section.key, value, checked)}
					/>
				))}
			</div>
		</aside>
	);
}

FilterPanel.propTypes = {
	onReset: PropTypes.func,
	onSectionChange: PropTypes.func,
	sections: PropTypes.arrayOf(
		PropTypes.shape({
			key: PropTypes.string.isRequired,
			defaultExpanded: PropTypes.bool,
			label: PropTypes.string.isRequired,
			options: PropTypes.array.isRequired,
			selectMode: PropTypes.oneOf(['multi', 'single']),
			selectedValues: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), PropTypes.string]),
		})
	),
};
