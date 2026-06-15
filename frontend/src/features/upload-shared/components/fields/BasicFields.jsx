import { useMemo } from 'react';
import { TextField, Dropdown, EditorField } from '../../../shared/components';
import { SYNOPSIS_MAX_WORDS, countSynopsisWords } from '../../schema/mediaMetadataSchema';

export function TitleField({ value = '', onChange, error = '' }) {
	return (
		<TextField
			className="w-full"
			label="Enter Title"
			placeholder="The Blue Boat"
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
			invalid={Boolean(error)}
			helperText={error}
			maxLength={100}
		/>
	);
}

export function SynopsisField({ value = '', onChange, error = '' }) {
	const wordCount = countSynopsisWords(value);
	const over = wordCount > SYNOPSIS_MAX_WORDS;
	const counterText = `${wordCount}/${SYNOPSIS_MAX_WORDS} words`;

	return (
		<div className="w-full">
			<EditorField
				className="w-full"
				label="Synopsis *"
				placeholder="Write here…"
				rows={5}
				value={value}
				onChange={(event) => onChange?.(event.target.value)}
				invalid={Boolean(error) || over}
				helperText={error || `Maximum ${SYNOPSIS_MAX_WORDS} Words`}
			/>
			<p
				className={
					over ? 'body-body-12-regular mt-1 text-text-danger' : 'body-body-12-regular mt-1 text-text-muted'
				}
				aria-live="polite"
			>
				{counterText}
			</p>
		</div>
	);
}

export function MoreInfoField({ value = '', onChange }) {
	return (
		<EditorField
			className="w-full"
			label="More Information and Credits"
			placeholder="Write here…"
			rows={5}
			value={value}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	);
}

function buildYearOptions() {
	const currentYear = new Date().getFullYear();
	const years = [];
	for (let year = currentYear; year >= 2000; year -= 1) {
		years.push({ value: String(year), label: String(year) });
	}
	years.push({ value: 'other', label: 'Other (specify year)' });
	return years;
}

export function YearProducedField({ value = '', customValue = '', onChange, error = '' }) {
	const options = useMemo(buildYearOptions, []);
	const currentYear = new Date().getFullYear();

	return (
		<div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end">
			<Dropdown
				className="w-full"
				label="Year Produced *"
				placeholder="-- Select Year --"
				options={options}
				value={value}
				onChange={(next) =>
					onChange?.({ year_produced: next, year_produced_custom: next === 'other' ? customValue : '' })
				}
				invalid={Boolean(error)}
				helperText={error}
			/>
			{value === 'other' ? (
				<TextField
					className="w-full"
					label="Specify Year"
					type="number"
					min={1900}
					max={currentYear}
					placeholder="e.g. 1995"
					value={customValue}
					onChange={(event) =>
						onChange?.({ year_produced: 'other', year_produced_custom: event.target.value })
					}
				/>
			) : null}
		</div>
	);
}
