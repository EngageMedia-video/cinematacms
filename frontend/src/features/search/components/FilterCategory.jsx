import { useState } from 'react';
import PropTypes from 'prop-types';
import { CheckboxButton } from '../../shared/components/CheckboxButton';
import { RadioButton } from '../../shared/components/RadioButton';
import { Icon } from '../../shared/components/Icon';
import { cn } from '../../shared/utils/classNames';

function normalizeSelectedValues(selectedValues) {
	if (Array.isArray(selectedValues)) {
		return selectedValues;
	}
	return selectedValues ? [selectedValues] : [];
}

export function FilterCategory({
	defaultExpanded = false,
	label,
	name,
	onChange,
	options = [],
	selectMode = 'multi',
	selectedValues = [],
}) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);
	const selected = new Set(normalizeSelectedValues(selectedValues));
	const Control = selectMode === 'single' ? RadioButton : CheckboxButton;
	const controlProps = selectMode === 'single' ? {} : { iconName: 'check' };

	function handleChange(value) {
		if (selectMode === 'single') {
			onChange?.(value, true);
			return;
		}

		onChange?.(value, !selected.has(value));
	}

	return (
		<section
			className={cn(
				'overflow-hidden rounded-[4px] bg-bg-disclosure-trigger',
				!isExpanded && 'border-b border-border-disclosure-trigger'
			)}
		>
			<div className="flex h-9 items-center rounded-[4px] bg-bg-disclosure-trigger text-text-disclosure-trigger">
				<button
					type="button"
					className="flex h-9 min-w-0 flex-1 cursor-pointer appearance-none items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-inherit uppercase shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
					style={{ appearance: 'none', background: 'transparent', border: 0, boxShadow: 'none' }}
					aria-expanded={isExpanded}
					aria-controls={`${name}-options`}
					onClick={() => setIsExpanded((current) => !current)}
				>
					<span className="min-w-0 flex-1 truncate font-sans text-[12px] leading-4 font-medium">{label}</span>
					<Icon
						name="caretDown"
						size={16}
						decorative
						className={cn('transition-transform duration-200', isExpanded && 'rotate-180')}
					/>
				</button>
			</div>

			{isExpanded ? (
				<div
					id={`${name}-options`}
					className="flex max-h-[186px] flex-col gap-2 overflow-y-auto border-b border-border-disclosure-content bg-bg-disclosure-content p-3"
				>
					{options.length ? (
						options.map((option) => (
							<Control
								key={option.value}
								name={name}
								value={option.value}
								checked={selected.has(option.value)}
								onChange={() => handleChange(option.value)}
								{...controlProps}
								className="w-full items-start"
								controlClassName={cn(
									'bg-bg-control-unchecked ',
									selectMode !== 'single'
										? 'peer-checked:bg-bg-control-checked peer-checked:text-text-control-checked'
										: 'peer-checked:bg-bg-control-checked'
								)}
								controlStyle={{ width: 26, height: 26 }}
								labelClassName="text-text-option"
							>
								<span className="min-w-0 flex-1 text-left">{option.label}</span>
							</Control>
						))
					) : (
						<p className="m-0 text-[14px] leading-5 text-text-panel-muted">No options available</p>
					)}
				</div>
			) : null}
		</section>
	);
}

FilterCategory.propTypes = {
	defaultExpanded: PropTypes.bool,
	label: PropTypes.string.isRequired,
	name: PropTypes.string.isRequired,
	onChange: PropTypes.func,
	options: PropTypes.arrayOf(
		PropTypes.shape({
			label: PropTypes.string.isRequired,
			value: PropTypes.string.isRequired,
		})
	),
	selectMode: PropTypes.oneOf(['multi', 'single']),
	selectedValues: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.string), PropTypes.string]),
};
