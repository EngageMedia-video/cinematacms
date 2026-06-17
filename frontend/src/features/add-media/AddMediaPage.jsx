import '../../static/css/tailwind.css';
import '../../static/js/static_pages/styles/AddMediaPage.scss';

import React from 'react';
import { Button } from '../shared/components/Button';
import { ConfirmationDialogContent } from '../shared/components/ConfirmationDialog';
import { Dialog } from '../shared/components/Dialog';
import { TabContent, TabView } from '../shared/components/TabView';
import { Text } from '../shared/components/Text';
import UserContext from '../../static/js/contexts/UserContext';
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

export class AddMediaPage extends Page {
	static contextType = UserContext;

	constructor(props) {
		super(props, 'add-media');
		this.config = getAddMediaConfig();
		this.uploaderRef = React.createRef();
		this.uploader = null;
		this.pendingReplaceId = null;
		this.state = {
			confirmDeleteOpen: false,
			hasSelectedMedia: false,
			pendingDeleteId: null,
			pendingDeleteName: '',
			uploadedMedia: null,
		};
	}

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
				onSubmitted: (id) => {
					this.setState({ hasSelectedMedia: true, uploadedMedia: null });
					// A reupload only replaces the original once the new file is in.
					if (this.pendingReplaceId != null && this.pendingReplaceId !== id) {
						this.removeUploadItem(this.pendingReplaceId);
						this.pendingReplaceId = null;
					}
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

					if (this.config.uploadMaxFilesNumber === 1) {
						this.setState({ uploadedMedia: getUploadedMediaDetails(response, _name) });
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
		const root = this.uploaderRef.current;

		if (!root) {
			return;
		}

		const fileInput = root.querySelector('.qq-upload-button-selector input[type="file"]');

		if (fileInput) {
			fileInput.click();
			return;
		}

		const browseButton = root.querySelector('.qq-upload-button-selector');

		if (browseButton) {
			browseButton.click();
		}
	}

	removeUploadItem(id) {
		if (id == null) {
			return;
		}

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

	handleFilesSelected = (files) => {
		if (!files?.length) {
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

		const { confirmDeleteOpen, hasSelectedMedia, pendingDeleteName, uploadedMedia } = this.state;

		return (
			<div className="media-uploader-wrap add-media-page-wrap">
				<main className="add-media-feature mx-auto w-full max-w-6xl px-4 py-8 text-text-primary sm:px-6 lg:px-8">
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
						triggerClassName="rounded-none py-3 px-size-22 text-neutral-50 aria-selected:text-text-primary aria-selected:text-neutral-50"
						triggerSelectedColor="bg-bg-section-header"
						panelClassName="mt-8"
						aria-label="Upload media type"
						defaultSelectedTab="single-film-upload"
						className="add-media-tabs"
						keepMounted
					>
						<TabContent
							title="Single Film Upload"
							value="single-film-upload"
							content={
								<SingleUploadPage
									accept="video/*"
									hasUploadedMedia={!!uploadedMedia}
									maxFiles={2}
									mediaLanguages={this.config.mediaLanguages || []}
									mediaCountries={this.config.mediaCountries || []}
									categories={this.config.categories || []}
									topics={this.config.topics || []}
									contentSensitivities={this.config.contentSensitivities || []}
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
						<TabContent
							title="Bulk Upload"
							value="bulk-upload"
							content={<p>Placeholder for bulk media upload</p>}
						/>
					</TabView>
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
			</div>
		);
	}
}
