import '../../static/css/tailwind.css';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { Badge, Card, Icon, Text } from '../shared/components';
import { ImpactForm } from '../video-viewer/components/community-impact/AddImpactDialog';
import '../video-viewer/components/community-impact/AddImpactDialog.css';
import { getImpactIconConfig } from '../video-viewer/components/community-impact/impactIcons';
import { formatImpactDate } from '../video-viewer/components/community-impact/utils/formatDate';

const STATUS_BADGES = {
	approved: { label: 'APPROVED', color: 'bg/status-approved' },
	waiting_approval: { label: 'WAITING FOR REVIEW', color: 'bg/status-waiting' },
	rejected: { label: 'REJECTED', color: 'bg/surface-inverse' },
};

const SAVE_ACTION = { intent: 'save', label: 'SAVE CHANGES', busyLabel: 'SAVING...' };
const APPROVE_ACTION = { intent: 'approve', label: 'APPROVE', busyLabel: 'APPROVING...' };
const FALLBACK_ERROR = 'The impact could not be saved. Please try again.';

export function getFilmImpactReviewConfig() {
	return (typeof window !== 'undefined' && window.MediaCMS?.filmImpactReviewPage) || {};
}

function firstMessage(value) {
	if (Array.isArray(value)) {
		return value.length ? firstMessage(value[0]) : '';
	}

	if (value && typeof value === 'object') {
		const key = Object.keys(value)[0];
		return key ? firstMessage(value[key]) : '';
	}

	return typeof value === 'string' ? value : '';
}

// The first field error from a DRF response, in the shape the impact form shows.
function toSubmitError(data) {
	if (!data || typeof data !== 'object') {
		return { field: null, message: FALLBACK_ERROR };
	}

	const field = Object.keys(data).find((key) => key !== 'detail' && key !== 'non_field_errors');
	if (field) {
		return { field, message: firstMessage(data[field]) || FALLBACK_ERROR };
	}

	return { field: null, message: firstMessage(data) || FALLBACK_ERROR };
}

async function requestImpact(url, { csrfToken, body, method = 'GET' } = {}) {
	const response = await fetch(url, {
		method,
		credentials: 'same-origin',
		headers: {
			Accept: 'application/json',
			...(body ? { 'Content-Type': 'application/json' } : {}),
			...(method !== 'GET' && csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const data = await response.json().catch(() => null);

	return { ok: response.ok, status: response.status, data };
}

function DetailRow({ children, label }) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="body-body-12-regular text-text-description">{label}</dt>
			<dd className="body-body-14-regular m-0 text-text-strong [overflow-wrap:anywhere]">{children}</dd>
		</div>
	);
}

DetailRow.propTypes = {
	children: PropTypes.node,
	label: PropTypes.string.isRequired,
};

function ImpactSummary({ impact }) {
	const badge = STATUS_BADGES[impact.status];
	const icon = getImpactIconConfig(impact.category);
	const submitter = impact.user?.name || impact.user?.username;

	return (
		<Card className="flex flex-col gap-5 p-6">
			<div className="flex items-center gap-3">
				<span
					aria-hidden="true"
					className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${icon.iconShellClassName}`}
				>
					<Icon name={icon.iconName} size={18} decorative />
				</span>
				<Text as="h2" variant="h6" className="m-0 text-text-strong">
					Impact details
				</Text>
			</div>
			<dl className="m-0 flex flex-col gap-4">
				<DetailRow label="Status">
					{badge ? (
						<Badge color={badge.color} className="caption-caption-10-semibold">
							{badge.label}
						</Badge>
					) : (
						impact.status_label
					)}
				</DetailRow>
				<DetailRow label="Kind of impact">{impact.category_label}</DetailRow>
				{impact.media ? (
					<DetailRow label="Film">
						<a
							href={impact.media.url}
							className="text-text-accent no-underline hover:underline focus-visible:ring-2 focus-visible:ring-ring-focus"
						>
							{impact.media.title}
						</a>
					</DetailRow>
				) : null}
				{submitter ? <DetailRow label="Added by">{submitter}</DetailRow> : null}
				{impact.add_date ? <DetailRow label="Submitted">{formatImpactDate(impact.add_date)}</DetailRow> : null}
			</dl>
		</Card>
	);
}

ImpactSummary.propTypes = {
	impact: PropTypes.object.isRequired,
};

export function FilmImpactReviewPage({ config = getFilmImpactReviewConfig() }) {
	const [impact, setImpact] = useState(null);
	const [loadState, setLoadState] = useState('loading');
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState(null);
	const [message, setMessage] = useState('');

	useEffect(() => {
		let active = true;

		requestImpact(config.apiUrl)
			.then(({ ok, data }) => {
				if (!active) {
					return;
				}
				if (ok && data) {
					setImpact(data);
					setLoadState('ready');
				} else {
					setLoadState('error');
				}
			})
			.catch(() => active && setLoadState('error'));

		return () => {
			active = false;
		};
	}, [config.apiUrl]);

	async function handleSubmit(payload, intent) {
		setSubmitting(true);
		setSubmitError(null);
		setMessage('');

		try {
			const body = intent === 'approve' ? { ...payload, status: 'approved' } : payload;
			const { ok, data } = await requestImpact(config.apiUrl, {
				method: 'PATCH',
				body,
				csrfToken: config.csrfToken,
			});

			if (ok && data) {
				setImpact(data);
				setMessage(intent === 'approve' ? 'Impact approved. It now shows on the film page.' : 'Changes saved.');
			} else {
				setSubmitError(toSubmitError(data));
			}
		} catch {
			setSubmitError({ field: null, message: FALLBACK_ERROR });
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<main className="@container/page mx-4 py-8 text-text-primary sm:mx-6 lg:mx-10">
			<div className="grid grid-cols-1 gap-8 @5xl/page:grid-cols-[minmax(0,1fr)_340px] @5xl/page:items-start">
				<header className="flex flex-col gap-4 @5xl/page:col-span-2">
					<div className="flex items-center">
						<Text variant="h4" as="h1" className="m-0 flex-1 text-text-strong">
							Review Community Impact
						</Text>
						<span className="body-body-12-regular shrink-0 text-text-title-required">* Required</span>
					</div>
					<Text variant="body-16" color="description" className="m-0 max-w-180">
						Check the details, correct anything that needs it, and approve the impact to show it on the film
						page.
					</Text>
					{message ? (
						<Text as="p" variant="body-14-bold" color="accent" className="m-0" aria-live="polite">
							{message}
						</Text>
					) : null}
				</header>

				{loadState === 'loading' ? (
					<p className="body-body-14-regular m-0 text-text-muted">Loading the impact…</p>
				) : null}

				{loadState === 'error' ? (
					<p role="alert" className="body-body-14-regular m-0 text-text-danger">
						This impact could not be loaded. It may have been deleted.{' '}
						{config.manageUrl ? (
							<a href={config.manageUrl} className="text-text-accent">
								Back to Manage Film Impact
							</a>
						) : null}
					</p>
				) : null}

				{loadState === 'ready' && impact ? (
					<>
						<Card className="p-6">
							<ImpactForm
								key={impact.uid}
								intro={false}
								impact={impact}
								actions={impact.status === 'approved' ? [SAVE_ACTION] : [SAVE_ACTION, APPROVE_ACTION]}
								onCancel={() => {
									window.location.href = impact.media?.url || config.manageUrl || '/';
								}}
								onSubmit={handleSubmit}
								onSubmitErrorClear={() => setSubmitError(null)}
								submitError={submitError}
								submitting={submitting}
							/>
						</Card>
						<ImpactSummary impact={impact} />
					</>
				) : null}
			</div>
		</main>
	);
}

FilmImpactReviewPage.propTypes = {
	config: PropTypes.shape({
		apiUrl: PropTypes.string,
		csrfToken: PropTypes.string,
		impactUid: PropTypes.string,
		manageUrl: PropTypes.string,
	}),
};
