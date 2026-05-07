import { useState } from 'react';
import { Icon } from '../Icon';

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

function normalizeSelection(value, multiple, options) {
	if (multiple) {
		return Array.isArray(value) ? value : [];
	}

	if (value !== undefined && value !== null) {
		return value;
	}

	return options.find((option) => !option.disabled)?.value;
}

export function SegmentButton({
	options = [],
	multiple = false,
	layout = 'wrap',
	value,
	defaultValue,
	onValueChange,
	className = '',
	'aria-label': ariaLabel = 'Segment button',
}) {
	const isControlled = value !== undefined;
	const [internalValue, setInternalValue] = useState(() => normalizeSelection(defaultValue, multiple, options));
	const selectedValue = isControlled ? normalizeSelection(value, multiple, options) : internalValue;

	function commit(nextValue) {
		if (!isControlled) {
			setInternalValue(nextValue);
		}

		onValueChange?.(nextValue);
	}

	function isOptionSelected(optionValue) {
		return multiple ? selectedValue.includes(optionValue) : selectedValue === optionValue;
	}

	function handleToggle(optionValue) {
		if (multiple) {
			const nextValue = isOptionSelected(optionValue)
				? selectedValue.filter((valueItem) => valueItem !== optionValue)
				: [...selectedValue, optionValue];

			commit(nextValue);
			return;
		}

		if (selectedValue !== optionValue) {
			commit(optionValue);
		}
	}

	const isFillLayout = layout === 'fill';

	return (
		<div
			role="group"
			aria-label={ariaLabel}
			className={joinClasses(
				isFillLayout ? 'flex w-full max-w-full' : 'inline-flex max-w-full',
				'overflow-hidden rounded-radius-4',
				className
			)}
			data-segment-button
		>
			{options.map((option) => {
				const selected = isOptionSelected(option.value);

				return (
					<button
						key={option.value}
						type="button"
						disabled={option.disabled}
						aria-pressed={selected}
						onClick={() => handleToggle(option.value)}
						className={joinClasses(
							'body-body-12-medium inline-flex min-w-0 items-center cursor-pointer justify-center gap-1 border-0 px-4 py-2 text-cinemata-neutral-50 transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 first:rounded-l-(--radius-8) last:rounded-r-(--radius-8) only:rounded-(--radius-8)',
							isFillLayout ? 'flex-1' : 'shrink-0',
							selected ? 'bg-cinemata-sunset-horizon-500' : 'bg-cinemata-pacific-deep-800'
						)}
					>
						{option.iconName ? <Icon name={option.iconName} size={20} decorative /> : null}
						<span className="truncate">{option.label}</span>
					</button>
				);
			})}
		</div>
	);
}
