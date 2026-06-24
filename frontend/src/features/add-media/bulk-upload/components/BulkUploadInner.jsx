import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTaxonomies, validateMetadata } from '../../../shared/components/upload-media';
import { apiFetch } from '../../../shared/utils/api';
import useBulkUploadStore, { UPLOAD_STATUS } from '../useBulkUploadStore';
import { useBulkUploadConfig } from '../bulkUploadConfig';
import { useBulkUpload } from '../hooks/useBulkUpload';
import { useSubmitBulk } from '../hooks/useSubmitBulk';
import { BulkUploadActionsProvider } from '../BulkUploadActionsContext';
import { WizardFooter } from './WizardFooter';
import { Step1UploadMedia } from './step1/Step1UploadMedia';
import { EnterDetails } from './step2/EnterDetails';
import { PreviewSubmit } from './step3/PreviewSubmit';
import { RedirectNoticeDialog } from './RedirectNoticeDialog';
import { SubmitForReviewDialog } from './SubmitForReviewDialog';
import { Button, ConfirmationDialogContent, Dialog, TextAlert } from '../../../shared/components';

const SUB_STEP_ORDER = ['basic', 'thumbnail', 'other', 'final'];
// Admin Settings is an extra sub-step appended only for users with admin rights
// (mirrors single-upload, which renders it as its own admin-only section).
const ADMIN_SUB_STEP = 'admin';
const SUB_STEP_LABELS = {
	basic: 'Basic Details',
	thumbnail: 'Thumbnail Image Upload',
	other: 'Other Details',
	final: 'Final Settings',
	admin: 'Admin Settings',
};

// Which sub-step each metadata field lives on, so a validation error can send
// the user straight to the tab that needs attention.
const FIELD_SUB_STEP = {
	title: 'basic',
	summary: 'basic',
	description: 'basic',
	year_produced: 'basic',
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
	is_encrypted: 'final',
	featured: 'admin',
	reported_times: 'admin',
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
	const [showDownloadNotice, setShowDownloadNotice] = useState(false);
	const [pendingDeleteId, setPendingDeleteId] = useState(null);
	const [validationErrors, setValidationErrors] = useState({});
	const [submitError, setSubmitError] = useState(null);

	const fileCount = files.length;
	const completedFiles = useMemo(
		() => files.filter((file) => file.friendlyToken && file.uploadStatus === UPLOAD_STATUS.COMPLETE),
		[files]
	);
	const allComplete = fileCount > 0 && files.every((file) => file.uploadStatus === UPLOAD_STATUS.COMPLETE);

	// Live set of sub-steps that still have required fields to fill (across all
	// completed files), so the sub-step nav can show/clear a marker as the user
	// edits — independent of whether a submit has been attempted yet.
	const incompleteSubSteps = useMemo(() => {
		const set = new Set();
		completedFiles.forEach((file) => {
			Object.keys(validateMetadata(file.metadata)).forEach((field) => set.add(FIELD_SUB_STEP[field] || 'basic'));
		});
		return set;
	}, [completedFiles]);

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

	async function performDeleteFile(id) {
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

	// Delete is confirmed first (steps 1 & 2) to avoid an accidental click wiping an
	// uploaded file; the actual removal runs from the confirmation dialog.
	function requestDeleteFile(id) {
		setPendingDeleteId(id);
	}

	const pendingDeleteFile = pendingDeleteId == null ? null : files.find((item) => item.id === pendingDeleteId);

	// uploadActions is a stable (memoized) bag; requestDeleteFile closes over the
	// current files list, so the action bag is rebuilt whenever files change.
	const actions = useMemo(() => ({ ...uploadActions, deleteFile: requestDeleteFile }), [uploadActions, files]);

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

	// Admins get an extra "Admin Settings" tab after Final; everyone else stops at
	// Final. Drives sub-step navigation, the NEXT/BACK labels and the last tab.
	const subStepOrder = useMemo(
		() => (config.canUseAdminSettings ? [...SUB_STEP_ORDER, ADMIN_SUB_STEP] : SUB_STEP_ORDER),
		[config.canUseAdminSettings]
	);
	const lastSubStep = subStepOrder[subStepOrder.length - 1];
	const subStepIndex = subStepOrder.indexOf(subStep);
	const inDetails = currentStep === 2;
	const inPreview = currentStep === 3;
	const primaryAction = inPreview ? 'share' : 'next';

	const primaryLabel =
		currentStep === 1
			? 'Next: Add Details'
			: inDetails && subStepIndex < subStepOrder.length - 1
				? `Next: ${SUB_STEP_LABELS[subStepOrder[subStepIndex + 1]]}`
				: 'Next: Preview & Submit';
	const backLabel =
		currentStep === 3
			? `Back: ${SUB_STEP_LABELS[lastSubStep]}`
			: !inDetails || subStepIndex <= 0
				? 'Back'
				: `Back: ${SUB_STEP_LABELS[subStepOrder[subStepIndex - 1]]}`;
	const canPrimary = currentStep === 1 ? allComplete : primaryAction === 'share' ? completedFiles.length > 0 : true;

	function handleNext() {
		// Each step/sub-step is a fresh view, so start it scrolled to the top
		// (the Next button lives at the bottom of the previous one).
		window.scrollTo({ top: 0 });
		if (currentStep === 1) {
			setStep(2);
			setSubStep('basic');
			return;
		}
		if (subStepIndex < subStepOrder.length - 1) {
			setSubStep(subStepOrder[subStepIndex + 1]);
			return;
		}
		const errorsByFile = computeValidationErrors();
		setValidationErrors(errorsByFile);
		setStep(3);
	}

	function handleBack() {
		window.scrollTo({ top: 0 });
		if (currentStep === 3) {
			setStep(2);
			setSubStep(lastSubStep);
			return;
		}
		if (currentStep === 2 && subStepIndex <= 0) {
			setStep(1);
			return;
		}
		if (currentStep === 2) {
			setSubStep(subStepOrder[subStepIndex - 1]);
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
		const sourceFiles = (action === 'draft' ? files : completedFiles).filter((file) => file.friendlyToken);
		if (sourceFiles.length === 0) {
			return;
		}
		setSubmitError(null);
		submitMutation.mutate(
			{ action, files: sourceFiles },
			{
				onSuccess: ({ failed }) => {
					if (failed.length === 0) {
						window.location.href = config.postSubmitUrl;
						return;
					}
					// Per-file submit (decision D4): some items may fail while others
					// go through. Map each failure's field errors back onto its card.
					const byFile = {};
					failed.forEach((result) => {
						if (result.fieldErrors) {
							byFile[result.id] = normalizeFieldErrors(result.fieldErrors);
						}
					});
					if (Object.keys(byFile).length > 0) {
						setValidationErrors(byFile);
						setStep(2);
						setSubStep(firstErrorSubStep(byFile));
					}
					const firstMessage = failed.find((result) => result.message)?.message;
					setSubmitError(firstMessage || 'Some files could not be submitted.');
					setShowSubmitDialog(false);
				},
				onError: () => {
					setSubmitError('Submission failed. Please try again.');
					setShowSubmitDialog(false);
				},
			}
		);
	}

	// Trusted users publish directly; everyone else confirms the review path.
	function proceedShare() {
		if (config.isTrustedUser) {
			doSubmit('submit');
		} else {
			setShowSubmitDialog(true);
		}
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
		// Mirror single-upload: warn once if any media is downloadable before sharing.
		if (completedFiles.some((file) => file.metadata?.allow_download)) {
			setShowDownloadNotice(true);
			return;
		}
		proceedShare();
	}

	// The step body (form/preview/footer). The host add-media page provides the
	// @container/page shell, the stepper rail and the <main> landmark, so this is a
	// plain <div> to avoid nesting a second <main>.
	const stepBody = (
		<div className="@container/main min-w-0">
			{submitError ? (
				<TextAlert role="alert" className="mb-4 text-text-danger" iconName="infoYellow">
					{submitError}
				</TextAlert>
			) : null}

			{currentStep === 1 ? (
				<div className="@3xl/main:pr-[372px]">
					<Step1UploadMedia files={files} />
				</div>
			) : currentStep === 2 ? (
				<EnterDetails
					files={files}
					options={options}
					validationErrors={validationErrors}
					incompleteSubSteps={incompleteSubSteps}
					onClearErrors={clearFieldErrors}
				/>
			) : (
				<PreviewSubmit files={completedFiles} options={options} validationErrors={validationErrors} />
			)}

			<div
				className={
					currentStep === 1
						? 'grid grid-cols-1 items-start gap-8 @3xl/main:grid-cols-[minmax(0,1fr)_340px]'
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
		</div>
	);

	return (
		<BulkUploadActionsProvider value={actions}>
			{stepBody}

			<RedirectNoticeDialog
				open={showRedirect}
				onContinue={() => {
					// Move the remaining uploaded file into the single tab (no re-upload).
					const file = files.find((item) => item.friendlyToken) || files[0];
					if (config.onMoveSingle && file?.friendlyToken) {
						config.onMoveSingle(file);
					} else {
						window.location.href = config.singleUploadUrl;
					}
				}}
			/>
			<SubmitForReviewDialog
				open={showSubmitDialog}
				onCancel={() => setShowSubmitDialog(false)}
				onConfirm={() => doSubmit('submit')}
				isSubmitting={submitMutation.isPending}
			/>
			<Dialog open={showDownloadNotice} onOpenChange={(open) => !open && setShowDownloadNotice(false)}>
				<ConfirmationDialogContent
					title="Heads-up! This media can be downloaded."
					subtitle="Just to confirm that you consciously checked the Allow Download button."
					aria-label="Allow download confirmation"
					actions={
						<>
							<Button variant="secondary-outline" onClick={() => setShowDownloadNotice(false)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={() => {
									setShowDownloadNotice(false);
									proceedShare();
								}}
							>
								Yes, Proceed
							</Button>
						</>
					}
				/>
			</Dialog>
			<Dialog open={pendingDeleteId != null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
				<ConfirmationDialogContent
					title="Delete this file?"
					subtitle={
						pendingDeleteFile?.name
							? `“${pendingDeleteFile.name}” will be removed from this upload.`
							: 'This file will be removed from this upload.'
					}
					aria-label="Delete file confirmation"
					actions={
						<>
							<Button variant="secondary-outline" onClick={() => setPendingDeleteId(null)}>
								Cancel
							</Button>
							<Button
								variant="primary"
								onClick={() => {
									const id = pendingDeleteId;
									setPendingDeleteId(null);
									performDeleteFile(id);
								}}
							>
								Delete
							</Button>
						</>
					}
				/>
			</Dialog>
		</BulkUploadActionsProvider>
	);
}
