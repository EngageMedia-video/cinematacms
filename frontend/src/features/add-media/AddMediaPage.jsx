import '../../static/css/tailwind.css';
import '../../static/js/static_pages/styles/AddMediaPage.scss';

import React from 'react';
import { Button } from '../shared/components/Button';
import { ConfirmationDialogContent } from '../shared/components/ConfirmationDialog';
import { Dialog } from '../shared/components/Dialog';
import { TabContent, TabView } from '../shared/components/TabView';
import { Text } from '../shared/components/Text';
import { QuickPreview } from '../upload-quick-preview';
import { cn } from '../shared/utils/classNames';
import UserContext from '../../static/js/contexts/UserContext';
import { deleteRequest } from '../../static/js/functions';
import { config as mediacmsConfig } from '../../static/js/mediacms/config.js';
import { Page } from '../../static/js/pages/_Page';
import { SingleUploadPage } from './single-upload/SingleUploadPage';
import { AddMediaUploadTemplate } from './components/AddMediaUploadTemplate';
import { CannotUploadMessage } from './components/CannotUploadMessage';
import {
	getAddMediaConfig,
	getCSRFToken,
	getStatusLabel,
	getUploadStatus,
	getUploadedMediaDetails,
	updateUploadItemStatus,
} from './utils/helpers';
import BulkUploadPage from './bulk-upload/components/BulkUploadPage.jsx';
import { BulkStepperSlot } from './bulk-upload/components/BulkStepperSlot';
import useBulkUploadStore from './bulk-upload/useBulkUploadStore';

const EMPTY_SINGLE_PREVIEW = { title: '', company: '', country: '', category: null, thumbnailUrl: '' };

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
			confirmTabSwitchOpen: false,
			pendingTab: null,
			hasSelectedMedia: false,
			pendingDeleteId: null,
			pendingDeleteName: '',
			selectedTab: 'single-film-upload',
			uploadedMedia: null,
			// Set when a bulk file is moved into the single tab (one file left): the
			// media is already uploaded, so single shows its edit form (no re-upload).
			externalMedia: null,
			// Live data for the single-upload Quick Preview, reported up from the
			// form so it can render in the shared right-hand slot (below).
			singlePreview: { ...EMPTY_SINGLE_PREVIEW },
			// Config for the Bulk Upload tab; built once in componentDidMount (after
			// UserContext has settled) so canUseAdminSettings reflects the real admin
			// flag rather than a first-render snapshot. Kept stable thereafter.
			bulkConfig: null,
		};
	}

	componentDidMount() {
		// Build the bulk config now that context is settled. Set once and never
		// rebuilt, so the reference stays stable across re-renders — recreating it
		// would re-run useBulkUpload's effect and cancel an in-progress upload.
		this.setState({
			bulkConfig: {
				isTrustedUser: !!this.config.isTrustedUser,
				canUseAdminSettings: !!this.context.is.admin,
				maxFiles: this.config.maxBulkFiles,
				uploadEndpoint: this.config.uploadEndpoint || undefined,
				chunksDoneParam: this.config.chunksDoneParam || undefined,
				onMoveSingle: this.moveBulkMediaToSingle,
			},
		});

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
					this.setState({ hasSelectedMedia: true, uploadedMedia: null, externalMedia: null });
				},
				onError: function (id, name, errorReason) {
					updateUploadItemStatus(id, 'failed', 'Upload failed');
					console.warn(window.qq.format('Error on file number {} - {}.  Reason: {}', id, name, errorReason));
				},
				onCancel: () => {
					// FineUploader's built-in cancel button removes the item element after
					// this callback returns, so defer the state sync to the next tick. When
					// the list empties, reset hasSelectedMedia so the dropzone reappears.
					window.setTimeout(() => this.syncUploaderState(), 0);
				},
				onComplete: (id, _name, response) => {
					if (!response.success) {
						updateUploadItemStatus(id, 'failed', 'Upload failed');
						return;
					}

					updateUploadItemStatus(id, 'complete', 'Complete');

					const details = getUploadedMediaDetails(response, _name);
					this.completedTokens[id] = details.friendlyToken;

					if (this.config.uploadMaxFilesNumber >= 1) {
						this.setState({ uploadedMedia: details });
						this.fetchSinglePreviewThumbnail(details.friendlyToken);
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

	// Delete a Media row created by a finished upload. Best-effort and fire-and-
	// forget: a failed cleanup is logged but never blocks the UI.
	deleteMediaByToken(friendlyToken) {
		if (!friendlyToken) {
			return;
		}

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

	deleteUploadedMedia(id) {
		const friendlyToken = this.completedTokens[id];

		// Only completed uploads exist server-side; in-flight ones are handled by cancel().
		if (!friendlyToken) {
			return;
		}

		delete this.completedTokens[id];
		this.deleteMediaByToken(friendlyToken);
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

		this.syncUploaderState();
	}

	// Reconciles React state with the current upload list. When the list empties,
	// resets FineUploader so the dropzone, browse button, and item-limit counters
	// return to their initial state.
	syncUploaderState() {
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

	// Stable reference so the single-upload form's preview effect doesn't loop.
	// Merge so the upload's thumbnail (set on complete) isn't clobbered by the
	// form's title/company/country/category updates.
	handleSinglePreviewChange = (preview) => {
		this.setState((state) => ({ singlePreview: { ...state.singlePreview, ...preview } }));
	};

	// True when there's work that switching tabs would discard: a single-upload
	// selection/upload, or any files in the bulk wizard.
	hasUploadInProgress = () => {
		let bulkFileCount = 0;
		try {
			bulkFileCount = useBulkUploadStore.getState().files.length;
		} catch {
			bulkFileCount = 0;
		}
		return this.state.hasSelectedMedia || !!this.state.uploadedMedia || bulkFileCount > 0;
	};

	// Clears both flows and switches; called directly when nothing's in progress,
	// or after the user confirms the switch dialog.
	doTabSwitch = (nextTab) => {
		// Discarding in-progress work also removes any media already created on the
		// server — single completed uploads plus bulk files — so switching tabs
		// never leaves orphan drafts behind.
		Object.values(this.completedTokens).forEach((token) => this.deleteMediaByToken(token));
		try {
			useBulkUploadStore.getState().files.forEach((file) => {
				if (file.friendlyToken) {
					this.deleteMediaByToken(file.friendlyToken);
				}
			});
		} catch (error) {
			console.warn('Unable to read bulk upload files on tab change', error);
		}
		this.completedTokens = {};
		try {
			this.uploader?.reset();
		} catch (error) {
			console.warn('Unable to reset uploader on tab change', error);
		}
		try {
			useBulkUploadStore.getState().reset();
		} catch (error) {
			console.warn('Unable to reset bulk upload store on tab change', error);
		}
		this.setState({
			selectedTab: nextTab,
			hasSelectedMedia: false,
			uploadedMedia: null,
			externalMedia: null,
			singlePreview: { ...EMPTY_SINGLE_PREVIEW },
			confirmTabSwitchOpen: false,
			pendingTab: null,
		});
	};

	// Bulk -> single when only one file remains (decision D2): the media is already
	// uploaded, so move it into the single tab's edit form instead of discarding it
	// (no re-upload needed). The bulk wizard is cleared.
	moveBulkMediaToSingle = (file) => {
		if (!file?.friendlyToken) {
			return;
		}
		const token = file.friendlyToken;
		this.completedTokens = {};
		try {
			useBulkUploadStore.getState().reset();
		} catch (error) {
			console.warn('Unable to reset bulk upload store on move-to-single', error);
		}
		this.setState({
			selectedTab: 'single-film-upload',
			hasSelectedMedia: true,
			uploadedMedia: {
				friendlyToken: token,
				editUrl: `/edit?m=${encodeURIComponent(token)}`,
				viewUrl: `/view?m=${encodeURIComponent(token)}`,
				name: file.name || '',
			},
			externalMedia: { name: file.name || '' },
			singlePreview: { ...EMPTY_SINGLE_PREVIEW },
			confirmTabSwitchOpen: false,
			pendingTab: null,
		});
		this.fetchSinglePreviewThumbnail(token);
	};

	handleTabChange = (nextTab) => {
		if (nextTab === this.state.selectedTab) {
			return;
		}
		// Confirm before discarding in-progress work; otherwise switch immediately.
		if (this.hasUploadInProgress()) {
			this.setState({ confirmTabSwitchOpen: true, pendingTab: nextTab });
			return;
		}
		this.doTabSwitch(nextTab);
	};

	cancelTabSwitch = () => {
		this.setState({ confirmTabSwitchOpen: false, pendingTab: null });
	};

	confirmTabSwitch = () => {
		if (this.state.pendingTab) {
			this.doTabSwitch(this.state.pendingTab);
		}
	};

	// Pull the uploaded media's poster so the Quick Preview shows a real image.
	fetchSinglePreviewThumbnail = (friendlyToken) => {
		if (!friendlyToken) {
			return;
		}
		const mediaApiUrl = mediacmsConfig(window.MediaCMS).api.media;
		if (!mediaApiUrl) {
			return;
		}
		// Guard against out-of-order responses: only the most recently requested
		// token may write the preview, so a slow earlier fetch can't clobber it.
		this.latestPreviewToken = friendlyToken;
		fetch(`${mediaApiUrl}/${friendlyToken}`, { credentials: 'same-origin' })
			.then((response) => (response.ok ? response.json() : null))
			.then((data) => {
				if (friendlyToken !== this.latestPreviewToken) {
					return;
				}
				const thumbnailUrl = data && (data.thumbnail_url || data.poster_url);
				if (thumbnailUrl) {
					this.setState((state) => ({ singlePreview: { ...state.singlePreview, thumbnailUrl } }));
				}
			})
			.catch(() => {
				// Preview thumbnail is non-critical; ignore failures.
			});
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

		this.setState({ hasSelectedMedia: true, uploadedMedia: null, externalMedia: null }, () => {
			this.uploader.addFiles(files);
		});
	};

	pageContent() {
		// Anonymous users never reach this React app: the upload_media view redirects
		// them to the (redesigned) allauth sign-in page before the page is served.
		// If that guard is ever bypassed, canAdd is false for them, so they fall
		// through to CannotUploadMessage below.
		if (!this.config.canAdd) {
			return <CannotUploadMessage config={this.config} />;
		}

		const {
			confirmBulkUploadOpen,
			confirmDeleteOpen,
			confirmTabSwitchOpen,
			externalMedia,
			hasSelectedMedia,
			pendingDeleteName,
			pendingTab,
			selectedTab,
			singlePreview,
			uploadedMedia,
		} = this.state;

		const pendingTabLabel = pendingTab === 'bulk-upload' ? 'Bulk Upload' : 'Single Film Upload';

		const isBulk = selectedTab === 'bulk-upload';
		const bulkConfig = this.state.bulkConfig;

		return (
			<div className="media-uploader-wrap add-media-page-wrap">
				{/* Shared 3-column shell: left stepper rail, centre form, right Quick
				    Preview. The single tab uses these slots directly; the bulk tab
				    renders its own stepper/per-file preview, so it spans full width and
				    the side slots are hidden. Container queries respond to the real
				    content width (shrinks when the app sidebar is open). */}
				<main className="add-media-feature @container/page mx-4 py-8 text-text-primary sm:mx-6 lg:mx-10">
					{/* Header sits above the grid with the same left offset as the rail,
					    so it aligns with the centre content identically on both tabs. */}
					<header className="mb-8 flex items-start justify-between gap-4 @4xl/page:pl-[252px]">
						<div className="min-w-0">
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
						</div>
						<span className="body-body-12-regular shrink-0 text-text-accent">* Required</span>
					</header>

					<div className="grid grid-cols-1 gap-8 @4xl/page:grid-cols-[220px_minmax(0,1fr)_340px] @4xl/page:items-start">
						{/* Left rail — the bulk wizard stepper; empty (reserved) on the
						    single tab so the centre card stays aligned across tabs. */}
						<aside className="hidden min-w-0 @4xl/page:block @4xl/page:sticky @4xl/page:top-[calc(var(--header-height)+1rem)] @4xl/page:self-start @4xl/page:pt-2">
							{isBulk ? <BulkStepperSlot /> : null}
						</aside>

						<section className={cn('min-w-0', isBulk && '@4xl/page:col-span-2')}>
							<AddMediaUploadTemplate />

							<TabView
								tabMode="wrap"
								triggerClassName="rounded-none py-3 px-size-22 text-text-tab-trigger"
								triggerSelectedColor="bg-bg-section-header"
								panelClassName="mt-8"
								aria-label="Upload media type"
								defaultSelectedTab="single-film-upload"
								selectedTab={selectedTab}
								onSelectedTabChange={this.handleTabChange}
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
											externalMedia={externalMedia}
											hasUploadedMedia={!!uploadedMedia}
											onFilesSelected={this.handleFilesSelected}
											onPreviewChange={this.handleSinglePreviewChange}
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
									content={bulkConfig ? <BulkUploadPage config={bulkConfig} /> : null}
								/>
							</TabView>
						</section>

						{/* Right slot — live Quick Preview for the single tab, shown once a
						    file has been uploaded. The column stays reserved before then so
						    the form doesn't shift. Hidden for bulk (per-file preview lives
						    inside each card). */}
						<aside
							className={cn(
								'hidden min-w-0 @4xl/page:block @4xl/page:sticky @4xl/page:top-[calc(var(--header-height)+1rem)] @4xl/page:self-start',
								isBulk && '@4xl/page:hidden'
							)}
						>
							{!isBulk && uploadedMedia ? (
								<QuickPreview
									title={singlePreview.title}
									subtitle={singlePreview.company}
									country={singlePreview.country}
									category={singlePreview.category}
									thumbnailUrl={singlePreview.thumbnailUrl}
									className="min-w-0"
								/>
							) : null}
						</aside>
					</div>
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

				<Dialog open={confirmTabSwitchOpen} onOpenChange={(open) => !open && this.cancelTabSwitch()}>
					<ConfirmationDialogContent
						title={`Switch to ${pendingTabLabel}?`}
						subtitle="You have media in progress. Switching tabs will discard it and start over. Do you want to continue?"
						aria-label="Switch upload type confirmation"
						actions={
							<>
								<Button variant="secondary-outline" onClick={this.cancelTabSwitch}>
									Stay
								</Button>
								<Button variant="primary" onClick={this.confirmTabSwitch}>
									Switch
								</Button>
							</>
						}
					/>
				</Dialog>
			</div>
		);
	}
}
