import { cn } from '../../utils/classNames';
import { useEffect, useId, useState } from 'react';

const SHELL_VARIANT_CLASSES = {
	default:
		'bg-cinemata-neutral-50 hover:bg-cinemata-pacific-deep-50 focus-within:bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-900 dark:hover:bg-cinemata-pacific-deep-800 dark:focus-within:bg-cinemata-pacific-deep-900',
	error: 'bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-900',
	disabled: 'bg-cinemata-pacific-deep-50 dark:bg-cinemata-pacific-deep-900',
};

const LABEL_VARIANT_CLASSES = {
	default: 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50',
	error: 'text-cinemata-red-500 dark:text-cinemata-red-500',
	disabled: 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-400',
};

const INPUT_VARIANT_CLASSES = {
	default: 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50',
	error: 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50',
	disabled: 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300',
};

const PLACEHOLDER_VARIANT_CLASSES = {
	default: 'placeholder:text-cinemata-pacific-deep-400 dark:placeholder:text-cinemata-pacific-deep-300',
	error: 'placeholder:text-cinemata-pacific-deep-900 dark:placeholder:text-cinemata-strait-blue-50',
	disabled: 'placeholder:text-cinemata-pacific-deep-400 dark:placeholder:text-cinemata-pacific-deep-300',
};

const HELPER_VARIANT_CLASSES = {
	default: 'text-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-400p',
	error: 'text-cinemata-red-500 dark:text-cinemata-red-500',
	disabled: 'text-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-400p',
};

const LABEL_ACTIVE_CLASSES = 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300';
const ACTIVE_BORDER_CLASSES = 'border-cinemata-coral-reef-400p dark:border-cinemata-sunset-horizon-400p';
const BORDER_VARIANT_CLASSES = {
	default: 'border-cinemata-pacific-deep-500 dark:border-cinemata-pacific-deep-500',
	error: 'border-cinemata-red-500 dark:border-cinemata-red-500',
	disabled: 'border-cinemata-coral-reef-400p dark:border-cinemata-red-500',
};

function hasTextValue(value) {
	if (value === null || value === undefined) {
		return false;
	}

	return String(value).length > 0;
}

function getMinRows(rows) {
	const parsedRows = Number(rows);

	if (!Number.isFinite(parsedRows)) {
		return 5;
	}

	return Math.max(5, parsedRows);
}

export function EditorField({
	className = '',
	defaultValue,
	disabled = false,
	helperText = '',
	id,
	invalid = false,
	label = '',
	onBlur,
	onChange,
	onFocus,
	rows = 5,
	value,
	'aria-describedby': ariaDescribedBy,
	'aria-invalid': ariaInvalid,
	ref,
	...props
}) {
	const generatedId = useId();
	const textareaId = id ?? generatedId;
	const variant = disabled ? 'disabled' : invalid ? 'error' : 'default';
	const [isFocused, setIsFocused] = useState(false);
	const [hasValue, setHasValue] = useState(hasTextValue(value ?? defaultValue));
	const helperTextId = helperText ? `${textareaId}-helper-text` : undefined;
	const describedBy = [ariaDescribedBy, helperTextId].filter(Boolean).join(' ') || undefined;
	const activeState = variant === 'default' && isFocused;
	const filledState = variant === 'default' && hasValue;
	const labelClasses =
		variant === 'default' && (activeState || filledState) ? LABEL_ACTIVE_CLASSES : LABEL_VARIANT_CLASSES[variant];
	const borderClasses =
		variant === 'default' && (activeState || filledState) ? ACTIVE_BORDER_CLASSES : BORDER_VARIANT_CLASSES[variant];

	useEffect(() => {
		if (value !== undefined) {
			setHasValue(hasTextValue(value));
		}
	}, [value]);

	return (
		<div className={cn('w-max max-w-full', className)}>
			<div
				className={cn(
					'group w-full border-b px-0 transition-colors duration-200 py-3',
					SHELL_VARIANT_CLASSES[variant],
					borderClasses,
					disabled ? 'cursor-not-allowed' : ''
				)}
			>
				{label ? (
					<label htmlFor={textareaId} className={cn('body-body-16-regular mb-2 block', labelClasses)}>
						{label}
					</label>
				) : null}

				<textarea
					{...props}
					defaultValue={defaultValue}
					ref={ref}
					id={textareaId}
					rows={getMinRows(rows)}
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
						'body-body-16-regular block w-full resize-none border-none bg-transparent p-0 outline-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed',
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
