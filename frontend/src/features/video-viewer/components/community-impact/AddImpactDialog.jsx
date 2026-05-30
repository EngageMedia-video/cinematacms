import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import {
	Button,
	Dialog,
	DialogContent,
	Dropdown,
	EditorField,
	Icon,
	Text,
	TextField,
} from '../../../shared/components';
import { COMMUNITY_IMPACT_CATEGORIES, getImpactIconConfig } from './impactIcons';
import './AddImpactDialog.css';

const EMPTY_VALUES = {
	category: '',
	details: '',
	eventDate: '',
	link: '',
	location: '',
};

function countWords(value) {
	return value.trim().split(/\s+/).filter(Boolean).length;
}

function openDatePicker(event) {
	event.currentTarget.showPicker?.();
}

export function normalizeImpactLink(raw) {
	const trimmed = (raw || '').trim();
	if (!trimmed) {
		return '';
	}

	const tryParse = (candidate) => {
		try {
			const url = new URL(candidate);
			if (url.protocol === 'http:' || url.protocol === 'https:') {
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

export function AddImpactDialog({ categories = COMMUNITY_IMPACT_CATEGORIES, onClose, onSubmit, open = false }) {
	const [values, setValues] = useState(EMPTY_VALUES);
	const [linkError, setLinkError] = useState('');
	const wordCount = countWords(values.details);
	const wordLimitExceeded = wordCount > 80;
	const canSubmit = values.location.trim() && values.category && values.eventDate && !wordLimitExceeded;
	const heartConfig = getImpactIconConfig('heart');
	const categoryOptions = useMemo(() => categories.filter((category) => category.value !== 'saves'), [categories]);

	function updateValue(name, value) {
		setValues((current) => ({
			...current,
			[name]: value,
		}));
		if (name === 'link' && linkError) {
			setLinkError('');
		}
	}

	function handleSubmit(event) {
		event.preventDefault();

		if (!canSubmit) {
			return;
		}

		const normalizedLink = normalizeImpactLink(values.link);
		if (normalizedLink === null) {
			setLinkError('Enter a valid http(s) link, e.g. https://example.com');
			return;
		}

		onSubmit?.({
			category: values.category,
			details: values.details.trim(),
			event_date: values.eventDate,
			link: normalizedLink,
			location: values.location.trim(),
			title: values.location.trim(),
			url: normalizedLink,
		});
		setValues(EMPTY_VALUES);
		setLinkError('');
		onClose?.();
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
				className="flex max-h-[calc(100vh-var(--size-64))] w-full max-w-[calc(var(--size-96)*5+var(--size-40))] flex-col overflow-hidden rounded-ds-8 border border-border-default bg-bg-surface shadow-lg"
			>
				<form
					onSubmit={handleSubmit}
					noValidate
					className="flex max-h-full flex-col overflow-y-auto p-space-lg"
				>
					<div className="flex justify-end">
						<Button
							variant="icon"
							className="h-size-32 w-size-32 rounded-full text-text-muted outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring-focus"
							aria-label="Close add impact dialog"
							onClick={onClose}
							icon={<Icon name="close" size="sm" decorative />}
						/>
					</div>

					<div className="flex flex-col items-center text-center">
						<span
							className="inline-flex h-size-80 w-size-80 shrink-0 items-center justify-center text-text-accent"
							aria-hidden="true"
						>
							<Icon name={heartConfig.iconName} size={64} decorative />
						</span>

						<Text variant="h5" as="h2" className="m-0 mt-space-base text-text-primary">
							Where this film has made an impact?
						</Text>
						<Text variant="body-14" color="meta" className="m-0 mt-space-xs">
							For filmmakers &amp; viewers. Add screenings, playlists, or discussions to show how this
							film is reaching people.
						</Text>
					</div>

					<div className="mt-space-lg grid gap-space-base">
						<TextField
							className="w-full"
							label="Where did this impact happen?"
							placeholder="Venue, event, article, course, or playlist"
							value={values.location}
							onChange={(event) => updateValue('location', event.target.value)}
							required
						/>
						<EditorField
							className="w-full"
							label="Add more details"
							value={values.details}
							onChange={(event) => updateValue('details', event.target.value)}
							helperText={`Maximum 80 Words${wordCount ? ` • ${wordCount}/80` : ''}`}
							invalid={wordLimitExceeded}
							rows={5}
						/>
						<TextField
							className="impact-date-field w-full"
							label="Date of impact"
							type="date"
							value={values.eventDate}
							onClick={openDatePicker}
							onChange={(event) => updateValue('eventDate', event.target.value)}
							required
						/>
						<Dropdown
							className="w-full"
							label="Choose a category"
							options={categoryOptions}
							placeholder="Select community impact category"
							value={values.category}
							onChange={(value) => updateValue('category', value)}
						/>
						<TextField
							className="w-full"
							label="Add a link"
							type="url"
							value={values.link}
							onChange={(event) => updateValue('link', event.target.value)}
							helperText={linkError}
							invalid={Boolean(linkError)}
						/>
					</div>

					<Button
						className="mt-space-lg w-full justify-center focus-visible:ring-2 focus-visible:ring-ring-focus"
						disabled={!canSubmit}
						type="submit"
					>
						SUBMIT COMMUNITY IMPACT
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
	open: PropTypes.bool,
};
