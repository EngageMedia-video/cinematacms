import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTaxonomies, validateMetadata } from '../../../shared/components/upload-media';
import { apiFetch } from '../../../shared/utils/api';
import useBulkUploadStore, { UPLOAD_STATUS } from '../useBulkUploadStore';
import { useBulkUploadConfig } from '../bulkUploadConfig';
import { useBulkUpload } from '../hooks/useBulkUpload';
import { useSubmitBulk } from '../hooks/useSubmitBulk';
import { buildSubmitItems } from '../buildSubmitItems';
import { BulkUploadActionsProvider } from '../BulkUploadActionsContext';
import { WizardStepper } from './WizardStepper';
import { WizardFooter } from './WizardFooter';
import { Step1UploadMedia } from './step1/Step1UploadMedia';
import { EnterDetails } from './step2/EnterDetails';
import { PreviewSubmit } from './step3/PreviewSubmit';
import { RedirectNoticeDialog } from './RedirectNoticeDialog';
import { SubmitForReviewDialog } from './SubmitForReviewDialog';
import { TextAlert } from '../../../shared/components';

const SUB_STEP_ORDER = ['basic', 'thumbnail', 'other', 'final'];
const SUB_STEP_LABELS = {
	basic: 'Basic Details',
	thumbnail: 'Thumbnail Image Upload',
	other: 'Other Details',
	final: 'Final Settings',
};

// Which sub-step each metadata field lives on, so a validation error can send
// the user straight to the tab that needs attention.
const FIELD_SUB_STEP = {
	title: 'basic',
	summary: 'basic',
	description: 'basic',
	year_produced: 'basic',
	year_produced_custom: 'basic',
	company: 'other',
	website: 'other',
	media_language: 'other',
	media_country: 'other',
	category: 'other',
	topics: 'other',
	content_sensitivity: 'other',
	new_tags: 'other',
	custom_license: 'other',
	no_license: 'other',
	enable_comments: 'final',
	allow_download: 'final',
	state: 'final',
	password: 'final',
};

const VALIDATION_BANNER = 'Please complete the required fields highlighted below.';

function normalizeFieldErrors(fieldErrors) {
	return Object.fromEntries(
		Object.entries(fieldErrors).map(([field, message]) => [
			field,
			Array.isArray(message) ? message[0] : String(message),
		])
	);
}

// First sub-step (in wizard order) that has at least one field error across all
// files; defaults to 'basic' so the user always lands somewhere sensible.
function firstErrorSubStep(errorsByFile) {
	for (const subStepName of SUB_STEP_ORDER) {
		const hasErrorHere = Object.values(errorsByFile).some((fileErrors) =>
			Object.keys(fileErrors || {}).some((field) => (FIELD_SUB_STEP[field] || 'basic') === subStepName)
		);
		if (hasErrorHere) {
			return subStepName;
		}
	}
	return 'basic';
}

export function BulkUploadInner() {
	const config = useBulkUploadConfig();
	const files = useBulkUploadStore((state) => state.files);
	const currentStep = useBulkUploadStore((state) => state.currentStep);
	const subStep = useBulkUploadStore((state) => state.subStep);
	const setStep = useBulkUploadStore((state) => state.setStep);
	const setSubStep = useBulkUploadStore((state) => state.setSubStep);
	const removeFile = useBulkUploadStore((state) => state.removeFile);

	const uploadActions = useBulkUpload();
	const { options } = useTaxonomies(config.optionsEndpoint);
	const submitMutation = useSubmitBulk();

	const [showRedirect, setShowRedirect] = useState(false);
	const [showSubmitDialog, setShowSubmitDialog] = useState(false);
	const [validationErrors, setValidationErrors] = useState({});
	const [submitError, setSubmitError] = useState(null);

	const fileCount = files.length;
	const completedFiles = useMemo(
		() => files.filter((file) => file.friendlyToken && file.uploadStatus === UPLOAD_STATUS.COMPLETE),
		[files]
	);
	const allComplete = fileCount > 0 && files.every((file) => file.uploadStatus === UPLOAD_STATUS.COMPLETE);

	// Bulk -> single redirect (decision D2): when the selection settles on exactly
	// one file, the move to the single-upload page is mandatory. Debounced so a
	// multi-file selection (which arrives one onSubmitted at a time) doesn't flash
	// the dialog as the count passes through 1.
	useEffect(() => {
		if (fileCount !== 1) {
			setShowRedirect(false);
			return undefined;
		}
		const timer = setTimeout(() => setShowRedirect(true), 400);
		return () => clearTimeout(timer);
	}, [fileCount]);

	async function deleteFile(id) {
		const file = files.find((item) => item.id === id);
		if (file?.friendlyToken) {
			try {
				const response = await apiFetch(`/api/v1/media/${file.friendlyToken}`, { method: 'DELETE' });
				if (!response.ok) {
					throw new Error(`Delete failed with status ${response.status}`);
				}
				removeFile(id);
			} catch (error) {
				console.error(`Failed to delete uploaded media ${file.friendlyToken}`, error);
				setSubmitError('Could not delete the uploaded file. Please try again.');
			}
		} else {
			uploadActions.cancel(id);
		}
	}

	// uploadActions is a stable (memoized) bag; deleteFile closes over the current
	// files list, so the action bag is rebuilt whenever files change.
	const actions = useMemo(() => ({ ...uploadActions, deleteFile }), [uploadActions, files]);

	// Clear a field's red error as soon as the user edits it, and drop the
	// top-of-page banner (they are actively fixing things).
	const clearFieldErrors = useCallback((fileId, keys) => {
		setSubmitError(null);
		setValidationErrors((prev) => {
			const current = prev[fileId];
			if (!current) {
				return prev;
			}
			let changed = false;
			const nextForFile = { ...current };
			keys.forEach((key) => {
				if (key in nextForFile) {
					delete nextForFile[key];
					changed = true;
				}
			});
			if (!changed) {
				return prev;
			}
			const next = { ...prev };
			if (Object.keys(nextForFile).length === 0) {
				delete next[fileId];
			} else {
				next[fileId] = nextForFile;
			}
			return next;
		});
	}, []);

	const subStepIndex = SUB_STEP_ORDER.indexOf(subStep);
	const inDetails = currentStep === 2;
	const inPreview = currentStep === 3;
	const primaryAction = inPreview ? 'share' : 'next';

	const primaryLabel =
		currentStep === 1
			? 'Next: Add Details'
			: inDetails && subStepIndex < SUB_STEP_ORDER.length - 1
				? `Next: ${SUB_STEP_LABELS[SUB_STEP_ORDER[subStepIndex + 1]]}`
				: 'Next: Preview & Submit';
	const backLabel =
		currentStep === 3
			? 'Back: Final Settings'
			: !inDetails || subStepIndex <= 0
				? 'Back'
				: `Back: ${SUB_STEP_LABELS[SUB_STEP_ORDER[subStepIndex - 1]]}`;
	const canPrimary = currentStep === 1 ? allComplete : primaryAction === 'share' ? completedFiles.length > 0 : true;

	function handleNext() {
		if (currentStep === 1) {
			setStep(2);
			setSubStep('basic');
			return;
		}
		if (subStepIndex < SUB_STEP_ORDER.length - 1) {
			setSubStep(SUB_STEP_ORDER[subStepIndex + 1]);
			return;
		}
		const errorsByFile = computeValidationErrors();
		setValidationErrors(errorsByFile);
		setStep(3);
	}

	function handleBack() {
		if (currentStep === 3) {
			setStep(2);
			setSubStep('final');
			return;
		}
		if (currentStep === 2 && subStepIndex <= 0) {
			setStep(1);
			return;
		}
		if (currentStep === 2) {
			setSubStep(SUB_STEP_ORDER[subStepIndex - 1]);
		}
	}

	function computeValidationErrors() {
		const errorsByFile = {};
		completedFiles.forEach((file) => {
			const fieldErrors = validateMetadata(file.metadata);
			if (Object.keys(fieldErrors).length > 0) {
				errorsByFile[file.id] = fieldErrors;
			}
		});
		return errorsByFile;
	}

	function doSubmit(action) {
		const sourceFiles = action === 'draft' ? files : completedFiles;
		const items = buildSubmitItems(sourceFiles);
		if (items.length === 0) {
			return;
		}
		setSubmitError(null);
		submitMutation.mutate(
			{ action, items },
			{
				onSuccess: () => {
					window.location.href = config.postSubmitUrl;
				},
				onError: (error) => {
					if (error.fieldErrors) {
						const byFile = {};
						files.forEach((file) => {
							const tokenErrors = file.friendlyToken && error.fieldErrors[file.friendlyToken];
							if (tokenErrors) {
								byFile[file.id] = normalizeFieldErrors(tokenErrors);
							}
						});
						if (Object.keys(byFile).length > 0) {
							setValidationErrors(byFile);
							setStep(2);
							setSubStep(firstErrorSubStep(byFile));
						}
					}
					setSubmitError(error.message || 'Submission failed.');
					setShowSubmitDialog(false);
				},
			}
		);
	}

	function handleShare() {
		if (completedFiles.length === 0) {
			return;
		}
		const errorsByFile = computeValidationErrors();
		if (Object.keys(errorsByFile).length > 0) {
			setValidationErrors(errorsByFile);
			setStep(2);
			setSubStep(firstErrorSubStep(errorsByFile));
			setSubmitError(VALIDATION_BANNER);
			return;
		}
		setValidationErrors({});
		setSubmitError(null);
		if (config.isTrustedUser) {
			doSubmit('submit');
		} else {
			setShowSubmitDialog(true);
		}
	}

	return (
		<BulkUploadActionsProvider value={actions}>
			{/* Container queries (not viewport `lg:`) so the layout responds to the
			    actual content width, which shrinks when the app sidebar is open. */}
			<div className="@container/page mx-auto max-w-[1100px] px-4 py-6 sm:px-6">
				<div className="grid grid-cols-1 gap-8 @4xl/page:grid-cols-[220px_minmax(0,1fr)]">
					{/* Pin the step rail while the form/preview column scrolls, so the
					    left column isn't left blank. self-start keeps the sticky box at
					    its natural height; only applies once it becomes a side rail. */}
					<aside className="@4xl/page:sticky @4xl/page:top-[calc(var(--header-height)+1rem)] @4xl/page:self-start @4xl/page:pt-2">
						<WizardStepper currentStep={currentStep} />
					</aside>
					{/* Step 1 has no Quick Preview, so constrain it to the same left-column
					    width as Step 2 (form column), leaving space on the right per Figma. */}
					<main className="@container/main min-w-0">
						{submitError ? (
							<TextAlert role="alert" className="mb-4 text-text-danger" iconName="infoYellow">
								{submitError}
							</TextAlert>
						) : null}

						{currentStep === 1 ? (
							<div className="@3xl/main:pr-[324px]">
								<Step1UploadMedia files={files} />
							</div>
						) : currentStep === 2 ? (
							<EnterDetails
								files={files}
								options={options}
								validationErrors={validationErrors}
								onClearErrors={clearFieldErrors}
							/>
						) : (
							<PreviewSubmit
								files={completedFiles}
								options={options}
								validationErrors={validationErrors}
							/>
						)}

						<div
							className={
								currentStep === 1
									? 'grid grid-cols-1 items-start gap-6 @3xl/main:grid-cols-[minmax(0,1fr)_300px]'
									: ''
							}
						>
							<WizardFooter
								showBack={currentStep > 1}
								backLabel={backLabel}
								primaryLabel={primaryLabel}
								primaryAction={primaryAction}
								onBack={handleBack}
								onNext={handleNext}
								onShare={handleShare}
								onSaveDraft={() => doSubmit('draft')}
								canPrimary={canPrimary}
								canDraft={completedFiles.length > 0}
								isSubmitting={submitMutation.isPending}
							/>
						</div>
					</main>
				</div>
			</div>

			<RedirectNoticeDialog
				open={showRedirect}
				onContinue={() => {
					window.location.href = config.singleUploadUrl;
				}}
			/>
			<SubmitForReviewDialog
				open={showSubmitDialog}
				onCancel={() => setShowSubmitDialog(false)}
				onConfirm={() => doSubmit('submit')}
				isSubmitting={submitMutation.isPending}
			/>
		</BulkUploadActionsProvider>
	);
}
