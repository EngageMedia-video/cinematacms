import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/classNames';
import { TextField } from '../TextField';

const CURRENT_YEAR = new Date().getFullYear();

/**
 * Year-only "calendar" picker: a read-only field that opens a popover grid of
 * years to choose from. The visible input never accepts typed text, so an invalid
 * year can't be entered (issue #771 edge cases). Years run newest-first from
 * `maxYear` down to `minYear` (default 1900..current, matching MediaForm's year
 * dropdown + custom range).
 */
export function YearChooserField({
	className = 'w-full',
	id,
	label = 'Year Produced',
	name,
	onChange,
	error = '',
	required = false,
	placeholder = 'Select year',
	minYear = 1900,
	maxYear = CURRENT_YEAR,
	value = '',
}) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	const popoverId = `${fieldId}-years`;
	const rootRef = useRef(null);
	const gridRef = useRef(null);
	const [open, setOpen] = useState(false);

	const years = useMemo(() => {
		const list = [];
		for (let year = maxYear; year >= minYear; year -= 1) {
			list.push(year);
		}
		return list;
	}, [minYear, maxYear]);

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		function handlePointerDown(event) {
			if (!rootRef.current?.contains(event.target)) {
				setOpen(false);
			}
		}

		function handleKey(event) {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		}

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleKey);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleKey);
		};
	}, [open]);

	// Move focus into the popover (the selected year, else the first) when opened,
	// so keyboard users land on the grid.
	useEffect(() => {
		if (!open) {
			return;
		}
		const grid = gridRef.current;
		if (!grid) {
			return;
		}
		const target = grid.querySelector('[aria-pressed="true"]') ?? grid.querySelector('button');
		target?.focus();
	}, [open]);

	function selectYear(year) {
		onChange?.(String(year));
		setOpen(false);
	}

	return (
		<div ref={rootRef} className={cn('relative', className)}>
			<TextField
				className="w-full"
				id={fieldId}
				label={label}
				required={required}
				placeholder={placeholder}
				value={value ? String(value) : ''}
				readOnly
				invalid={Boolean(error)}
				helperText={error}
				rightButtonLabel="Choose"
				onRightButtonClick={() => setOpen((current) => !current)}
			/>
			{name ? <input type="hidden" name={name} value={value ?? ''} /> : null}

			{open ? (
				<div
					id={popoverId}
					role="dialog"
					aria-label="Choose year"
					className="absolute left-0 top-full z-20 mt-2 w-full rounded-ds-4 border border-border-strong-constant bg-bg-surface p-2"
				>
					<div ref={gridRef} className="thin-scrollbar grid max-h-64 grid-cols-4 gap-1 overflow-y-auto">
						{years.map((year) => {
							const selected = String(year) === String(value);
							return (
								<button
									key={year}
									type="button"
									aria-pressed={selected}
									onClick={() => selectYear(year)}
									className={cn(
										'body-body-14-medium cursor-pointer rounded-ds-4 border-0 px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus',
										selected
											? 'bg-bg-control-checked text-text-control-checked'
											: 'bg-transparent text-text-strong hover:bg-bg-surface-hover'
									)}
								>
									{year}
								</button>
							);
						})}
					</div>
				</div>
			) : null}
		</div>
	);
}
