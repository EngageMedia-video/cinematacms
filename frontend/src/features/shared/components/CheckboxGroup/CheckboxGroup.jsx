import { cn } from '../../utils/classNames';
import { useId, useState } from 'react';
import PropTypes from 'prop-types';
import { CheckboxButton } from '../CheckboxButton';

const DEFAULT_LIST_CLASSES =
	'flex flex-col max-h-40 overflow-y-scroll [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:[-webkit-appearance:none] [&::-webkit-scrollbar-track]:bg-bg-surface-muted [&::-webkit-scrollbar-thumb]:bg-text-dialog-accent [&::-webkit-scrollbar-thumb]:rounded-full';

function normalizeOption(option) {
	if (typeof option === 'string') {
		return { label: option, value: option };
	}

	return option;
}

export function CheckboxGroup({
	className = '',
	defaultValue = [],
	error = '',
	id,
	label = '',
	listClassName = DEFAULT_LIST_CLASSES,
	name,
	onChange,
	options = [],
	required = false,
	value,
}) {
	const generatedId = useId();
	const groupId = id ?? generatedId;
	const labelId = label ? `${groupId}-label` : undefined;
	const errorId = error ? `${groupId}-error` : undefined;
	const controlled = value !== undefined;
	const [internalValue, setInternalValue] = useState(defaultValue);
	const selected = controlled ? value : internalValue;
	const normalizedOptions = options.map(normalizeOption);

	function handleChange(optionValue, checked) {
		const next = checked ? [...selected, optionValue] : selected.filter((item) => item !== optionValue);

		if (!controlled) {
			setInternalValue(next);
		}

		onChange?.(next, optionValue, checked);
	}

	return (
		<div className={className}>
			{label ? (
				<span id={labelId} className="body-body-16-regular mb-2 text-text-muted">
					{label}
					{required ? <span className="text-text-danger"> *</span> : null}
				</span>
			) : null}

			<div
				role="group"
				aria-labelledby={labelId}
				aria-describedby={error ? errorId : undefined}
				aria-invalid={error ? 'true' : undefined}
				className={listClassName}
			>
				{normalizedOptions.map((option) => (
					<CheckboxButton
						key={option.value}
						name={name}
						value={option.value}
						checked={selected.includes(option.value)}
						onChange={(event) => handleChange(option.value, event.target.checked)}
					>
						{option.label}
					</CheckboxButton>
				))}
			</div>

			{error ? (
				<p id={errorId} className="body-body-12-regular mt-2 mb-0 text-text-danger">
					{error}
				</p>
			) : null}
		</div>
	);
}

CheckboxGroup.propTypes = {
	className: PropTypes.string,
	defaultValue: PropTypes.arrayOf(PropTypes.string),
	error: PropTypes.string,
	id: PropTypes.string,
	label: PropTypes.string,
	listClassName: PropTypes.string,
	name: PropTypes.string,
	onChange: PropTypes.func,
	options: PropTypes.arrayOf(
		PropTypes.oneOfType([
			PropTypes.string,
			PropTypes.shape({
				label: PropTypes.node,
				value: PropTypes.string,
			}),
		])
	),
	required: PropTypes.bool,
	value: PropTypes.arrayOf(PropTypes.string),
};
