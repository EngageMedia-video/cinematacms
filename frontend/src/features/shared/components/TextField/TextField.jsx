import { cn } from '../../utils/classNames';
import { runValidators } from '../../utils/validators';
import { useEffect, useId, useRef, useState } from 'react';
import './TextField.css';
import { Button } from '../Button';

const SHELL_VARIANT_CLASSES = {
	default: 'bg-bg-surface hover:bg-bg-surface-hover focus-within:bg-bg-surface',
	error: 'bg-bg-surface',
	disabled: 'bg-bg-surface-muted',
};

const SHELL_TRANSPARENT_CLASSES = {
	default: 'bg-transparent hover:bg-transparent focus-within:bg-transparent',
	error: 'bg-transparent',
	disabled: 'bg-transparent',
};

const LABEL_VARIANT_CLASSES = {
	default: 'text-text-strong',
	error: 'text-text-strong',
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

function textLength(value) {
	if (value === null || value === undefined) {
		return 0;
	}

	return String(value).length;
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

export function TextField({
	className = '',
	defaultValue,
	disabled = false,
	helperText = '',
	id,
	invalid = false,
	label = '',
	maxLength = null,
	name,
	onChange,
	onBlur,
	onFocus,
	onRightButtonClick,
	required = false,
	rightButtonLabel = '',
	showCharacterCount = false,
	transparent = false,
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
	const inputId = id ?? generatedId;
	const [isFocused, setIsFocused] = useState(false);
	const [characterCount, setCharacterCount] = useState(textLength(value ?? defaultValue));
	const hasValue = characterCount > 0;
	const showCounter = showCharacterCount && maxLength !== null;
	const [validationError, setValidationError] = useState('');
	const editedRef = useRef(false);
	const inputRef = useRef(null);
	const showError = invalid || !!validationError;
	const variant = disabled ? 'disabled' : showError ? 'error' : 'default';
	const resolvedHelperText = validationError || helperText;
	const helperTextId = resolvedHelperText || showCounter ? `${inputId}-helper-text` : undefined;
	const describedBy = [ariaDescribedBy, helperTextId].filter(Boolean).join(' ') || undefined;
	const activeState = variant === 'default' && isFocused;
	const filledState = variant === 'default' && hasValue;
	const borderClasses =
		variant === 'default' && (activeState || filledState) ? ACTIVE_BORDER_CLASSES : BORDER_VARIANT_CLASSES[variant];
	const shellClasses = transparent ? SHELL_TRANSPARENT_CLASSES[variant] : SHELL_VARIANT_CLASSES[variant];

	useEffect(() => {
		if (value !== undefined) {
			setCharacterCount(textLength(value));
		}
	}, [value]);

	return (
		<div className={cn('w-max max-w-full', className)}>
			<div
				className={cn(
					'field-shell group w-full px-0 pt-4 transition-[background-color,border-color,box-shadow] duration-200',
					shellClasses,
					disabled ? 'cursor-not-allowed' : ''
				)}
				onMouseDown={(event) => {
					if (disabled || event.target === inputRef.current) {
						return;
					}

					event.preventDefault();
					inputRef.current?.focus();
					if (type === 'date') {
						inputRef.current?.showPicker?.();
					}
				}}
			>
				{label ? (
					<label
						htmlFor={inputId}
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

				<div className="flex items-center gap-3">
					<input
						{...props}
						defaultValue={defaultValue}
						ref={(node) => {
							inputRef.current = node;
							assignRef(ref, node);
						}}
						id={inputId}
						name={name ?? inputId}
						type={type}
						maxLength={maxLength ?? undefined}
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
								setCharacterCount(textLength(event.target.value));
							}
							// Validate live on every keystroke, but only after the user
							// has started typing in this field.
							setValidationError(runValidators(validate, event.target.value));
							onChange?.(event);
						}}
						className={cn(
							'field-input body-body-16-regular block w-full min-w-0 flex-1 appearance-none border-none bg-transparent p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:cursor-not-allowed',
							INPUT_VARIANT_CLASSES[variant],
							PLACEHOLDER_VARIANT_CLASSES[variant]
						)}
					/>

					{rightButtonLabel ? (
						<Button
							variant="text"
							className="text-text-accent"
							onClick={onRightButtonClick}
							disabled={disabled}
						>
							{rightButtonLabel}
						</Button>
					) : null}
				</div>

				<div className={cn('my-4 border-b', borderClasses)} />
			</div>

			{resolvedHelperText || showCounter ? (
				<div id={helperTextId} className="body-body-12-regular mt-2 flex items-start justify-between gap-4">
					{resolvedHelperText ? (
						<p className={cn('m-0 min-w-0', HELPER_VARIANT_CLASSES[variant])}>{resolvedHelperText}</p>
					) : null}
					{showCounter ? (
						<span className="ml-auto shrink-0 text-text-muted">{`${characterCount}/${maxLength}`}</span>
					) : null}
				</div>
			) : null}
		</div>
	);
}
