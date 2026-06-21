import '../../static/css/tailwind.css';
import '../../static/js/static_pages/styles/AddMediaPage.scss';

import React from 'react';
import { Button } from '../shared/components/Button';
import { ConfirmationDialogContent } from '../shared/components/ConfirmationDialog';
import { Dialog } from '../shared/components/Dialog';
import { TabContent, TabView } from '../shared/components/TabView';
import { Text } from '../shared/components/Text';
import UserContext from '../../static/js/contexts/UserContext';
import { deleteRequest } from '../../static/js/functions';
import { config as mediacmsConfig } from '../../static/js/mediacms/config.js';
import { Page } from '../../static/js/pages/_Page';
import { SingleUploadPage } from './single-upload/SingleUploadPage';
import { AddMediaUploadTemplate } from './components/AddMediaUploadTemplate';
import { CannotUploadMessage } from './components/CannotUploadMessage';
import { LoginForm } from './components/LoginForm';
import {
	getAddMediaConfig,
	getCSRFToken,
	getStatusLabel,
	getUploadStatus,
	getUploadedMediaDetails,
	updateUploadItemStatus,
} from './utils/helpers';
import BulkUploadPage from './bulk-upload/components/BulkUploadPage.jsx';

export class AddMediaPage extends Page {
	static contextType = UserContext;

	constructor(props) {
		super(props, 'add-media');
		this.config = getAddMediaConfig();
		this.uploaderRef = React.createRef();
		this.uploader = null;
		this.pendingReplaceId = null;
		// Maps FineUploader file id -> server friendly_token once the upload
		// completes, so a later delete can remove the real Media object.
		this.completedTokens = {};
		this.state = {
			confirmBulkUploadOpen: false,
			confirmDeleteOpen: false,
			hasSelectedMedia: false,
			pendingDeleteId: null,
			pendingDeleteName: '',
			selectedTab: 'single-film-upload',
			uploadedMedia: null,
		};
	}

	// TODO: Move this to single-upload
	componentDidMount() {
		if (this.context.is.anonymous || !this.config.canAdd) {
			return;
		}

		if (!window.qq || !window.qq.FineUploader || !this.uploaderRef.current) {
			console.warn('FineUploader is not available for the add media page.');
			return;
		}

		this.uploaderRef.current.addEventListener('click', this.handleUploaderClick);

		this.uploader = new window.qq.FineUploader({
			debug: false,
			element: this.uploaderRef.current,
			classes: {
				hide: 'hidden',
			},
			request: {
				endpoint: this.config.uploadEndpoint,
				customHeaders: {
					'X-CSRFToken': getCSRFToken(),
				},
			},
			retry: {
				enableAuto: true,
				maxAutoAttempts: 2,
			},
			messages: {
				tooManyItemsError:
					"You've attempted to upload {netItems} files, which exceeds your limit. Non-trusted users can only upload one video at a time.",
			},
			text: {
				formatProgress: '{percent}% ({total_size})',
				failUpload: 'Upload failed',
				waitingForResponse: 'Processing...',
				paused: 'Paused',
			},
			validation: {
				itemLimit: this.config.uploadMaxFilesNumber,
				sizeLimit: this.config.uploadMaxSize,
				allowedExtensions: this.config.allowedExtensions || [],
				acceptFiles: 'video/*',
			},
			chunking: {
				enabled: true,
				concurrent: {
					enabled: true,
				},
				success: {
					endpoint: this.config.uploadCompleteEndpoint,
				},
			},
			callbacks: {
				onStatusChange: function (id, _oldStatus, newStatus) {
					const status = getUploadStatus(newStatus);
					updateUploadItemStatus(id, status, getStatusLabel(status));
				},
				onSubmitted: () => {
					this.setState({ hasSelectedMedia: true, uploadedMedia: null });
				},
				onError: function (id, name, errorReason) {
					updateUploadItemStatus(id, 'failed', 'Upload failed');
					console.warn(window.qq.format('Error on file number {} - {}.  Reason: {}', id, name, errorReason));
				},
				onComplete: (id, _name, response) => {
					if (!response.success) {
						updateUploadItemStatus(id, 'failed', 'Upload failed');
						return;
					}

					updateUploadItemStatus(id, 'complete', 'Complete');

					const details = getUploadedMediaDetails(response, _name);
					this.completedTokens[id] = details.friendlyToken;

					if (this.config.uploadMaxFilesNumber === 1) {
						this.setState({ uploadedMedia: details });
					}
				},
			},
		});
	}

	componentWillUnmount() {
		if (this.uploaderRef.current) {
			this.uploaderRef.current.removeEventListener('click', this.handleUploaderClick);
		}
	}

	getFileIdFromElement(element) {
		const item = element.closest('[class*="qq-file-id-"]');

		if (!item) {
			return null;
		}

		const match = item.className.match(/qq-file-id-(\d+)/);

		return match ? Number(match[1]) : null;
	}

	openFilePicker() {
		// This page adds files manually (MediaDropzone -> addFiles) and has no
		// FineUploader browse button, so spin up a transient file input instead.
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'video/*';
		input.className = 'hidden';

		const cleanup = () => input.remove();

		input.addEventListener('change', () => {
			const files = Array.from(input.files || []);

			if (files.length) {
				// Check for multi-file selection before deleting the original
				if (files.length > 1) {
					this.pendingReplaceId = null;
					this.setState({ confirmBulkUploadOpen: true });
					cleanup();
					return;
				}

				// Replace = delete the old media first (frees the item-limit slot and
				// removes the old server-side Media), then upload the new one.
				if (this.pendingReplaceId != null) {
					this.removeUploadItem(this.pendingReplaceId);
					this.pendingReplaceId = null;
				}

				this.handleFilesSelected(files);
			} else {
				this.pendingReplaceId = null;
			}

			cleanup();
		});

		// Picker dismissed without choosing: keep the original media untouched.
		input.addEventListener('cancel', () => {
			this.pendingReplaceId = null;
			cleanup();
		});

		document.body.appendChild(input);
		input.click();
	}

	deleteUploadedMedia(id) {
		const friendlyToken = this.completedTokens[id];

		// Only completed uploads exist server-side; in-flight ones are handled by cancel().
		if (!friendlyToken) {
			return;
		}

		delete this.completedTokens[id];

		const mediaApiUrl = mediacmsConfig(window.MediaCMS).api.media;

		if (!mediaApiUrl) {
			console.warn('Media API endpoint unavailable; cannot delete media ' + friendlyToken);
			return;
		}

		deleteRequest(
			mediaApiUrl + '/' + friendlyToken,
			{ headers: { 'X-CSRFToken': getCSRFToken() } },
			false,
			null,
			(error) => console.warn('Unable to delete uploaded media ' + friendlyToken, error)
		);
	}

	removeUploadItem(id) {
		if (id == null) {
			return;
		}

		// FineUploader.cancel() only aborts in-flight uploads; a finished upload has
		// already created a Media row, so delete it on the server too.
		this.deleteUploadedMedia(id);

		try {
			this.uploader.cancel(id);
		} catch (error) {
			console.warn('Unable to cancel upload ' + id, error);
		}

		const itemEl = document.querySelector('.qq-file-id-' + id);

		if (itemEl) {
			itemEl.remove();
		}

		// When the list empties, reset FineUploader so the dropzone, browse button,
		// and item-limit counters return to their initial state.
		const listEl = this.uploaderRef.current && this.uploaderRef.current.querySelector('.qq-upload-list-selector');
		const hasRemainingItems = !!listEl?.children.length;

		if (listEl && !hasRemainingItems) {
			try {
				this.uploader.reset();
			} catch (error) {
				console.warn('Unable to reset uploader', error);
			}
		}

		this.setState({ hasSelectedMedia: hasRemainingItems, uploadedMedia: null });
	}

	handleUploaderClick = (event) => {
		const reuploadButton = event.target.closest('.reupload-media-upload-item');

		if (reuploadButton) {
			event.preventDefault();
			// Defer removing the existing item until the user actually picks a new
			// file (onSubmitted). Canceling the picker keeps the original in place.
			this.pendingReplaceId = this.getFileIdFromElement(reuploadButton);
			this.openFilePicker();
			return;
		}

		const deleteButton = event.target.closest('.qq-upload-delete-selector');

		if (deleteButton) {
			event.preventDefault();
			event.stopPropagation();

			const id = this.getFileIdFromElement(deleteButton);

			if (id == null) {
				return;
			}

			const nameEl = document.querySelector('.qq-file-id-' + id + ' .qq-upload-file-selector');

			this.setState({
				confirmDeleteOpen: true,
				pendingDeleteId: id,
				pendingDeleteName: nameEl ? nameEl.textContent.trim() : '',
			});
		}
	};

	closeDeleteDialog = () => {
		this.setState({ confirmDeleteOpen: false, pendingDeleteId: null, pendingDeleteName: '' });
	};

	confirmDelete = () => {
		const id = this.state.pendingDeleteId;
		this.closeDeleteDialog();
		this.removeUploadItem(id);
	};

	closeBulkUploadDialog = () => {
		this.pendingReplaceId = null;
		this.setState({ confirmBulkUploadOpen: false });
	};

	proceedToBulkUpload = () => {
		this.pendingReplaceId = null;
		this.setState({ confirmBulkUploadOpen: false, selectedTab: 'bulk-upload' });
	};

	handleFilesSelected = (files) => {
		if (!files?.length) {
			return;
		}

		if (files.length > 1) {
			this.setState({ confirmBulkUploadOpen: true });
			return;
		}

		if (!this.uploader || typeof this.uploader.addFiles !== 'function') {
			console.warn('FineUploader is not ready to receive selected media files.');
			return;
		}

		this.setState({ hasSelectedMedia: true, uploadedMedia: null }, () => {
			this.uploader.addFiles(files);
		});
	};

	pageContent() {
		if (this.context.is.anonymous) {
			return <LoginForm config={this.config} />;
		}

		if (!this.config.canAdd) {
			return <CannotUploadMessage config={this.config} />;
		}

		const {
			confirmBulkUploadOpen,
			confirmDeleteOpen,
			hasSelectedMedia,
			pendingDeleteName,
			selectedTab,
			uploadedMedia,
		} = this.state;

		return (
			<div className="media-uploader-wrap add-media-page-wrap">
				<main className="add-media-feature mx-4 grid w-auto grid-cols-1 gap-8 py-8 text-text-primary sm:mx-6 lg:mx-10 lg:grid-cols-6 lg:items-start">
					<aside className="hidden min-w-0 lg:block bg-white" aria-hidden="true">
						{/* TODO: Left View (stepper) */}
						<p>Test</p>
					</aside>

					<section className="min-w-0 col-span-4">
						<header className="mb-8">
							<Text variant="h4" as="h1" className="m-0 text-text-strong">
								Upload Media to Cinemata
							</Text>
							<Text variant="body-16" color="description" className="m-0 mt-4 max-w-[720px]">
								Please check our&nbsp;
								<a
									href="/editorial-policy"
									className="text-text-accent no-underline underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
								>
									Editorial Policy
								</a>
								&nbsp;before uploading media.
								<br />
								Any media that does not comply with the policy will be deleted from Cinemata.org.
							</Text>
						</header>

						<AddMediaUploadTemplate />

						<TabView
							tabMode="wrap"
							triggerClassName="rounded-none py-3 px-size-22 text-neutral-50 aria-selected:text-text-primary"
							triggerSelectedColor="bg-bg-section-header"
							panelClassName="mt-8"
							aria-label="Upload media type"
							defaultSelectedTab="single-film-upload"
							selectedTab={selectedTab}
							onSelectedTabChange={(nextTab) => this.setState({ selectedTab: nextTab })}
							className="add-media-tabs"
							keepMounted
						>
							<TabContent
								title="Single Film Upload"
								value="single-film-upload"
								content={
									<SingleUploadPage
										accept="video/*"
										canPublishDirectly={!!this.config.canPublishDirectly}
										canUseAdminSettings={!!this.context.is.admin}
										csrfToken={this.config.csrfToken}
										hasUploadedMedia={!!uploadedMedia}
										maxFiles={2}
										mediaLanguages={this.config.mediaLanguages || []}
										mediaCountries={this.config.mediaCountries || []}
										categories={this.config.categories || []}
										topics={this.config.topics || []}
										contentSensitivities={this.config.contentSensitivities || []}
										licenses={this.config.licenses || []}
										onFilesSelected={this.handleFilesSelected}
										showUploader={hasSelectedMedia || !!uploadedMedia}
										uploadedMedia={uploadedMedia}
										uploader={
											<div
												className="media-uploader add-media-uploader-mount"
												ref={this.uploaderRef}
											></div>
										}
									/>
								}
							/>
							<TabContent title="Bulk Upload" value="bulk-upload" content={<BulkUploadPage />} />
						</TabView>
					</section>

					<aside className="hidden min-w-0 lg:block bg-white" aria-hidden="true">
						{/* TODO: Right View (preview) */}
						<p>Test</p>
					</aside>
				</main>

				<Dialog open={confirmDeleteOpen} onOpenChange={(open) => !open && this.closeDeleteDialog()}>
					<ConfirmationDialogContent
						title="Delete this media?"
						subtitle={
							pendingDeleteName
								? `“${pendingDeleteName}” will be removed from the upload list.`
								: 'This file will be removed from the upload list.'
						}
						aria-label="Delete media confirmation"
						actions={
							<>
								<Button variant="secondary-outline" onClick={this.closeDeleteDialog}>
									Cancel
								</Button>
								<Button variant="primary" onClick={this.confirmDelete}>
									Delete
								</Button>
							</>
						}
					/>
				</Dialog>

				<Dialog open={confirmBulkUploadOpen} onOpenChange={(open) => !open && this.closeBulkUploadDialog()}>
					<ConfirmationDialogContent
						title="Upload multiple media?"
						subtitle="Single film upload only accepts one media file. This selection will be canceled. Continue to bulk upload instead?"
						aria-label="Multiple media upload confirmation"
						actions={
							<>
								<Button variant="secondary-outline" onClick={this.closeBulkUploadDialog}>
									Cancel
								</Button>
								<Button variant="primary" onClick={this.proceedToBulkUpload}>
									Proceed
								</Button>
							</>
						}
					/>
				</Dialog>
			</div>
		);
	}
}
