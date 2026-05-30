import { cn } from '../../utils/classNames';
import { useEffect, useId, useRef, useState } from 'react';

const SHELL_VARIANT_CLASSES = {
	default: 'bg-bg-surface hover:bg-bg-surface-hover focus-within:bg-bg-surface',
	error: 'bg-bg-surface',
	disabled: 'bg-bg-surface-muted',
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
	disabled: 'border-border-input',
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

function assignRef(ref, value) {
	if (typeof ref === 'function') {
		ref(value);
		return;
	}

	if (ref) {
		ref.current = value;
	}
}

export function EditorField({
	className = '',
	defaultValue,
	disabled = false,
	helperText = '',
	id,
	invalid = false,
	label = '',
	name,
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
	const textareaRef = useRef(null);
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
				onMouseDown={(event) => {
					if (disabled || event.target === textareaRef.current) {
						return;
					}

					event.preventDefault();
					textareaRef.current?.focus();
					}}
					className={cn(
						'field-shell group w-full border-b px-0 py-3 transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-ring-focus focus-within:ring-offset-2 focus-within:ring-offset-bg-surface',
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
					ref={(node) => {
						textareaRef.current = node;
						assignRef(ref, node);
					}}
					id={textareaId}
					name={name ?? textareaId}
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
						'body-body-16-regular block w-full resize-none border-none bg-transparent p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:cursor-not-allowed',
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
