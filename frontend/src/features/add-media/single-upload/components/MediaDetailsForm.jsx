import { useEffect, useRef } from 'react';
import { maxWords, required, runValidators } from '../../../shared/utils/validators';
import { useSubmitSingle } from '../hooks/useSubmitSingle';
import useSingleUploadStore from '../useSingleUploadStore';
import { AdminSettingsForm } from './AdminSettingsForm';
import { BasicDetailsForm } from './BasicDetailsForm';
import { FinalSettingsForm } from './FinalSettingsForm';
import { OtherDetailsForm } from './OtherDetailsForm';
import { SubmitSection } from './SubmitSection';
import { ThumbnailImageUpload } from './ThumbnailImageUpload';

const CURRENT_YEAR = new Date().getFullYear();

export function MediaDetailsForm({
	canPublishDirectly = false,
	canUseAdminSettings = false,
	categories = [],
	contentSensitivities = [],
	csrfToken = '',
	editUrl = '',
	licenses = [],
	mediaCountries = [],
	mediaLanguages = [],
	topics = [],
	onPreviewChange,
	onSubmitSuccess,
	uploadedMedia = null,
}) {
	const formRef = useRef(null);
	const submitMutation = useSubmitSingle();
	const singleUpload = useSingleUploadStore();

	useEffect(() => singleUpload.reset, [singleUpload.reset]);

	const selectedThumbnailFile = singleUpload.selectedThumbnailFile;
	useEffect(() => {
		if (
			!selectedThumbnailFile ||
			!onPreviewChange ||
			typeof URL === 'undefined' ||
			typeof URL.createObjectURL !== 'function'
		) {
			return undefined;
		}
		const url = URL.createObjectURL(selectedThumbnailFile);
		onPreviewChange({ thumbnailUrl: url, thumbnailFrame: null });
		return () => URL.revokeObjectURL(url);
	}, [selectedThumbnailFile, onPreviewChange]);

	useEffect(() => {
		if (!onPreviewChange) {
			return;
		}
		onPreviewChange({
			title: singleUpload.title,
			company: singleUpload.company,
			media_country: singleUpload.mediaCountry,
			category: singleUpload.category[0] ?? '',
		});
	}, [onPreviewChange, singleUpload.title, singleUpload.company, singleUpload.mediaCountry, singleUpload.category]);

	function onFileChanged(files) {
		const [file] = files;
		singleUpload.setSelectedThumbnailFile(file ?? null);
	}

	function onFrameSelect(seconds, frame) {
		singleUpload.setThumbnailTime(seconds);
		onPreviewChange?.({ thumbnailUrl: '', thumbnailFrame: frame });
	}

	function validateForm() {
		const nextErrors = {};

		const titleError = runValidators([required()], singleUpload.title);
		if (titleError) {
			nextErrors.title = titleError;
		}

		const summaryError = runValidators([required(), maxWords(80)], singleUpload.summary);
		if (summaryError) {
			nextErrors.summary = summaryError;
		}

		const year = String(singleUpload.yearProduced).trim();
		if (!year) {
			nextErrors.year_produced = 'This field is required';
		} else if (!/^\d+$/.test(year) || Number(year) < 1 || Number(year) > CURRENT_YEAR) {
			nextErrors.year_produced = `Enter a year up to ${CURRENT_YEAR}`;
		}

		if (singleUpload.website && !singleUpload.website.startsWith('https://')) {
			nextErrors.website = 'Website should start with https://';
		}

		if (!singleUpload.mediaLanguage) {
			nextErrors.media_language = 'Select a media language';
		}

		if (!singleUpload.mediaCountry) {
			nextErrors.media_country = 'Select a media country';
		}

		if (singleUpload.category.length === 0) {
			nextErrors.category = 'Select at least one category';
		}

		if (singleUpload.topics.length === 0) {
			nextErrors.topics = 'Select at least one topic';
		}

		if (singleUpload.mediaStatus === 'restricted' && !singleUpload.password) {
			nextErrors.password = 'Password has to be set when state is Restricted.';
		}

		return nextErrors;
	}

	function normalizeServerErrors(fieldErrors) {
		const nextErrors = {};
		const messages = [];

		for (const [field, value] of Object.entries(fieldErrors || {})) {
			const text = Array.isArray(value) ? value.join(' ') : String(value);
			nextErrors[field] = text;
			messages.push(field === '__all__' ? text : `${field}: ${text}`);
		}

		return {
			fieldErrors: nextErrors,
			message: messages.join(' • ') || 'Please review your inputs and try again.',
		};
	}

	function submitMedia(action = 'submit') {
		singleUpload.setShareStage(null);

		const form = formRef.current;

		if (!form || submitMutation.isPending) {
			return;
		}

		singleUpload.setSubmitError('');
		submitMutation.mutate(
			{
				action,
				form,
				thumbnailFile: singleUpload.selectedThumbnailFile,
				thumbnailTime: singleUpload.thumbnailTime,
			},
			{
				onSuccess: (data) => {
					onSubmitSuccess?.(uploadedMedia?.friendlyToken);
					window.location.assign(data.url);
				},
				onError: (error) => {
					if (error.fieldErrors) {
						const normalized = normalizeServerErrors(error.fieldErrors);
						singleUpload.setErrors(normalized.fieldErrors);
						singleUpload.setSubmitError(normalized.message);
						return;
					}

					console.warn(action === 'draft' ? 'Failed to save media draft' : 'Failed to share media', error);
					singleUpload.setSubmitError(
						action === 'draft'
							? 'Something went wrong while saving your draft. Please try again.'
							: 'Something went wrong while sharing your media. Please try again.'
					);
				},
			}
		);
	}

	function handleSaveDraftClick() {
		submitMedia('draft');
	}

	function postOrReview() {
		if (canPublishDirectly) {
			submitMedia();
		} else {
			singleUpload.setShareStage('review');
		}
	}

	function handleShareClick() {
		singleUpload.setSubmitError('');
		const nextErrors = validateForm();
		singleUpload.setErrors(nextErrors);

		if (Object.keys(nextErrors).length > 0) {
			const firstInvalid = formRef.current?.querySelector('[aria-invalid="true"]');
			firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			return;
		}

		if (singleUpload.allowDownload) {
			singleUpload.setShareStage('download');
		} else {
			postOrReview();
		}
	}

	return (
		<form
			ref={formRef}
			action={editUrl || undefined}
			method="post"
			encType="multipart/form-data"
			className="mt-10 flex flex-col gap-8"
			data-single-upload-form
		>
			<input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
			{canPublishDirectly ? <input type="hidden" name="is_reviewed" value="on" /> : null}
			{canUseAdminSettings ? null : <input type="hidden" name="reported_times" value="0" />}

			<BasicDetailsForm singleUpload={singleUpload} />

			<ThumbnailImageUpload
				currentThumbnailTime={uploadedMedia?.thumbnailTime ?? ''}
				duration={uploadedMedia?.duration ?? ''}
				friendlyToken={uploadedMedia?.friendlyToken ?? ''}
				lastSelectedThumbnailFile={singleUpload.lastSelectedThumbnailFile}
				onFileChanged={onFileChanged}
				onFrameSelect={onFrameSelect}
				posterUrl={uploadedMedia?.posterUrl ?? ''}
				selectedThumbnailFile={singleUpload.selectedThumbnailFile}
				spriteSecs={uploadedMedia?.spriteNumSecs ?? ''}
				spritesUrl={uploadedMedia?.spritesUrl ?? ''}
			/>

			<OtherDetailsForm
				categories={categories}
				contentSensitivities={contentSensitivities}
				licenses={licenses}
				mediaCountries={mediaCountries}
				mediaLanguages={mediaLanguages}
				singleUpload={singleUpload}
				topics={topics}
			/>

			<FinalSettingsForm canUseRestrictedStatus={canPublishDirectly} singleUpload={singleUpload} />

			{canUseAdminSettings ? <AdminSettingsForm singleUpload={singleUpload} /> : null}

			<SubmitSection
				onSaveDraft={handleSaveDraftClick}
				onReviewConfirm={() => submitMedia()}
				onShareClick={handleShareClick}
				onSubmitAfterDownloadConfirm={postOrReview}
				singleUpload={singleUpload}
				submitMutation={submitMutation}
			/>
		</form>
	);
}
