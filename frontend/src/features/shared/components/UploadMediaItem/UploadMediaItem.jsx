import { Button } from '../Button';
import { Icon } from '../Icon';
import { ProgressBar } from '../ProgressBar';
import { SquareImage } from '../SquareImage';
import { Text } from '../Text';
import { cn } from '../../utils/classNames';
import { formatBytes } from '../../utils/formatBytes';

const STATUS_CONFIG = {
	uploading: {
		statusText: 'Uploading',
		statusClassName: 'text-text-muted',
		progressClassName: 'bg-cinemata-coral-reef-400p',
		showProgress: true,
		actions: [
			{ key: 'pause', label: 'Pause', iconName: 'pause', type: 'warning' },
			{ key: 'cancel', label: 'Cancel', iconName: 'cancel', type: 'danger' },
		],
	},
	paused: {
		statusText: 'Paused',
		statusClassName: 'text-text-muted',
		progressClassName: 'bg-bg-secondary',
		showProgress: true,
		actions: [
			{ key: 'continue', label: 'Continue', iconName: 'playCircle', type: 'warning' },
			{ key: 'cancel', label: 'Cancel', iconName: 'cancel', type: 'danger' },
		],
	},
	complete: {
		statusText: 'Complete',
		statusClassName: 'text-text-success',
		progressClassName: 'bg-bg-success',
		showProgress: false,
		actions: [
			{ key: 'reupload', label: 'Reupload', iconName: 'arrowClockwise' },
			{ key: 'delete', label: 'Delete', iconName: 'trash', type: 'danger' },
		],
	},
	failed: {
		statusText: 'Upload failed',
		statusClassName: 'text-text-danger',
		progressClassName: 'bg-bg-danger',
		showProgress: false,
		actions: [
			{ key: 'retry', label: 'Retry', iconName: 'arrowClockwise', type: 'warning' },
			{ key: 'delete', label: 'Delete', iconName: 'trash', type: 'danger' },
		],
	},
};

const ACTION_CALLBACKS = {
	cancel: 'onCancel',
	continue: 'onContinue',
	delete: 'onDelete',
	pause: 'onPause',
	retry: 'onRetry',
	reupload: 'onReupload',
};

const ACTION_FU_VISIBILITY = {
	cancel: 'group-data-[upload-status=failed]:hidden',
	reupload: 'hidden group-data-[upload-status=complete]:inline-flex',
	delete: 'hidden group-data-[upload-status=complete]:inline-flex group-data-[upload-status=failed]:inline-flex',
};

const ACTION_SELECTOR_CLASSES = {
	cancel: 'qq-upload-cancel-selector text-text-danger hover:text-text-danger',
	continue: 'qq-upload-continue-selector',
	delete: 'qq-upload-delete-selector',
	pause: 'qq-upload-pause-selector',
	retry: 'qq-upload-retry-selector',
	reupload: 'reupload-media-upload-item',
};

function clampPercent(value) {
	const numericValue = Number(value);

	if (!Number.isFinite(numericValue)) {
		return 0;
	}

	return Math.min(Math.max(Math.round(numericValue), 0), 100);
}

function getFileSizeLabel(fileSize) {
	if (typeof fileSize === 'string') {
		return fileSize;
	}

	return formatBytes(fileSize);
}

function UploadLimitMessage({ className = '', contactHref, regularUserMaxFiles, trustedUserMaxFiles }) {
	if (!regularUserMaxFiles || !trustedUserMaxFiles) {
		return null;
	}

	return (
		<Text variant="body-12" as="p" className={cn('m-0 max-w-[520px] text-text-muted', className)}>
			You can upload {regularUserMaxFiles} files max as a Regular User. Only Trusted User can upload up to{' '}
			{trustedUserMaxFiles} files,{' '}
			<a
				className="font-semibold text-text-link underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
				href={contactHref}
			>
				Contact Us
			</a>{' '}
			to request for Trusted User status.
		</Text>
	);
}

function ActionButton({ action, callbacks, includeFineUploaderSelectors }) {
	const callbackName = ACTION_CALLBACKS[action.key];
	const onClicked = callbacks[callbackName];

	const selectorClassName = ACTION_SELECTOR_CLASSES[action.key];
	const textColorClassName =
		action.type === 'danger' ? 'text-text-danger' : action.type === 'warning' ? 'text-text-warning' : '';

	const visibilityClassName = includeFineUploaderSelectors ? ACTION_FU_VISIBILITY[action.key] : '';

	return (
		<span className={cn(selectorClassName, visibilityClassName)}>
			<Button
				type="button"
				variant="text"
				size="xs"
				icon={<Icon name={action.iconName} decorative className={textColorClassName} />}
				iconContainerClassName={selectorClassName}
				className={cn('hover:bg-bg-primary-hover/40 p-0', selectorClassName)}
				textClassName={textColorClassName}
				aria-label={action.label}
				onClick={includeFineUploaderSelectors ? undefined : onClicked}
			>
				{action.label}
			</Button>
		</span>
	);
}

export function UploadMediaItem({
	alt,
	className = '',
	fileSize,
	includeFineUploaderSelectors = false,
	onCancel,
	onContinue,
	onDelete,
	onPause,
	onRetry,
	onReupload,
	progress = 0,
	status = 'uploading',
	thumbnailSrc = '',
	title = 'Untitled media file',
}) {
	const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.uploading;
	const progressPercent = status === 'complete' ? 100 : clampPercent(progress);
	const fileSizeLabel = getFileSizeLabel(fileSize);
	const sizeLabel = [`${progressPercent}%`, fileSizeLabel ? `(${fileSizeLabel})` : ''].filter(Boolean).join(' ');
	const callbacks = { onCancel, onContinue, onDelete, onPause, onRetry, onReupload };
	const showProgress = config.showProgress;
	const thumbnailAlt = alt ?? `${title} thumbnail`;
	const actions = includeFineUploaderSelectors
		? [
				{ key: 'pause', label: 'Pause', iconName: 'pause', type: 'warning' },
				{ key: 'continue', label: 'Continue', iconName: 'playCircle', type: 'warning' },
				{ key: 'cancel', label: 'Cancel', iconName: 'cancel', type: 'danger' },
				{ key: 'reupload', label: 'Replace', iconName: 'arrowClockwise' },
				{ key: 'retry', label: 'Retry', iconName: 'arrowClockwise', type: 'warning' },
				{ key: 'delete', label: 'Delete', iconName: 'trash', type: 'danger' },
			]
		: config.actions;

	return (
		<article
			className={cn(
				'upload-media-item group flex w-full gap-3 rounded-ds-8 bg-bg-surface text-text-primary shadow-sm sm:gap-4',
				className
			)}
			data-upload-status={status}
		>
			<div className="relative h-[72px] w-[72px] shrink-0 self-start">
				<SquareImage
					alt={thumbnailAlt}
					className="h-full w-full [&_img]:aspect-square [&_img]:object-cover"
					imageProps={
						includeFineUploaderSelectors
							? {
									className: 'qq-thumbnail-selector',
									'qq-max-size': '120',
									'qq-server-scale': '',
								}
							: undefined
					}
					loading={false}
					radius={8}
					size={72}
					src={thumbnailSrc}
				/>

				{/* Status overlays toggled by CSS so they react to data-upload-status mutations (no React re-render needed). */}
				<span
					aria-hidden="true"
					className="absolute inset-0 hidden items-center justify-center rounded-ds-8 bg-bg-surface-muted/80 group-data-[upload-status=uploading]:flex"
				>
					<Icon name="loading" decorative size={21} className="animate-spin text-text-panel-heading" />
				</span>
				<span
					aria-hidden="true"
					className="absolute inset-0 hidden items-center justify-center rounded-ds-8 bg-bg-surface-muted/80 group-data-[upload-status=paused]:flex"
				>
					<Icon name="pauseOutlined" decorative size={21} className="text-text-panel-heading" />
				</span>
				<span
					aria-hidden="true"
					className="absolute inset-0 hidden items-center justify-center rounded-ds-8 bg-bg-surface-muted group-data-[upload-status=complete]:flex"
				>
					<Icon name="checklist" decorative size={21} className="text-text-panel-heading" />
				</span>
				<span
					aria-hidden="true"
					className="absolute inset-0 hidden items-center justify-center rounded-ds-8 bg-bg-surface-muted group-data-[upload-status=failed]:flex"
				>
					<Icon name="close" decorative size={21} className="text-text-panel-heading" />
				</span>
			</div>

			<div className="min-w-0 flex-1 space-y-2 flex flex-col justify-center">
				<div className="flex flex-col gap-1 sm:flex-row items-center sm:justify-between sm:gap-3">
					<div className="min-w-0">
						<Text
							variant="body-16-medium"
							as="h3"
							className={cn(
								'm-0 line-clamp-2 wrap-break-word text-text-strong',
								'qq-upload-file-selector'
							)}
							title={title}
						>
							{title}
						</Text>
					</div>
				</div>

				<div className="space-y-2">
					{showProgress ? (
						<ProgressBar
							label={`${title} upload progress`}
							value={progressPercent}
							max={100}
							trackClassName="bg-bg-emblem-green"
							indicatorClassName={cn(config.progressClassName, 'qq-progress-bar-selector')}
							className={cn('qq-progress-bar-container-selector')}
						/>
					) : null}

					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 flex-1 flex-row flex-wrap items-center gap-1">
							<Text
								variant="body-14"
								as="span"
								className="min-h-5 text-text-muted qq-upload-size-selector"
							>
								{includeFineUploaderSelectors ? null : sizeLabel}
							</Text>

							<Text
								variant="body-14"
								as="span"
								className={cn(
									'whitespace-nowrap',
									config.statusClassName,
									'group-data-[upload-status=complete]:text-text-success group-data-[upload-status=failed]:text-text-danger',
									'qq-upload-status-text-selector'
								)}
								role={status === 'failed' ? 'status' : undefined}
							>
								{includeFineUploaderSelectors ? null : config.statusText}
							</Text>
						</div>

						<div className="flex flex-col items-start sm:flex-row sm:flex-wrap sm:items-center">
							{actions.map((action) => (
								<ActionButton
									key={action.key}
									action={action}
									callbacks={callbacks}
									includeFineUploaderSelectors={includeFineUploaderSelectors}
								/>
							))}

							{includeFineUploaderSelectors ? (
								<a
									href="#"
									className="view-uploaded-media-link hidden h-8 rounded-[4px] px-2 py-1 text-text-secondary no-underline hover:bg-bg-surface-muted hover:text-text-strong hover:no-underline"
									target="_blank"
									rel="noreferrer"
								>
									View media
								</a>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}
