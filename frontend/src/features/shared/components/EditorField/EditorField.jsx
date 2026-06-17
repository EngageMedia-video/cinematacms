import { cn } from '../../utils/classNames';
import { runValidators } from '../../utils/validators';
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
	required = false,
	rows = 5,
	type = 'text',
	validate,
	value,
	'aria-describedby': ariaDescribedBy,
	'aria-invalid': ariaInvalid,
	'aria-label': ariaLabel,
	ref,
	...props
}) {
	const generatedId = useId();
	const textareaId = id ?? generatedId;
	const [isFocused, setIsFocused] = useState(false);
	const [hasValue, setHasValue] = useState(hasTextValue(value ?? defaultValue));
	const [validationError, setValidationError] = useState('');
	const editedRef = useRef(false);
	const textareaRef = useRef(null);
	const showError = invalid || !!validationError;
	const variant = disabled ? 'disabled' : showError ? 'error' : 'default';
	const resolvedHelperText = validationError || helperText;
	const helperTextId = resolvedHelperText ? `${textareaId}-helper-text` : undefined;
	const describedBy = [ariaDescribedBy, helperTextId].filter(Boolean).join(' ') || undefined;
	const activeState = variant === 'default' && isFocused;
	const filledState = variant === 'default' && hasValue;
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
					'field-shell group w-full border-b-2 px-0 py-3 transition-all duration-200',
					SHELL_VARIANT_CLASSES[variant],
					borderClasses,
					disabled ? 'cursor-not-allowed' : ''
				)}
			>
				{label ? (
					<label
						htmlFor={textareaId}
						className={cn(
							'body-body-16-regular mb-2 block',
							activeState || filledState ? LABEL_VARIANT_CLASSES.disabled : LABEL_VARIANT_CLASSES.default
						)}
					>
						{label}
						{required ? (
							<span aria-hidden="true" className="text-text-danger">
								{' '}
								*
							</span>
						) : null}
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
					type={type}
					rows={getMinRows(rows)}
					disabled={disabled}
					required={required}
					aria-describedby={describedBy}
					aria-invalid={ariaInvalid ?? (showError || undefined)}
					aria-label={ariaLabel ?? (required && label ? label : undefined)}
					value={value}
					onFocus={(event) => {
						setIsFocused(true);
						onFocus?.(event);
					}}
					onBlur={(event) => {
						setIsFocused(false);
						if (editedRef.current) {
							setValidationError(runValidators(validate, event.target.value));
						}
						onBlur?.(event);
					}}
					onChange={(event) => {
						editedRef.current = true;
						if (value === undefined) {
							setHasValue(hasTextValue(event.target.value));
						}
						// Re-run validators live only once an error is already showing,
						// so the message clears/updates as the user fixes the field.
						if (validationError) {
							setValidationError(runValidators(validate, event.target.value));
						}
						onChange?.(event);
					}}
					className={cn(
						'body-body-16-regular block w-full resize-none border-none bg-transparent p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:cursor-not-allowed',
						INPUT_VARIANT_CLASSES[variant],
						PLACEHOLDER_VARIANT_CLASSES[variant]
					)}
				/>

				{resolvedHelperText ? (
					<p
						id={helperTextId}
						className={cn('body-body-12-regular mt-2 mb-0', HELPER_VARIANT_CLASSES[variant])}
					>
						{resolvedHelperText}
					</p>
				) : null}
			</div>
		</div>
	);
}
