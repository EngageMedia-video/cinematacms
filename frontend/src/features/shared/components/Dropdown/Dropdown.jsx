import { cn } from '../../utils/classNames';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';

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

const VALUE_VARIANT_CLASSES = {
	default: 'text-text-strong',
	error: 'text-text-strong',
	disabled: 'text-text-muted',
};

const PLACEHOLDER_VARIANT_CLASSES = {
	default: 'text-text-muted',
	error: 'text-text-strong',
	disabled: 'text-text-muted',
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

const MENU_VARIANT_CLASSES = {
	default: 'border-border-strong-constant bg-bg-surface',
	error: 'border-border-danger bg-bg-surface',
	disabled: 'border-border-input bg-bg-surface-muted',
};

function normalizeOption(option) {
	if (typeof option === 'string') {
		return {
			label: option,
			value: option,
		};
	}

	return option;
}

function getSelectedOption(options, value) {
	return options.find((option) => option.value === value) ?? null;
}

function clampIndex(index, total) {
	if (!total) {
		return -1;
	}

	if (index < 0) {
		return total - 1;
	}

	if (index >= total) {
		return 0;
	}

	return index;
}

export function Dropdown({
	className = '',
	defaultValue,
	disabled = false,
	helperText = '',
	id,
	invalid = false,
	label = '',
	name,
	onChange,
	options = [],
	placeholder = 'Select option',
	required = false,
	value,
	'aria-describedby': ariaDescribedBy,
	'aria-invalid': ariaInvalid,
}) {
	const generatedId = useId();
	const buttonId = id ?? generatedId;
	const menuId = `${buttonId}-menu`;
	const helperTextId = helperText ? `${buttonId}-helper-text` : undefined;
	const describedBy = [ariaDescribedBy, helperTextId].filter(Boolean).join(' ') || undefined;
	const variant = disabled ? 'disabled' : invalid ? 'error' : 'default';
	const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
	const controlled = value !== undefined;
	const [internalValue, setInternalValue] = useState(defaultValue);
	const [isFocused, setIsFocused] = useState(false);
	const [open, setOpen] = useState(false);
	const rootRef = useRef(null);
	const optionRefs = useRef([]);
	const pendingFocusIndexRef = useRef(null);
	const selectedValue = controlled ? value : internalValue;
	const selectedOption = getSelectedOption(normalizedOptions, selectedValue);
	const activeState = variant === 'default' && (isFocused || open);
	const filledState = variant === 'default' && !!selectedOption;
	const borderClasses =
		variant === 'default' && (activeState || filledState) ? ACTIVE_BORDER_CLASSES : BORDER_VARIANT_CLASSES[variant];

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		function handlePointerDown(event) {
			if (!rootRef.current?.contains(event.target)) {
				setOpen(false);
			}
		}

		function handleEscape(event) {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [open]);

	useEffect(() => {
		if (!open || pendingFocusIndexRef.current === null) {
			return;
		}

		const nextIndex = clampIndex(pendingFocusIndexRef.current, normalizedOptions.length);
		pendingFocusIndexRef.current = null;
		optionRefs.current[nextIndex]?.focus();
	}, [open, normalizedOptions.length]);

	function focusOption(index) {
		const nextIndex = clampIndex(index, normalizedOptions.length);

		if (nextIndex === -1) {
			return;
		}

		requestAnimationFrame(() => {
			optionRefs.current[nextIndex]?.focus();
		});
	}

	function openMenuWithFocus(index) {
		if (disabled) {
			return;
		}

		pendingFocusIndexRef.current = index;
		setOpen(true);
	}

	function getSelectedIndex() {
		const index = normalizedOptions.findIndex((option) => option.value === selectedValue);
		return index === -1 ? 0 : index;
	}

	function handleSelect(option) {
		if (!controlled) {
			setInternalValue(option.value);
		}

		onChange?.(option.value, option);
		setOpen(false);
	}

	return (
		<div
			ref={rootRef}
			className={cn('relative w-max max-w-full', className)}
			onBlur={(event) => {
				if (open && !rootRef.current?.contains(event.relatedTarget)) {
					setOpen(false);
				}
			}}
		>
			{name ? <input type="hidden" name={name} value={selectedValue ?? ''} required={required} /> : null}

			<div
				className={cn(
					'group w-full border-b px-0 py-[14px] transition-[background-color,border-color,box-shadow] duration-200 focus-within:ring-2 focus-within:ring-ring-focus focus-within:ring-offset-2 focus-within:ring-offset-bg-surface',
					SHELL_VARIANT_CLASSES[variant],
					borderClasses,
					disabled ? 'cursor-not-allowed' : 'cursor-pointer'
				)}
			>
				<button
					id={buttonId}
					type="button"
					disabled={disabled}
					aria-label={selectedOption?.label ?? placeholder}
					aria-describedby={describedBy}
					aria-expanded={open}
					aria-haspopup="menu"
					aria-controls={menuId}
					aria-invalid={ariaInvalid ?? (invalid || undefined)}
					onClick={() => {
						if (!disabled) {
							setOpen((current) => !current);
						}
					}}
					onKeyDown={(event) => {
						if (disabled) {
							return;
						}

						if (event.key === 'ArrowDown') {
							event.preventDefault();
							openMenuWithFocus(open ? getSelectedIndex() + 1 : getSelectedIndex());
						}

						if (event.key === 'ArrowUp') {
							event.preventDefault();
							openMenuWithFocus(open ? getSelectedIndex() - 1 : getSelectedIndex());
						}

						if (event.key === 'Home') {
							event.preventDefault();
							openMenuWithFocus(0);
						}

						if (event.key === 'End') {
							event.preventDefault();
							openMenuWithFocus(normalizedOptions.length - 1);
						}
					}}
					onFocus={() => {
						setIsFocused(true);
					}}
					onBlur={() => {
						setIsFocused(false);
					}}
					className="flex w-full items-center justify-between gap-4 border-none bg-transparent p-0 text-left outline-none focus:outline-none focus-visible:outline-none focus:ring-0 disabled:cursor-not-allowed"
				>
					<span className="min-w-0 flex-1">
						{label ? (
							<span
								className={cn(
									'body-body-16-regular mb-2 block',
									activeState || filledState
										? LABEL_VARIANT_CLASSES.disabled
										: LABEL_VARIANT_CLASSES.default
								)}
							>
								{label}
								{required ? (
									<span aria-hidden="true" className="text-text-danger">
										{' '}
										*
									</span>
								) : null}
							</span>
						) : null}
						<span
							className={cn(
								'body-body-16-regular block truncate',
								selectedOption
									? VALUE_VARIANT_CLASSES[variant]
									: cn(PLACEHOLDER_VARIANT_CLASSES[variant], activeState ? 'text-text-strong' : '')
							)}
						>
							{selectedOption?.label ?? placeholder}
						</span>
					</span>
					<span
						aria-hidden="true"
						className={cn(
							'inline-flex h-6 w-6 shrink-0 items-center justify-center self-center text-text-strong transition-transform duration-200',
							open ? 'rotate-180' : ''
						)}
					>
						<Icon name="chevronDown" decorative size="md" />
					</span>
				</button>
			</div>

			{open && !disabled ? (
				<ul
					id={menuId}
					role="menu"
					aria-labelledby={label ? buttonId : undefined}
					className={cn(
						'thin-scrollbar absolute left-0 top-full z-20 mt-2 max-h-[calc(var(--size-96)*2+var(--size-48))] min-w-full list-none overflow-y-auto overscroll-contain rounded-ds-4 border p-0',
						MENU_VARIANT_CLASSES[variant]
					)}
				>
					{normalizedOptions.map((option, index) => {
						const selected = option.value === selectedValue;

						return (
							<li key={option.value} role="none">
								<button
									ref={(node) => {
										optionRefs.current[index] = node;
									}}
									type="button"
									role="menuitemradio"
									aria-checked={selected}
									onClick={() => handleSelect(option)}
									onKeyDown={(event) => {
										if (event.key === 'ArrowDown') {
											event.preventDefault();
											focusOption(index + 1);
										}

										if (event.key === 'ArrowUp') {
											event.preventDefault();
											focusOption(index - 1);
										}

										if (event.key === 'Home') {
											event.preventDefault();
											focusOption(0);
										}

										if (event.key === 'End') {
											event.preventDefault();
											focusOption(normalizedOptions.length - 1);
										}

										if (event.key === 'Escape') {
											event.preventDefault();
											setOpen(false);
											requestAnimationFrame(() => {
												rootRef.current?.querySelector('button')?.focus();
											});
										}
									}}
									className={cn(
										'body-body-16-regular block w-full border-0 px-4 py-3 text-left outline-none transition-colors duration-150 hover:bg-bg-surface-hover focus:bg-bg-surface-hover',
										SHELL_VARIANT_CLASSES[variant],
										VALUE_VARIANT_CLASSES[variant],
										selected ? 'font-black' : 'font-normal'
									)}
								>
									{option.label}
								</button>
							</li>
						);
					})}
				</ul>
			) : null}

			{helperText ? (
				<p id={helperTextId} className={cn('body-body-12-regular mt-[7.5px]', HELPER_VARIANT_CLASSES[variant])}>
					{helperText}
				</p>
			) : null}
		</div>
	);
}
