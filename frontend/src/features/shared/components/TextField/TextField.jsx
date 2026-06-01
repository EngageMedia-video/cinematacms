import { cn } from '../../utils/classNames';
import { useEffect, useId, useState } from 'react';

const SHELL_VARIANT_CLASSES = {
	default:
		'bg-bg-surface hover:bg-cinemata-pacific-deep-50 focus-within:bg-bg-surface dark:hover:bg-cinemata-pacific-deep-800',
	error: 'bg-bg-surface',
	disabled: 'bg-cinemata-pacific-deep-50 dark:bg-cinemata-pacific-deep-900',
};

// Transparent variant: the shell carries no surface fill so the field inherits
// whatever sits behind it (e.g. a gradient auth panel). The input is already
// transparent, so only the shell background needs to be cleared per state.
const SHELL_TRANSPARENT_CLASSES = {
	default: 'bg-transparent hover:bg-transparent focus-within:bg-transparent',
	error: 'bg-transparent',
	disabled: 'bg-transparent',
};

const LABEL_VARIANT_CLASSES = {
	default: 'text-text-strong',
	error: 'text-text-danger',
	disabled: 'text-text-disabled',
};

const INPUT_VARIANT_CLASSES = {
	default: 'text-text-strong',
	error: 'text-text-strong',
	disabled: 'text-text-muted',
};

const PLACEHOLDER_VARIANT_CLASSES = {
	default: 'placeholder:text-text-muted',
	error: 'placeholder:text-text-strong',
	disabled: 'placeholder:text-text-muted',
};

const HELPER_VARIANT_CLASSES = {
	default: 'text-text-accent',
	error: 'text-text-danger',
	disabled: 'text-text-accent',
};

const LABEL_ACTIVE_CLASSES = 'text-text-muted';
const ACTIVE_BORDER_CLASSES = 'border-border-input';
const BORDER_VARIANT_CLASSES = {
	default: 'border-border-strong-constant',
	error: 'border-border-danger',
	disabled: 'border-cinemata-coral-reef-400p dark:border-cinemata-red-500',
};

function hasTextValue(value) {
	if (value === null || value === undefined) {
		return false;
	}

	return String(value).length > 0;
}

export function TextField({
	className = '',
	defaultValue,
	disabled = false,
	helperText = '',
	id,
	invalid = false,
	label = '',
	onChange,
	onBlur,
	onFocus,
	transparent = false,
	type = 'text',
	value,
	'aria-describedby': ariaDescribedBy,
	'aria-invalid': ariaInvalid,
	ref,
	...props
}) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const variant = disabled ? 'disabled' : invalid ? 'error' : 'default';
	const [isFocused, setIsFocused] = useState(false);
	const [hasValue, setHasValue] = useState(hasTextValue(value ?? defaultValue));
	const helperTextId = helperText ? `${inputId}-helper-text` : undefined;
	const describedBy = [ariaDescribedBy, helperTextId].filter(Boolean).join(' ') || undefined;
	const activeState = variant === 'default' && isFocused;
	const filledState = variant === 'default' && hasValue;
	const labelClasses =
		variant === 'default' && (activeState || filledState) ? LABEL_ACTIVE_CLASSES : LABEL_VARIANT_CLASSES[variant];
	const borderClasses =
		variant === 'default' && (activeState || filledState) ? ACTIVE_BORDER_CLASSES : BORDER_VARIANT_CLASSES[variant];
	const shellClasses = transparent ? SHELL_TRANSPARENT_CLASSES[variant] : SHELL_VARIANT_CLASSES[variant];

	useEffect(() => {
		if (value !== undefined) {
			setHasValue(hasTextValue(value));
		}
	}, [value]);

	return (
		<div className={cn('w-max max-w-full', className)}>
			<div
				className={cn(
					'group w-full border-b px-0 py-[14px] transition-colors duration-200',
					shellClasses,
					borderClasses,
					disabled ? 'cursor-not-allowed' : ''
				)}
			>
				{label ? (
					<label htmlFor={inputId} className={cn('body-body-16-regular mb-2 block', labelClasses)}>
						{label}
					</label>
				) : null}

				<input
					{...props}
					defaultValue={defaultValue}
					ref={ref}
					id={inputId}
					type={type}
					disabled={disabled}
					aria-describedby={describedBy}
					aria-invalid={ariaInvalid ?? (invalid || undefined)}
					value={value}
					onFocus={(event) => {
						setIsFocused(true);
						onFocus?.(event);
					}}
					onBlur={(event) => {
						setIsFocused(false);
						onBlur?.(event);
					}}
					onChange={(event) => {
						if (value === undefined) {
							setHasValue(hasTextValue(event.target.value));
						}
						onChange?.(event);
					}}
					className={cn(
						'body-body-16-regular block w-full border-none bg-transparent p-0 outline-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed',
						INPUT_VARIANT_CLASSES[variant],
						PLACEHOLDER_VARIANT_CLASSES[variant]
					)}
				/>
			</div>

			{helperText ? (
				<p id={helperTextId} className={cn('body-body-12-regular mt-[7.5px]', HELPER_VARIANT_CLASSES[variant])}>
					{helperText}
				</p>
			) : null}
		</div>
	);
}
