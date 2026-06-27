import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '../../utils/classNames';
import { Icon } from '../Icon';
import { TextField } from '../TextField';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS_PER_PAGE = 12;

function normalizeYear(value, fallback) {
	if (value === '' || value === null || value === undefined) {
		return fallback;
	}
	const year = Number(value);
	return Number.isFinite(year) ? year : fallback;
}

function clampYear(year, maxYear) {
	return Math.min(maxYear, Math.max(1, year));
}

function getPageStartForYear(year, maxYear) {
	const target = clampYear(normalizeYear(year, maxYear), maxYear);
	const pageOffset = Math.floor((maxYear - target) / YEARS_PER_PAGE);
	return Math.max(1, maxYear - (pageOffset + 1) * YEARS_PER_PAGE + 1);
}

function getOldestPageSize(maxYear) {
	const totalYears = maxYear;
	return ((totalYears - 1) % YEARS_PER_PAGE) + 1;
}

function getNewestPageStart(maxYear) {
	return getPageStartForYear(maxYear, maxYear);
}

function getPageYears(pageStart, maxYear) {
	const pageSize = pageStart === 1 ? getOldestPageSize(maxYear) : YEARS_PER_PAGE;
	const pageEnd = Math.min(maxYear, pageStart + pageSize - 1);
	const years = [];
	for (let year = pageStart; year <= pageEnd; year += 1) {
		years.push(year);
	}
	return years;
}

/**
 * Year-only calendar picker: an editable year field paired with a bounded,
 * paged grid of years for users who prefer choosing instead of typing.
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
	maxYear = CURRENT_YEAR,
	value = '',
}) {
	const generatedId = useId();
	const fieldId = id ?? generatedId;
	const popoverId = `${fieldId}-years`;
	const rootRef = useRef(null);
	const gridRef = useRef(null);
	const [open, setOpen] = useState(false);
	const normalizedMaxYear = normalizeYear(maxYear, CURRENT_YEAR);
	const lastYear = Math.max(1, normalizedMaxYear);
	const [pageStart, setPageStart] = useState(() => getNewestPageStart(lastYear));

	const years = useMemo(() => {
		return getPageYears(pageStart, lastYear);
	}, [lastYear, pageStart]);

	const pageEnd = years[years.length - 1] ?? pageStart;
	const canGoOlder = pageStart > 1;
	const canGoNewer = pageEnd < lastYear;

	useEffect(() => {
		if (open) {
			setPageStart(getNewestPageStart(lastYear));
		}
	}, [lastYear, open]);

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

	// Move focus into the popover (the selected year, else the first) when opened
	// or paged, so keyboard users stay in the chooser.
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
	}, [open, pageStart]);

	function selectYear(year) {
		onChange?.(String(year));
		setOpen(false);
	}

	function handleInputChange(event) {
		onChange?.(event.target.value.replace(/\D/g, '').slice(0, 4));
	}

	function goOlder() {
		if (!canGoOlder) {
			return;
		}
		setPageStart((current) => Math.max(1, current - YEARS_PER_PAGE));
	}

	function goNewer() {
		if (!canGoNewer) {
			return;
		}
		setPageStart((current) => {
			const oldestPageSize = getOldestPageSize(lastYear);
			const nextStart = current === 1 ? 1 + oldestPageSize : current + YEARS_PER_PAGE;
			return Math.min(getNewestPageStart(lastYear), nextStart);
		});
	}

	const hiddenYearValue = value && Number(value) < 2000 ? 'other' : (value ?? '');
	const hiddenCustomYearValue = value && Number(value) < 2000 ? value : '';

	return (
		<div ref={rootRef} className={cn('relative', className)}>
			<TextField
				className="w-full"
				id={fieldId}
				label={label}
				required={required}
				placeholder={placeholder}
				value={value ? String(value) : ''}
				onChange={handleInputChange}
				invalid={Boolean(error)}
				helperText={error}
				rightButtonLabel="Choose"
				onRightButtonClick={() => setOpen((current) => !current)}
				inputMode="numeric"
				pattern="[0-9]*"
				maxLength={4}
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-controls={open ? popoverId : undefined}
			/>
			{name ? (
				<>
					<input type="hidden" name={name} value={hiddenYearValue} />
					<input type="hidden" name={`${name}_custom`} value={hiddenCustomYearValue} />
				</>
			) : null}

			{open ? (
				<div
					id={popoverId}
					role="dialog"
					aria-label="Choose year"
					className="absolute left-0 top-full z-20 mt-2 w-full max-w-[360px] rounded-ds-4 border border-border-strong-constant bg-bg-surface p-3 shadow-2xl"
				>
					<div className="mb-3 grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-2">
						<button
							type="button"
							aria-label="Show older years"
							onClick={goOlder}
							disabled={!canGoOlder}
							className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-ds-4 border-0 bg-transparent text-text-strong transition-colors hover:bg-bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent"
						>
							<Icon name="chevronLeft" size={18} decorative />
						</button>
						<div className="body-body-14-bold text-center text-text-strong" aria-live="polite">
							{pageStart}-{pageEnd}
						</div>
						<button
							type="button"
							aria-label="Show newer years"
							onClick={goNewer}
							disabled={!canGoNewer}
							className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-ds-4 border-0 bg-transparent text-text-strong transition-colors hover:bg-bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent"
						>
							<Icon name="chevronLeft" size={18} decorative className="rotate-180" />
						</button>
					</div>

					<div ref={gridRef} className="grid grid-cols-3 gap-1">
						{years.map((year) => {
							const selected = String(year) === String(value);
							return (
								<button
									key={year}
									type="button"
									aria-pressed={selected}
									onClick={() => selectYear(year)}
									className={cn(
										'body-body-14-medium h-10 cursor-pointer rounded-ds-4 border-0 px-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus',
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
