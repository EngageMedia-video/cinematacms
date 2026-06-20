import { cn } from '../../utils/classNames';
import { runValidators } from '../../utils/validators';
import { useEffect, useId, useRef, useState } from 'react';
import '../TextField/TextField.css';

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

function toTextValue(value) {
	return value === null || value === undefined ? '' : String(value);
}

function countWords(value) {
	return toTextValue(value).trim().split(/\s+/).filter(Boolean).length;
}

function getMaxWordsLength(maxWordsLength) {
	if (maxWordsLength === null || maxWordsLength === undefined) {
		return null;
	}

	const parsedMax = Number(maxWordsLength);

	if (!Number.isFinite(parsedMax)) {
		return null;
	}

	return Math.max(0, Math.floor(parsedMax));
}

function limitWords(value, maxWordsLength) {
	if (value === null || value === undefined || maxWordsLength === null) {
		return value;
	}

	if (maxWordsLength === 0) {
		return '';
	}

	const text = String(value);
	const words = [...text.matchAll(/\S+/g)];

	if (words.length <= maxWordsLength) {
		return text;
	}

	const lastAllowedWord = words[maxWordsLength - 1];
	return text.slice(0, lastAllowedWord.index + lastAllowedWord[0].length);
}

function getNextValueWithinWordLimit(nextValue, previousValue, maxWordsLength) {
	if (maxWordsLength === null || countWords(nextValue) <= maxWordsLength) {
		return nextValue;
	}

	if (countWords(previousValue) >= maxWordsLength && nextValue.startsWith(previousValue)) {
		return previousValue;
	}

	return limitWords(nextValue, maxWordsLength);
}

function formatCounterText(wordCount, maxWordsLength) {
	if (maxWordsLength !== null) {
		return `${wordCount}/${maxWordsLength} words`;
	}

	return `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`;
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
	enableCounter = false,
	helperText = '',
	id,
	invalid = false,
	label = '',
	maxWordsLength = null,
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
	const resolvedMaxWordsLength = getMaxWordsLength(maxWordsLength);
	const limitedDefaultValue = limitWords(defaultValue, resolvedMaxWordsLength);
	const limitedValue = value === undefined ? undefined : limitWords(value, resolvedMaxWordsLength);
	const [isFocused, setIsFocused] = useState(false);
	const [currentText, setCurrentText] = useState(toTextValue(limitedValue ?? limitedDefaultValue));
	const [hasValue, setHasValue] = useState(hasTextValue(limitedValue ?? limitedDefaultValue));
	const [validationError, setValidationError] = useState('');
	const editedRef = useRef(false);
	const textareaRef = useRef(null);
	const showError = invalid || !!validationError;
	const variant = disabled ? 'disabled' : showError ? 'error' : 'default';
	const resolvedHelperText = validationError || helperText;
	const helperTextId = resolvedHelperText || enableCounter ? `${textareaId}-helper-text` : undefined;
	const describedBy = [ariaDescribedBy, helperTextId].filter(Boolean).join(' ') || undefined;
	const activeState = variant === 'default' && isFocused;
	const filledState = variant === 'default' && hasValue;
	const borderClasses =
		variant === 'default' && (activeState || filledState) ? ACTIVE_BORDER_CLASSES : BORDER_VARIANT_CLASSES[variant];
	const wordCount = countWords(currentText);
	const counterText = enableCounter ? formatCounterText(wordCount, resolvedMaxWordsLength) : '';

	useEffect(() => {
		if (value !== undefined) {
			setCurrentText(toTextValue(limitedValue));
			setHasValue(hasTextValue(limitedValue));
		}
	}, [limitedValue, value]);

	useEffect(() => {
		if (value !== undefined || resolvedMaxWordsLength === null || !textareaRef.current) {
			return;
		}

		const nextValue = limitWords(textareaRef.current.value, resolvedMaxWordsLength);

		if (nextValue !== textareaRef.current.value) {
			textareaRef.current.value = nextValue;
		}

		setCurrentText(toTextValue(nextValue));
		setHasValue(hasTextValue(nextValue));
	}, [resolvedMaxWordsLength, value]);

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
					defaultValue={limitedDefaultValue}
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
					value={limitedValue}
					onFocus={(event) => {
						setIsFocused(true);
						onFocus?.(event);
					}}
					onBlur={(event) => {
						setIsFocused(false);
						const nextValue = getNextValueWithinWordLimit(
							event.target.value,
							currentText,
							resolvedMaxWordsLength
						);

						if (nextValue !== event.target.value) {
							event.target.value = nextValue;
						}

						setCurrentText(toTextValue(nextValue));
						setHasValue(hasTextValue(nextValue));
						if (editedRef.current) {
							setValidationError(runValidators(validate, nextValue));
						}
						onBlur?.(event);
					}}
					onChange={(event) => {
						editedRef.current = true;
						const nextValue = getNextValueWithinWordLimit(
							event.target.value,
							currentText,
							resolvedMaxWordsLength
						);

						if (nextValue !== event.target.value) {
							event.target.value = nextValue;
						}

						setCurrentText(toTextValue(nextValue));
						if (value === undefined) {
							setHasValue(hasTextValue(nextValue));
						}
						// Re-run validators live only once an error is already showing,
						// so the message clears/updates as the user fixes the field.
						if (validationError) {
							setValidationError(runValidators(validate, nextValue));
						}
						onChange?.(event);
					}}
					className={cn(
						'field-input body-body-16-regular block w-full resize-none border-none bg-transparent p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:cursor-not-allowed',
						INPUT_VARIANT_CLASSES[variant],
						PLACEHOLDER_VARIANT_CLASSES[variant]
					)}
				/>

				{resolvedHelperText || enableCounter ? (
					<div id={helperTextId} className="body-body-12-regular mt-2 flex items-start justify-between gap-4">
						{resolvedHelperText ? (
							<p className={cn('m-0 min-w-0', HELPER_VARIANT_CLASSES[variant])}>{resolvedHelperText}</p>
						) : null}
						{enableCounter ? (
							<span className="ml-auto shrink-0 text-text-muted" aria-live="polite">
								{counterText}
							</span>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
