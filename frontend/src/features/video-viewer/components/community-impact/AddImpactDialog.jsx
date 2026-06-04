import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogContent, Dropdown, EditorField, Icon, TextField } from '../../../shared/components';
import { COMMUNITY_IMPACT_CATEGORIES, getImpactIconConfig } from './impactIcons';
import './AddImpactDialog.css';

const ADD_IMPACT_CATEGORY_VALUES = new Set(['screening', 'featured', 'academic']);

function createEmptyValues() {
	return {
		category: '',
		details: '',
		link: '',
		location: '',
	};
}

function countWords(value) {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

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

export function AddImpactDialog({
	categories = COMMUNITY_IMPACT_CATEGORIES,
	onClose,
	onSubmit,
	onSubmitErrorClear,
	open = false,
	submitError = null,
	submitting = false,
}) {
	const [values, setValues] = useState(createEmptyValues);
	const [linkError, setLinkError] = useState('');
	const wordCount = countWords(values.details);
	const wordLimitExceeded = wordCount > 80;
	const canSubmit = values.location.trim() && values.category && !wordLimitExceeded && !submitting;
	const formError = submitError && submitError.field !== 'url' ? submitError.message : '';
	const heartConfig = getImpactIconConfig('heart');
	const categoryOptions = useMemo(
		() => categories.filter((category) => ADD_IMPACT_CATEGORY_VALUES.has(category.value)),
		[categories]
	);

	useEffect(() => {
		if (open && submitError?.field === 'url') {
			setLinkError(submitError.message);
		}
	}, [open, submitError]);

	useEffect(() => {
		if (!open) {
			setValues(createEmptyValues());
			setLinkError('');
		}
	}, [open]);

	function updateValue(name, value) {
		setValues((current) => ({
			...current,
			[name]: value,
		}));
		if (name === 'link' && linkError) {
			setLinkError('');
		}
		if (submitError) {
			onSubmitErrorClear?.();
		}
	}

	function handleSubmit(event) {
		event.preventDefault();

		if (!canSubmit) {
			return;
		}

		const normalizedLink = normalizeImpactLink(values.link);
		if (normalizedLink === null) {
			setLinkError('Enter a valid https link, e.g. https://drive.google.com/file/d/abc/view');
			return;
		}

		onSubmit?.({
			category: values.category,
			details: values.details.trim(),
			link: normalizedLink,
			location: values.location.trim(),
			title: values.location.trim(),
			url: normalizedLink,
		});
	}

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
				className="impact-add-dialog flex max-h-[calc(100vh-var(--size-64))] w-full max-w-[544px] flex-col overflow-hidden rounded-ds-8 border border-border-default bg-bg-impact-modal-surface shadow-lg"
			>
				<form
					onSubmit={handleSubmit}
					noValidate
					className="impact-add-form relative flex max-h-full flex-col items-center overflow-y-auto px-[64px] pb-[44px] pt-[58px] max-[560px]:px-6 max-[560px]:pt-10"
				>
					<Button
						variant="icon"
						className="absolute right-4 top-4 h-size-32 w-size-32 rounded-full text-text-impact-modal-subtitle outline-none hover:text-text-impact-modal-value focus-visible:ring-2 focus-visible:ring-ring-focus"
						aria-label="Close add impact dialog"
						onClick={onClose}
						type="button"
						icon={<Icon name="close" size="sm" decorative />}
					/>

					<div className="flex w-full flex-col items-center text-center">
						<span
							className="inline-flex h-[58px] w-[58px] shrink-0 items-center justify-center text-bg-impact-modal-close"
							aria-hidden="true"
						>
							<Icon name={heartConfig.iconName} size={67} decorative />
						</span>

						<h2 className="m-0 mt-[26px] text-[20px] font-bold leading-[24px] text-text-impact-modal-heading">
							Where has this film made an impact?
						</h2>
						<p className="m-0 mt-[11px] max-w-[404px] text-[16px] font-normal leading-[24px] text-text-impact-modal-subtitle">
							For filmmakers &amp; viewers. Add screenings, playlists, or discussions to show how this
							film is reaching people.
						</p>
					</div>

					<div className="mt-[33px] grid w-full max-w-[404px] gap-0">
						<TextField
							className="impact-add-field w-full"
							label="Where did you see this film"
							value={values.location}
							onChange={(event) => updateValue('location', event.target.value)}
							required
						/>
						<EditorField
							className="impact-add-field impact-details-field w-full"
							label="Add more details"
							placeholder="Write here..."
							value={values.details}
							onChange={(event) => updateValue('details', event.target.value)}
							helperText={`Maximum 80 Words${wordLimitExceeded ? ` • ${wordCount}/80` : ''}`}
							invalid={wordLimitExceeded}
							rows={5}
						/>
						<Dropdown
							className="impact-add-field w-full"
							label="Choose a category"
							options={categoryOptions}
							placeholder="Select community impact category"
							value={values.category}
							onChange={(value) => updateValue('category', value)}
						/>
						<TextField
							className="impact-add-field w-full"
							label="Add a link"
							type="url"
							value={values.link}
							onChange={(event) => updateValue('link', event.target.value)}
							helperText={linkError}
							invalid={Boolean(linkError)}
						/>
					</div>

					{formError ? (
						<p className="m-0 mt-[16px] max-w-[404px] text-center text-[12px] leading-[18px] text-text-danger">
							{formError}
						</p>
					) : null}

					<Button
						className="mt-[16px] h-[40px] w-[316px] max-w-full justify-center whitespace-nowrap bg-bg-impact-modal-submit px-0 py-0 text-[14px] font-bold leading-none text-text-on-primary hover:bg-bg-impact-modal-submit-hover focus-visible:ring-2 focus-visible:ring-ring-focus"
						disabled={!canSubmit}
						type="submit"
					>
						{submitting ? 'SUBMITTING...' : 'SUBMIT COMMUNITY IMPACT'}
					</Button>
				</form>
			</DialogContent>
		</Dialog>
	);
}

AddImpactDialog.propTypes = {
	categories: PropTypes.arrayOf(
		PropTypes.shape({
			label: PropTypes.string.isRequired,
			value: PropTypes.string.isRequired,
		})
	),
	onClose: PropTypes.func,
	onSubmit: PropTypes.func,
	onSubmitErrorClear: PropTypes.func,
	open: PropTypes.bool,
	submitError: PropTypes.shape({
		field: PropTypes.string,
		message: PropTypes.string.isRequired,
	}),
	submitting: PropTypes.bool,
};
