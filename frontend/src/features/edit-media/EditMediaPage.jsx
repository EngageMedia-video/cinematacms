import '../../static/css/tailwind.css';
import '../../static/js/static_pages/styles/AddMediaPage.scss';

import { useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BasicDetailsForm } from '../add-media/single-upload/components/BasicDetailsForm';
import { OtherDetailsForm } from '../add-media/single-upload/components/OtherDetailsForm';
import { ThumbnailImageUpload } from '../add-media/single-upload/components/ThumbnailImageUpload';
import { TextAlert } from '../shared/components/TextAlert';
import { getCSRFToken } from '../add-media/utils/helpers';
import { maxWords, required, runValidators } from '../shared/utils/validators';
import editMediaQueryClient from './queryClient';
import {
	AdvancedSettingsSection,
	AdminSettingsSection,
	EditMediaHeader,
	EditMediaQuickPreview,
	EditorialPolicyNotice,
	FinalSettingsSection,
	MediaUploadSection,
	SubmitActions,
} from './components';
import { useEditMediaConfig } from './hooks/useEditMediaConfig';
import { useEditMediaState } from './hooks/useEditMediaState';
import { useReplacementUploadState } from './hooks/useReplacementUploadState';
import { useSubmitEditMedia } from './hooks/useSubmitEditMedia';

const CURRENT_YEAR = new Date().getFullYear();

const ERROR_FIELD_ORDER = [
	'title',
	'summary',
	'year_produced',
	'website',
	'media_language',
	'media_country',
	'category',
	'topics',
	'password',
];

const ERROR_FIELD_SELECTORS = {
	title: '#title',
	summary: '#summary',
	year_produced: '#year_produced',
	website: '#website',
	media_language: '#media_language',
	media_country: '#media_country',
	category: '#category',
	topics: '#topics',
	password: '#password',
};

function normalizeErrors(fieldErrors) {
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

function EditMediaPageContent() {
	const { data: config } = useEditMediaConfig();
	const formRef = useRef(null);
	const editState = useEditMediaState(config);
	const submitMutation = useSubmitEditMedia();
	const { uploadBusy } = useReplacementUploadState();
	const { categories, contentSensitivities, licenses, mediaCountries, mediaLanguages, topics } = config.options;

	function validateForm() {
		const errors = {};
		const year = String(editState.yearProduced || '').trim();
		const titleError = runValidators([required()], editState.title);
		const summaryError = runValidators([required(), maxWords(80)], editState.summary);

		if (titleError) {
			errors.title = titleError;
		}

		if (summaryError) {
			errors.summary = summaryError;
		}

		if (!year) {
			errors.year_produced = 'This field is required';
		} else if (!/^\d+$/.test(year) || Number(year) < 1 || Number(year) > CURRENT_YEAR) {
			errors.year_produced = `Enter a year up to ${CURRENT_YEAR}`;
		}
		if (editState.website && !editState.website.startsWith('https://')) {
			errors.website = 'Website should start with https://';
		}
		if (!editState.mediaLanguage) errors.media_language = 'Select a media language';
		if (!editState.mediaCountry) errors.media_country = 'Select a media country';
		if (!editState.category.length) errors.category = 'Select at least one category';
		if (!editState.topics.length) errors.topics = 'Select at least one topic';
		if (editState.mediaStatus === 'restricted' && !editState.password && !config.media?.hasPassword) {
			errors.password = 'Password has to be set when state is Restricted.';
		}

		return errors;
	}

	function scrollToFirstError(errors) {
		const firstField = ERROR_FIELD_ORDER.find((field) => field in errors);
		const selector = ERROR_FIELD_SELECTORS[firstField] || '[aria-invalid="true"]';
		const target =
			formRef.current?.querySelector(selector) || formRef.current?.querySelector('[aria-invalid="true"]');

		target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		if (typeof target?.focus === 'function') {
			target.focus({ preventScroll: true });
		}
	}

	function submitForm(event) {
		event.preventDefault();

		if (uploadBusy) {
			editState.setSubmitError('Please wait for the media file upload to complete before saving.');
			return;
		}

		const errors = validateForm();
		editState.setErrors(errors);
		if (Object.keys(errors).length) {
			editState.setSubmitError('Please review your inputs and try again.');
			scrollToFirstError(errors);
			return;
		}

		editState.setSubmitError('');
		submitMutation.mutate(
			{
				form: formRef.current,
				thumbnailFile: editState.selectedThumbnailFile,
				thumbnailTime: editState.thumbnailTime,
				visibilityExpiration: {
					expireEnabled: editState.expireEnabled,
					startDate: editState.startDate,
					endDate: editState.endDate,
				},
			},
			{
				onSuccess: (data) => {
					window.location.assign(data.url);
				},
				onError: (error) => {
					if (error.fieldErrors) {
						const normalized = normalizeErrors(error.fieldErrors);
						editState.setErrors(normalized.fieldErrors);
						editState.setSubmitError(normalized.message);
					} else {
						editState.setSubmitError('Something went wrong while updating this media. Please try again.');
					}
				},
			}
		);
	}

	return (
		<div className="add-media-feature @container/page mx-4 py-8 text-text-primary sm:mx-6 lg:mx-10">
			<div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-8 @4xl/page:grid-cols-[minmax(0,1fr)_340px] @4xl/page:items-start">
				<div className="min-w-0 @4xl/page:col-start-1">
					<div className="flex flex-col gap-8">
						<EditMediaHeader />
						<EditorialPolicyNotice />

						<form
							ref={formRef}
							action={config.editUrl || window.location.href}
							method="post"
							encType="multipart/form-data"
							className="flex flex-col gap-8"
							noValidate
							onSubmit={submitForm}
						>
							<input
								type="hidden"
								name="csrfmiddlewaretoken"
								value={config.csrfToken || getCSRFToken() || ''}
							/>

							<BasicDetailsForm singleUpload={editState} />

							{config.permissions?.canReplaceMedia ? (
								<MediaUploadSection config={config} disabled={uploadBusy} />
							) : null}

							<ThumbnailImageUpload
								currentThumbnailTime={config.media?.thumbnailTime ?? ''}
								duration={config.media?.duration ?? ''}
								friendlyToken={config.media?.friendlyToken ?? ''}
								onFileChanged={(files) => editState.setSelectedThumbnailFile(files[0] ?? null)}
								onFrameSelect={(seconds, frame) => editState.setThumbnailTime(seconds, frame)}
								posterUrl={config.media?.posterUrl ?? ''}
								selectedThumbnailFile={editState.selectedThumbnailFile}
								showHeaderPreview={false}
								spriteSecs={config.media?.spriteNumSecs ?? ''}
								spritesUrl={config.media?.spritesUrl ?? ''}
							/>

							<OtherDetailsForm
								categories={categories}
								contentSensitivities={contentSensitivities}
								licenses={licenses}
								mediaCountries={mediaCountries}
								mediaLanguages={mediaLanguages}
								singleUpload={editState}
								topics={topics}
							/>

							<FinalSettingsSection config={config} editState={editState} />
							<AdvancedSettingsSection config={config} editState={editState} />
							<AdminSettingsSection config={config} editState={editState} />

							{editState.submitError ? (
								<TextAlert iconName="infoCircle" className="text-text-danger">
									{editState.submitError}
								</TextAlert>
							) : null}

							<SubmitActions isSubmitting={submitMutation.isPending} uploadBusy={uploadBusy} />
						</form>
					</div>
				</div>

				<aside className="hidden min-w-0 @4xl/page:sticky @4xl/page:top-[calc(var(--header-height)+1rem)] @4xl/page:col-start-2 @4xl/page:row-start-1 @4xl/page:block @4xl/page:self-start">
					<EditMediaQuickPreview config={config} editState={editState} className="min-w-0" />
				</aside>
			</div>
		</div>
	);
}

export function EditMediaPage() {
	return (
		<QueryClientProvider client={editMediaQueryClient}>
			<EditMediaPageContent />
		</QueryClientProvider>
	);
}
