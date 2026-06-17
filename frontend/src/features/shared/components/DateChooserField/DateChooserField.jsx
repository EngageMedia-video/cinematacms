import { useRef } from 'react';
import { TextField } from '../TextField';

// Formats an ISO date (YYYY-MM-DD) to the DD/MM/YYYY display format.
export function formatDMY(isoDate) {
	if (!isoDate) {
		return '';
	}

	const [year, month, day] = isoDate.split('-');
	return `${day}/${month}/${year}`;
}

// Read-only date field: the value is shown formatted and the native picker is
// opened via the CHOOSE button — the visible input never accepts typed text.
export function DateChooserField({
	className = 'w-full',
	id,
	label,
	min,
	name,
	onChange,
	placeholder = 'DD / MM / YYYY',
	rightButtonLabel = 'Choose',
	value = '',
}) {
	const inputRef = useRef(null);

	function openPicker() {
		const el = inputRef.current;
		if (!el) {
			return;
		}

		if (typeof el.showPicker === 'function') {
			el.showPicker();
		} else {
			el.click();
		}
	}

	return (
		<div className="relative flex-1">
			<TextField
				className={className}
				label={label}
				placeholder={placeholder}
				value={formatDMY(value)}
				readOnly
				rightButtonLabel={rightButtonLabel}
				onRightButtonClick={openPicker}
			/>
			<input
				ref={inputRef}
				type="date"
				id={id}
				name={name}
				min={min}
				value={value}
				onChange={(event) => onChange?.(event.target.value)}
				tabIndex={-1}
				aria-hidden="true"
				className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
			/>
		</div>
	);
}
