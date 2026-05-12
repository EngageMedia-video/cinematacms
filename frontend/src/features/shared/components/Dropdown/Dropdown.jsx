import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';

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

const VALUE_VARIANT_CLASSES = {
	default: 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50',
	error: 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50',
	disabled: 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300',
};

const PLACEHOLDER_VARIANT_CLASSES = {
	default: 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300',
	error: 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50',
	disabled: 'text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300',
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

const MENU_VARIANT_CLASSES = {
	default:
		'border-cinemata-pacific-deep-500 bg-cinemata-neutral-50 dark:border-cinemata-pacific-deep-500 dark:bg-cinemata-pacific-deep-900',
	error: 'border-cinemata-red-500 bg-cinemata-neutral-50 dark:border-cinemata-red-500 dark:bg-cinemata-pacific-deep-900',
	disabled:
		'border-cinemata-coral-reef-400p bg-cinemata-pacific-deep-50 dark:border-cinemata-red-500 dark:bg-cinemata-pacific-deep-900',
};

function joinClasses(...classes) {
	return classes.filter(Boolean).join(' ');
}

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
	onChange,
	options = [],
	placeholder = 'Select option',
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
	const labelClasses =
		variant === 'default' && (activeState || filledState) ? LABEL_ACTIVE_CLASSES : LABEL_VARIANT_CLASSES[variant];
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
			className={joinClasses('relative w-max max-w-full', className)}
			onBlur={(event) => {
				if (open && !rootRef.current?.contains(event.relatedTarget)) {
					setOpen(false);
				}
			}}
		>
			<div
				className={joinClasses(
					'group w-full border-b px-0 py-[14px] transition-colors duration-200',
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
					className="flex w-full items-center justify-between gap-4 border-none bg-transparent p-0 text-left outline-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
				>
					<span className="min-w-0 flex-1">
						{label ? (
							<span className={joinClasses('body-body-16-regular mb-2 block', labelClasses)}>
								{label}
							</span>
						) : null}
						<span
							className={joinClasses(
								'body-body-16-regular block truncate',
								selectedOption
									? VALUE_VARIANT_CLASSES[variant]
									: joinClasses(
											PLACEHOLDER_VARIANT_CLASSES[variant],
											activeState
												? 'text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50'
												: ''
										)
							)}
						>
							{selectedOption?.label ?? placeholder}
						</span>
					</span>
					<span
						aria-hidden="true"
						className={joinClasses(
							'inline-flex h-6 w-6 shrink-0 items-center justify-center self-center text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50 transition-transform duration-200',
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
					className={joinClasses(
						'absolute left-0 top-full z-20 mt-2 min-w-full list-none overflow-hidden rounded-(--radius-4) border p-0',
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
									className={joinClasses(
										'body-body-16-regular block w-full px-4 py-3 text-left outline-none transition-colors duration-150 border-0',
										SHELL_VARIANT_CLASSES[variant],
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
				<p
					id={helperTextId}
					className={joinClasses('body-body-12-regular mt-[7.5px]', HELPER_VARIANT_CLASSES[variant])}
				>
					{helperText}
				</p>
			) : null}
		</div>
	);
}
