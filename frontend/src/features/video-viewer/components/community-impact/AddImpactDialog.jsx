import PropTypes from 'prop-types';
import { useId, useState } from 'react';
import {
	Button,
	CheckboxButton,
	Dialog,
	DialogContent,
	Dropdown,
	EditorField,
	TextField,
} from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames';
import heartIcon from './assets/impact-heart.svg';
import rippleDecoration from './assets/impact-ripple.svg';
import {
	IMPACT_DETAILS_MAX_WORDS,
	IMPACT_FORM_CATEGORIES,
	MIN_IMPACT_YEAR,
	getVisibleImpactFields,
} from './impactFormFields';
import './AddImpactDialog.css';

const REQUIRED_MESSAGE = 'This field is required.';
const INVALID_LINK_MESSAGE = 'Enter a valid https link, e.g. https://drive.google.com/file/d/abc/view';

export function normalizeImpactLink(raw) {
	const trimmed = (raw || '').trim();
	if (!trimmed) {
		return '';
	}

	const tryParse = (candidate) => {
		try {
			const url = new URL(candidate);
			if (url.protocol === 'https:') {
				return url.toString();
			}
			return null;
		} catch {
			return null;
		}
	};

	const direct = tryParse(trimmed);
	if (direct !== null) {
		return direct;
	}

	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
		return null;
	}

	return tryParse(`https://${trimmed}`);
}

function isBlank(value) {
	return typeof value !== 'string' || value.trim() === '';
}

function validateYear(raw) {
	const currentYear = new Date().getFullYear();
	const year = Number(raw);

	if (!/^\d{4}$/.test(raw.trim()) || year < MIN_IMPACT_YEAR || year > currentYear) {
		return `Enter a year between ${MIN_IMPACT_YEAR} and ${currentYear}.`;
	}

	return '';
}

// Returns the submission payload, or the per-field errors that block it.
function buildSubmission(category, values) {
	const errors = {};
	const payload = { category };

	for (const field of getVisibleImpactFields(category, values)) {
		const value = values[field.name];

		if (field.type === 'checkbox') {
			payload[field.name] = value === true;
			continue;
		}

		const text = typeof value === 'string' ? value.trim() : '';

		if (field.required && isBlank(text)) {
			errors[field.name] = REQUIRED_MESSAGE;
			continue;
		}

		if (field.type === 'year') {
			const yearError = validateYear(text);
			if (yearError) {
				errors[field.name] = yearError;
			} else {
				payload.year = Number(text);
			}
			continue;
		}

		if (field.type === 'url') {
			const link = normalizeImpactLink(text);
			if (link === null) {
				errors[field.name] = INVALID_LINK_MESSAGE;
			} else {
				payload.url = link;
			}
			continue;
		}

		payload[field.name] = text;
	}

	return { errors, payload };
}

function CategoryOption({ category, checked, name, onSelect }) {
	return (
		<label
			className={cn(
				'flex cursor-pointer flex-col gap-2 px-4 py-2 outline-none has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring-focus',
				checked ? 'bg-bg-primary text-text-on-primary' : 'bg-bg-surface-raised text-text-strong'
			)}
		>
			<input
				type="radio"
				className="sr-only"
				name={name}
				value={category.value}
				checked={checked}
				onChange={() => onSelect(category.value)}
			/>
			<span className="body-body-14-bold">{category.label}</span>
			<span className={cn('body-body-12-regular', checked ? 'text-text-on-primary' : 'text-text-description')}>
				{category.description}
			</span>
		</label>
	);
}

CategoryOption.propTypes = {
	category: PropTypes.shape({
		description: PropTypes.string.isRequired,
		label: PropTypes.string.isRequired,
		value: PropTypes.string.isRequired,
	}).isRequired,
	checked: PropTypes.bool.isRequired,
	name: PropTypes.string.isRequired,
	onSelect: PropTypes.func.isRequired,
};

function ImpactField({ error, field, onChange, value }) {
	const helperText = error || field.helperText || '';
	const invalid = Boolean(error);

	if (field.type === 'checkbox') {
		return (
			<CheckboxButton
				className={cn('py-4', field.description ? 'items-start' : '')}
				controlStyle={{ width: 26, height: 26 }}
				checked={value === true}
				name={field.name}
				onChange={(event) => onChange(field.name, event.target.checked)}
			>
				{field.description ? (
					<span className="flex flex-col gap-2">
						<span>{field.label}</span>
						<span className="body-body-12-regular">{field.description}</span>
					</span>
				) : (
					field.label
				)}
			</CheckboxButton>
		);
	}

	if (field.type === 'select') {
		return (
			<Dropdown
				className="impact-add-field w-full"
				label={field.label}
				name={field.name}
				options={field.options}
				placeholder="Choose one"
				value={value ?? ''}
				onChange={(nextValue) => onChange(field.name, nextValue)}
				helperText={error}
				invalid={invalid}
			/>
		);
	}

	if (field.type === 'textarea') {
		return (
			<EditorField
				className="impact-add-field impact-details-field w-full"
				label={field.label}
				name={field.name}
				placeholder="Write here..."
				value={value ?? ''}
				onChange={(event) => onChange(field.name, event.target.value)}
				helperText={helperText}
				invalid={invalid}
				maxWordsLength={IMPACT_DETAILS_MAX_WORDS}
				rows={4}
			/>
		);
	}

	return (
		<TextField
			className="impact-add-field w-full"
			label={field.label}
			name={field.name}
			type={field.type === 'url' ? 'url' : 'text'}
			inputMode={field.type === 'year' ? 'numeric' : undefined}
			maxLength={field.maxLength ?? (field.type === 'year' ? 4 : 200)}
			placeholder={field.type === 'url' ? 'https://' : undefined}
			aria-required={field.required ? 'true' : undefined}
			value={value ?? ''}
			onChange={(event) => onChange(field.name, event.target.value)}
			helperText={helperText}
			invalid={invalid}
			transparent
		/>
	);
}

ImpactField.propTypes = {
	error: PropTypes.string,
	field: PropTypes.shape({
		description: PropTypes.string,
		helperText: PropTypes.string,
		label: PropTypes.string.isRequired,
		maxLength: PropTypes.number,
		name: PropTypes.string.isRequired,
		options: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, value: PropTypes.string })),
		required: PropTypes.bool,
		type: PropTypes.oneOf(['checkbox', 'select', 'text', 'textarea', 'url', 'year']).isRequired,
	}).isRequired,
	onChange: PropTypes.func.isRequired,
	value: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
};

// Lives inside DialogContent, which unmounts on close, so every open starts blank.
function AddImpactForm({ onClose, onSubmit, onSubmitErrorClear, submitError, submitting }) {
	const [category, setCategory] = useState('');
	const [values, setValues] = useState({});
	const [errors, setErrors] = useState({});
	const categoryLabelId = useId();
	const categoryErrorId = useId();
	const categoryGroupName = useId();
	const fields = getVisibleImpactFields(category, values);
	const fieldNames = new Set(fields.map((field) => field.name));
	const serverFieldError = submitError?.field && fieldNames.has(submitError.field) ? submitError : null;
	const formError = submitError && !serverFieldError ? submitError.message : '';

	function clearSubmitError() {
		if (submitError) {
			onSubmitErrorClear?.();
		}
	}

	function handleCategorySelect(nextCategory) {
		setCategory(nextCategory);
		// Other categories reuse the organiser field without a privacy option.
		setValues((current) =>
			current.organiser_private ? { ...current, organiser: '', organiser_private: false } : current
		);
		setErrors({});
		clearSubmitError();
	}

	function handleValueChange(name, value) {
		setValues((current) => ({ ...current, [name]: value }));
		setErrors((current) => {
			if (!current[name]) {
				return current;
			}
			const { [name]: _removed, ...rest } = current;
			return rest;
		});
		clearSubmitError();
	}

	function handleSubmit(event) {
		event.preventDefault();

		if (submitting) {
			return;
		}

		if (!category) {
			setErrors({ category: 'Choose what kind of impact this is.' });
			return;
		}

		const submission = buildSubmission(category, values);
		setErrors(submission.errors);

		if (Object.keys(submission.errors).length === 0) {
			onSubmit?.(submission.payload);
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			noValidate
			className="impact-add-form relative flex max-h-[calc(100vh-var(--size-64))] flex-col items-center gap-8 overflow-y-auto p-6"
		>
			<img src={heartIcon} alt="" aria-hidden="true" width={58} height={54} className="relative shrink-0" />

			<div className="relative flex w-full flex-col items-center gap-6">
				<div className="flex w-full flex-col items-center gap-5 text-center">
					<h2 className="heading-h4-32-medium m-0 text-text-strong">Where has this film made an impact?</h2>
					<p className="body-body-14-regular m-0 text-text-description">
						Tell us where this film has been screened, written about, taught, or recognised.
					</p>
				</div>

				<div className="flex w-full flex-col gap-2">
					<p id={categoryLabelId} className="body-body-16-regular m-0 text-text-description">
						What kind of impact?<span aria-hidden="true"> *</span>
					</p>
					<div
						role="radiogroup"
						aria-labelledby={categoryLabelId}
						aria-required="true"
						aria-invalid={errors.category ? 'true' : undefined}
						aria-describedby={errors.category ? categoryErrorId : undefined}
						className="grid grid-cols-1 gap-2 sm:grid-cols-2"
					>
						{IMPACT_FORM_CATEGORIES.map((option) => (
							<CategoryOption
								key={option.value}
								category={option}
								checked={category === option.value}
								name={categoryGroupName}
								onSelect={handleCategorySelect}
							/>
						))}
					</div>
					{errors.category ? (
						<p id={categoryErrorId} className="body-body-14-regular m-0 text-text-danger" role="alert">
							{errors.category}
						</p>
					) : null}
				</div>

				{category ? (
					<div
						className="flex w-full flex-col gap-4 rounded-[16px] bg-bg-surface px-[22px] py-8"
						data-testid="impact-category-fields"
					>
						{fields.map((field) => (
							<ImpactField
								key={`${category}-${field.name}`}
								field={field}
								value={values[field.name]}
								error={
									errors[field.name] ||
									(serverFieldError?.field === field.name ? serverFieldError.message : '')
								}
								onChange={handleValueChange}
							/>
						))}
					</div>
				) : null}

				{formError ? (
					<p className="body-body-14-regular m-0 w-full text-center text-text-danger" role="alert">
						{formError}
					</p>
				) : null}

				<div className="flex w-full flex-wrap items-center justify-end gap-2">
					<Button
						variant="secondary"
						className="h-10 px-4 py-0 focus-visible:ring-2 focus-visible:ring-ring-focus"
						onClick={onClose}
					>
						CANCEL
					</Button>
					<Button
						type="submit"
						className="h-10 bg-bg-secondary px-4 py-0 text-text-on-primary hover:bg-bg-secondary-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
						disabled={submitting}
					>
						{submitting ? 'SUBMITTING...' : 'ADD IMPACT'}
					</Button>
				</div>
			</div>
		</form>
	);
}

const submitErrorShape = PropTypes.shape({
	field: PropTypes.string,
	message: PropTypes.string.isRequired,
});

AddImpactForm.propTypes = {
	onClose: PropTypes.func,
	onSubmit: PropTypes.func,
	onSubmitErrorClear: PropTypes.func,
	submitError: submitErrorShape,
	submitting: PropTypes.bool,
};

export function AddImpactDialog({
	onClose,
	onSubmit,
	onSubmitErrorClear,
	open = false,
	submitError = null,
	submitting = false,
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					onClose?.();
				}
			}}
		>
			<DialogContent
				aria-label="Add community impact"
				className="impact-add-dialog w-full max-w-[640px] overflow-hidden rounded-[16px] bg-linear-to-br from-bg-surface from-35% to-bg-page p-0 shadow-lg"
			>
				{/* Outside the scrolling form so the overhanging art cannot widen its scroll area. */}
				<img
					src={rippleDecoration}
					alt=""
					aria-hidden="true"
					width={298}
					height={295}
					className="pointer-events-none absolute right-[-130px] bottom-[-120px] h-[295px] w-[298px] invert dark:invert-0"
				/>
				<AddImpactForm
					onClose={onClose}
					onSubmit={onSubmit}
					onSubmitErrorClear={onSubmitErrorClear}
					submitError={submitError}
					submitting={submitting}
				/>
			</DialogContent>
		</Dialog>
	);
}

AddImpactDialog.propTypes = {
	onClose: PropTypes.func,
	onSubmit: PropTypes.func,
	onSubmitErrorClear: PropTypes.func,
	open: PropTypes.bool,
	submitError: submitErrorShape,
	submitting: PropTypes.bool,
};
