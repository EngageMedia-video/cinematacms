import { useEffect, useId, useState } from 'react';

import * as PageActions from '../../../../static/js/pages/_PageActions.js';
import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';
import * as MediaPageActions from '../../../../static/js/pages/MediaPage/actions.js';

import {
	Button,
	ConfirmationDialogContent,
	Dialog,
	DialogClose,
	DialogContent,
	DialogTrigger,
	Icon,
	Text,
} from '../../../shared/components';
import { cn } from '../../../shared/utils/classNames.js';
import { usePausePlayerWhileOpen } from './usePausePlayerWhileOpen';

function viewerReportedMedia() {
	return true === MediaPageStore.get('user-reported-media');
}

export function MediaReportButton() {
	const descriptionId = useId();
	const [isOpen, setIsOpen] = useState(false);
	const [description, setDescription] = useState('');
	const [descriptionInvalid, setDescriptionInvalid] = useState(false);
	const [status, setStatus] = useState('idle');
	const [reported, setReported] = useState(viewerReportedMedia);

	usePausePlayerWhileOpen(isOpen);

	useEffect(() => {
		function onReported() {
			PageActions.addNotification('Film reported', 'reportedMedia');
			setReported(true);
			setStatus('idle');
			setDescription('');
			setIsOpen(false);
		}

		function onRetracted() {
			PageActions.addNotification('Report withdrawn', 'reportRetracted');
			setReported(false);
			setStatus('idle');
			setIsOpen(false);
		}

		function onRequestFailed() {
			setStatus('failed');
		}

		function onMediaLoaded() {
			setReported(viewerReportedMedia());
		}

		MediaPageStore.on('reported_media', onReported);
		MediaPageStore.on('media_report_failed', onRequestFailed);
		MediaPageStore.on('media_report_retracted', onRetracted);
		MediaPageStore.on('media_report_retract_failed', onRequestFailed);
		MediaPageStore.on('loaded_media_data', onMediaLoaded);

		return () => {
			MediaPageStore.removeListener('reported_media', onReported);
			MediaPageStore.removeListener('media_report_failed', onRequestFailed);
			MediaPageStore.removeListener('media_report_retracted', onRetracted);
			MediaPageStore.removeListener('media_report_retract_failed', onRequestFailed);
			MediaPageStore.removeListener('loaded_media_data', onMediaLoaded);
		};
	}, []);

	function onOpenChange(nextOpen) {
		setIsOpen(nextOpen);

		if (!nextOpen) {
			setDescription('');
			setDescriptionInvalid(false);
			setStatus((current) => ('failed' === current ? 'idle' : current));
		}
	}

	function onRetract() {
		setStatus('submitting');
		MediaPageActions.retractMediaReport();
	}

	function onSubmit(event) {
		event.preventDefault();

		const trimmedDescription = description.trim();
		if (!trimmedDescription) {
			setDescriptionInvalid(true);
			return;
		}

		setStatus('submitting');
		MediaPageActions.reportMedia(trimmedDescription);
	}

	function onDescriptionChange(event) {
		setDescription(event.target.value);
		if (descriptionInvalid) setDescriptionInvalid(false);
	}

	const submitting = 'submitting' === status;
	const label = reported ? 'Reported' : 'Report';

	function renderTrigger({ withText }) {
		return (
			<DialogTrigger>
				<Button
					aria-label={label}
					variant="tertiary"
					icon={<Icon name="flag" className={reported ? 'text-text-accent' : 'text-current'} />}
					className={cn('body-body-14-medium whitespace-nowrap', withText ? undefined : 'p-size-8')}
					size="sm"
				>
					{withText ? (
						<Text as="span" variant="body-14-medium" className="whitespace-nowrap text-current">
							{label}
						</Text>
					) : null}
				</Button>
			</DialogTrigger>
		);
	}

	const requestFailed = 'failed' === status;

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<div className="sm:hidden">{renderTrigger({ withText: false })}</div>
			<div className="hidden sm:block">{renderTrigger({ withText: true })}</div>

			{reported ? (
				<ConfirmationDialogContent
					aria-label="Withdraw report"
					title="Withdraw your report?"
					subtitle="Moderators will no longer review your report."
					actions={
						<>
							<DialogClose>
								<Button type="button" variant="tertiary" size="sm">
									Keep report
								</Button>
							</DialogClose>
							<Button type="button" variant="primary" size="sm" disabled={submitting} onClick={onRetract}>
								{submitting ? 'Withdrawing…' : 'Withdraw report'}
							</Button>
						</>
					}
				>
					{requestFailed ? (
						<Text as="p" role="alert" variant="body-14" className="m-0 p-0 text-text-danger">
							The report could not be withdrawn. Try again.
						</Text>
					) : null}
				</ConfirmationDialogContent>
			) : (
				<DialogContent
					aria-label="Report film"
					className="w-full max-w-110 rounded-ds-12 bg-bg-surface shadow-2xl"
				>
					<form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-size-16 px-8 py-8">
						<Text as="h2" variant="h4-medium" className="m-0 text-text-strong">
							Report this film
						</Text>

						<div className="flex flex-col gap-size-6">
							<label htmlFor={descriptionId}>
								<Text as="span" variant="body-12-medium" className="text-text-strong">
									Description
								</Text>
							</label>
							<textarea
								id={descriptionId}
								rows={4}
								required
								placeholder="Tell us what is wrong with this film..."
								value={description}
								onChange={onDescriptionChange}
								aria-invalid={descriptionInvalid ? 'true' : undefined}
								aria-describedby={`${descriptionId}-help`}
								className={cn(
									'body-body-14-regular w-full resize-y rounded-ds-8 border bg-bg-surface px-size-12 py-size-10 text-text-strong outline-none transition-colors focus:border-border-input focus:ring-0',
									descriptionInvalid ? 'border-border-danger' : 'border-border-strong-constant'
								)}
							/>
							<Text
								as="span"
								id={`${descriptionId}-help`}
								variant="body-12-regular"
								className={descriptionInvalid ? 'text-text-danger' : 'text-text-muted'}
							>
								{descriptionInvalid ? 'Enter a description.' : 'Moderators review reported films.'}
							</Text>
						</div>

						{requestFailed && (
							<Text as="p" role="alert" variant="body-14" className="m-0 p-0 text-text-danger">
								The report could not be sent. Try again.
							</Text>
						)}

						<div className="flex justify-end gap-size-8">
							<DialogClose>
								<Button type="button" variant="tertiary" size="sm">
									Cancel
								</Button>
							</DialogClose>
							<Button type="submit" variant="primary" size="sm" disabled={submitting}>
								{submitting ? 'Submitting…' : 'Submit'}
							</Button>
						</div>
					</form>
				</DialogContent>
			)}
		</Dialog>
	);
}
