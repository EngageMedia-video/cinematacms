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
	const categoryOptions = useMemo(() => categories.map((category) => ({ ...category })), [categories]);

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
				className="w-full max-w-[calc(var(--size-96)*5+var(--size-40))] rounded-ds-8 border border-border-default bg-bg-surface p-space-lg shadow-lg"
			>
				<form onSubmit={handleSubmit} noValidate>
					<div className="flex items-start justify-between gap-space-base">
						<span
							className={`${heartConfig.iconShellClassName} inline-flex h-size-48 w-size-48 shrink-0 items-center justify-center rounded-full`}
							aria-hidden="true"
						>
							<Icon name={heartConfig.iconName} size="md" decorative />
						</span>
						<Button
							variant="icon"
							className="h-size-32 w-size-32 rounded-full text-text-muted outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-ring-focus"
							aria-label="Close add impact dialog"
							onClick={onClose}
							icon={<Icon name="close" size="sm" decorative />}
						/>
					</div>

					<Text variant="h5" as="h2" className="m-0 mt-space-base text-text-primary">
						Where has this film made an impact?
					</Text>
					<Text variant="body-14" color="meta" className="m-0 mt-space-xs">
						Add a community impact signal that helps viewers understand this film's reach.
					</Text>

					<div className="mt-space-lg grid gap-space-base">
						<TextField
							className="w-full"
							label="Where did you see this film"
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
							className="w-full"
							label="When did this happen"
							type="date"
							value={values.eventDate}
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
