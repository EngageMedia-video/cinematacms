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
import { UploadMediaItem } from '../shared/components/UploadMediaItem';
import { UPLOAD_STATUS, createTusUploader } from '../shared/utils/tusUpload';
import UserContext from '../../static/js/contexts/UserContext';
import { deleteRequest } from '../../static/js/functions';
import { config as mediacmsConfig } from '../../static/js/mediacms/config.js';
import { Page } from '../../static/js/pages/_Page';
import { SingleUploadPage } from './single-upload/SingleUploadPage';
import { CannotUploadMessage } from './components/CannotUploadMessage';
import { getAddMediaConfig, getCSRFToken, getUploadedMediaDetails } from './utils/helpers';
import BulkUploadPage from './bulk-upload/components/BulkUploadPage.jsx';
import { BulkStepperSlot } from './bulk-upload/components/BulkStepperSlot';
import useBulkUploadStore from './bulk-upload/useBulkUploadStore';

const EMPTY_SINGLE_PREVIEW = {
	title: '',
	company: '',
	country: '',
	category: null,
	thumbnailUrl: '',
	thumbnailFrame: null,
};

// How each transfer status shows in the upload list. An upload that waits for the user to sign
// in again shows as paused, so Continue resumes it; an expired one shows as failed, so Retry
// sends the file again.
const ITEM_STATUS = {
	[UPLOAD_STATUS.UPLOADING]: 'uploading',
	[UPLOAD_STATUS.PAUSED]: 'paused',
	[UPLOAD_STATUS.AWAITING_SIGN_IN]: 'paused',
	[UPLOAD_STATUS.EXPIRED]: 'failed',
	[UPLOAD_STATUS.FAILED]: 'failed',
	[UPLOAD_STATUS.COMPLETE]: 'complete',
};

// Mobile + tablet: below Tailwind's `lg` (1024px) viewport breakpoint.
const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

export class AddMediaPage extends Page {
	static contextType = UserContext;

	constructor(props) {
		super(props, 'add-media');
		this.config = getAddMediaConfig();
		this.uploader = null;
		this.pendingReplaceId = null;
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
			externalMedia: null,
			// Files in the single-upload list: { id, name, size, status, statusText, progress }.
			uploadItems: [],
			// Why a selected file was refused, shown in a notice dialog.
			noticeMessage: '',
			singlePreview: { ...EMPTY_SINGLE_PREVIEW },
			bulkConfig: null,
			bulkStep: 1,
			// Bulk upload needs the desktop layout; below this the Single/Bulk switcher
			// is hidden and only single upload is shown (mobile + tablet).
			isNarrow: false,
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
				userName: this.config.userName || '',
				onMoveSingle: this.moveBulkMediaToSingle,
			},
		});

		// Bulk is desktop-only, so gate it on the viewport (below Tailwind's `lg`),
		// not the @container/page width — the app sidebar can shrink the container
		// below @5xl/page on a desktop screen. Guarded for non-browser/test environments.
		if (typeof window.matchMedia === 'function') {
			this.narrowQuery = window.matchMedia(NARROW_VIEWPORT_QUERY);
			this.handleNarrowChange = (event) => {
				const narrow = event.matches;
				this.setState((state) => (state.isNarrow === narrow ? null : { isNarrow: narrow }));
			};
			this.handleNarrowChange(this.narrowQuery);
			this.narrowQuery.addEventListener('change', this.handleNarrowChange);
		}

		this.lastBulkStep = 1;
		this.unsubscribeBulkStep = useBulkUploadStore.subscribe((state) => {
			if (state.currentStep !== this.lastBulkStep) {
				this.lastBulkStep = state.currentStep;
				this.setState({ bulkStep: state.currentStep });
			}
		});

		this.uploader = createTusUploader({
			endpoint: this.config.uploadEndpoint,
			getHeaders: () => ({ 'X-CSRFToken': getCSRFToken() }),
			messages: {
				tooManyItems: (count) =>
					`You've attempted to upload ${count} files, which exceeds your limit. Non-trusted users can only upload one video at a time.`,
			},
			validation: {
				itemLimit: this.config.uploadMaxFilesNumber,
				sizeLimit: this.config.uploadMaxSize,
				allowedExtensions: this.config.allowedExtensions || [],
			},
			callbacks: {
				onSubmitted: (id, name) => {
					window.CinemataAnalytics?.uploadEvent('start', id);
					const item = { id, name, size: this.uploader.getSize(id), status: 'uploading', progress: 0 };
					this.setState((state) => ({
						hasSelectedMedia: true,
						uploadedMedia: null,
						externalMedia: null,
						uploadItems: [...state.uploadItems, item],
					}));
				},
				onProgress: (id, _name, sentBytes, totalBytes) => {
					const progress = totalBytes > 0 ? Math.round((sentBytes / totalBytes) * 100) : 0;
					// Once every byte is sent the server is creating the media.
					this.updateUploadItem(id, (item) => ({
						progress,
						status: ['uploading', 'processing'].includes(item.status)
							? progress >= 100
								? 'processing'
								: 'uploading'
							: item.status,
					}));
				},
				onStatusChange: (id, status, message) => {
					this.updateUploadItem(id, () => ({
						status: ITEM_STATUS[status],
						statusText: message || undefined,
					}));
				},
				onError: (id, name, errorReason) => {
					window.CinemataAnalytics?.uploadEvent('error', id);
					if (id === null) {
						this.setState((state) => ({
							noticeMessage: errorReason,
							hasSelectedMedia: state.uploadItems.length > 0,
						}));
						return;
					}
					console.warn(`Error on file number ${id} - ${name}.  Reason: ${errorReason}`);
				},
				onCancel: (id) => {
					window.CinemataAnalytics?.uploadEvent('cancel', id);
					this.dropUploadItem(id);
				},
				onComplete: (id, name, response) => {
					if (!response.media_url) {
						window.CinemataAnalytics?.uploadEvent('error', id);
						this.updateUploadItem(id, () => ({ status: 'failed', statusText: undefined }));
						return;
					}
					window.CinemataAnalytics?.uploadEvent('complete', id);

					const details = getUploadedMediaDetails(response, name);
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
		this.unsubscribeBulkStep?.();
		this.narrowQuery?.removeEventListener('change', this.handleNarrowChange);
	}

	clearSubmittedToken = (friendlyToken) => {
		if (!friendlyToken) {
			return;
		}

		Object.entries(this.completedTokens).forEach(([id, token]) => {
			if (token === friendlyToken) {
				delete this.completedTokens[id];
			}
		});
	};

	updateUploadItem(id, change) {
		this.setState((state) => ({
			uploadItems: state.uploadItems.map((item) => (item.id === id ? { ...item, ...change(item) } : item)),
		}));
	}

	// Removes a file from the list. When the list empties, hasSelectedMedia resets so the
	// dropzone reappears.
	dropUploadItem(id) {
		this.setState((state) => {
			const uploadItems = state.uploadItems.filter((item) => item.id !== id);
			return { uploadItems, hasSelectedMedia: uploadItems.length > 0, uploadedMedia: null };
		});
	}

	pauseUpload = (id) => {
		if (this.uploader.pauseUpload(id)) window.CinemataAnalytics?.uploadEvent('pause', id);
	};

	continueUpload = (id) => {
		if (this.uploader.continueUpload(id)) window.CinemataAnalytics?.uploadEvent('resume', id);
	};

	retryUpload = (id) => {
		if (this.uploader.retry(id)) window.CinemataAnalytics?.uploadEvent('retry', id);
	};

	replaceUpload = (id) => {
		this.pendingReplaceId = id;
		this.openFilePicker();
	};

	requestDelete = (id) => {
		const item = this.state.uploadItems.find((candidate) => candidate.id === id);
		this.setState({ confirmDeleteOpen: true, pendingDeleteId: id, pendingDeleteName: item?.name || '' });
	};

	openFilePicker() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'video/*';
		input.className = 'hidden';

		const cleanup = () => input.remove();

		input.addEventListener('change', () => {
			const files = Array.from(input.files || []);

			if (files.length) {
				if (files.length > 1) {
					this.pendingReplaceId = null;
					this.setState({ confirmBulkUploadOpen: true });
					cleanup();
					return;
				}

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

		input.addEventListener('cancel', () => {
			this.pendingReplaceId = null;
			cleanup();
		});

		document.body.appendChild(input);
		input.click();
	}

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
			(response) => {
				if (response.status === 204) window.CinemataAnalytics?.track('media_delete');
			},
			(error) => console.warn('Unable to delete uploaded media ' + friendlyToken, error)
		);
	}

	deleteUploadedMedia(id) {
		const friendlyToken = this.completedTokens[id];
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

		this.deleteUploadedMedia(id);

		const finished = ['complete', 'failed'].includes(this.state.uploadItems.find((item) => item.id === id)?.status);
		if (finished) {
			// Only an unfinished transfer counts as cancelled.
			this.uploader.remove(id);
			this.dropUploadItem(id);
		} else {
			this.uploader.cancel(id);
		}
	}

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

	handleSinglePreviewChange = (preview) => {
		this.setState((state) => ({ singlePreview: { ...state.singlePreview, ...preview } }));
	};

	hasUploadInProgress = () => {
		let bulkFileCount = 0;

		try {
			bulkFileCount = useBulkUploadStore.getState().files.length;
		} catch {
			bulkFileCount = 0;
		}

		return this.state.hasSelectedMedia || !!this.state.uploadedMedia || bulkFileCount > 0;
	};

	doTabSwitch = (nextTab) => {
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
			uploadItems: [],
			singlePreview: { ...EMPTY_SINGLE_PREVIEW },
			confirmTabSwitchOpen: false,
			pendingTab: null,
		});
	};

	moveBulkMediaToSingle = (file) => {
		if (!file?.friendlyToken) {
			return;
		}

		const token = file.friendlyToken;
		this.completedTokens = { moved: token };

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
					this.setState((state) => ({
						singlePreview: {
							...state.singlePreview,
							thumbnailUrl: state.singlePreview.thumbnailFrame
								? state.singlePreview.thumbnailUrl
								: thumbnailUrl,
						},
					}));
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

		if (!this.uploader) {
			console.warn('The uploader is not ready to receive selected media files.');
			return;
		}

		this.setState({ hasSelectedMedia: true, uploadedMedia: null, externalMedia: null }, () => {
			this.uploader.addFiles(files);
		});
	};

	pageContent() {
		if (!this.config.canAdd) {
			return <CannotUploadMessage config={this.config} />;
		}

		const {
			bulkStep,
			confirmBulkUploadOpen,
			confirmDeleteOpen,
			confirmTabSwitchOpen,
			externalMedia,
			hasSelectedMedia,
			isNarrow,
			noticeMessage,
			pendingDeleteName,
			pendingTab,
			selectedTab,
			singlePreview,
			uploadItems,
			uploadedMedia,
		} = this.state;

		const pendingTabLabel = pendingTab === 'bulk-upload' ? 'Bulk Upload' : 'Single Film Upload';

		// Bulk needs the desktop layout, so on mobile/tablet the switcher is hidden
		// and the tab is forced to single.
		const effectiveTab = isNarrow ? 'single-film-upload' : selectedTab;
		const isBulk = effectiveTab === 'bulk-upload';
		const bulkConfig = this.state.bulkConfig;
		const tabsHidden = isNarrow || (isBulk && bulkStep > 1);

		const headerTitle = !isBulk
			? 'Upload Media to Cinemata'
			: bulkStep === 2
				? 'Enter Details'
				: bulkStep === 3
					? 'Preview & Submit'
					: 'Bulk Upload Media to Cinemata';

		return (
			<div className="media-uploader-wrap add-media-page-wrap">
				<main className="add-media-feature @container/page mx-4 py-8 text-text-primary sm:mx-6 lg:mx-10">
					<div className="grid grid-cols-1 gap-8 @5xl/page:grid-cols-[220px_minmax(0,1fr)_340px] @5xl/page:items-start">
						<header className="flex items-start justify-between gap-4 @5xl/page:col-start-2 @5xl/page:row-start-1">
							<div className="w-full">
								<div className="flex flex-row items-center">
									<Text variant="h4" as="h1" className="m-0 text-text-strong flex-1">
										{headerTitle}
									</Text>

									<span className="body-body-12-regular shrink-0 text-text-title-required">
										* Required
									</span>
								</div>

								<Text variant="body-16" color="description" className="m-0 mt-4 max-w-180">
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
						</header>

						<aside className="hidden min-w-0 @5xl/page:block @5xl/page:col-start-1 @5xl/page:row-start-1 @5xl/page:row-span-2 @5xl/page:sticky @5xl/page:top-[calc(var(--header-height)+1rem)] @5xl/page:self-start">
							{isBulk ? <BulkStepperSlot /> : null}
						</aside>

						<section
							className={cn(
								'min-w-0 @5xl/page:col-start-2 @5xl/page:row-start-2',
								isBulk && '@5xl/page:col-end-4'
							)}
						>
							<TabView
								tabMode="wrap"
								triggerClassName="rounded-none py-3 px-size-24 text-text-tab-trigger"
								triggerSelectedColor="bg-bg-section-header"
								panelClassName={tabsHidden ? 'mt-0' : 'mt-8'}
								hideTabList={tabsHidden}
								aria-label="Upload media type"
								defaultSelectedTab="single-film-upload"
								selectedTab={effectiveTab}
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
												<ul className="add-media-upload-items media-upload-items-list m-0 list-none overflow-clip p-0">
													{uploadItems.map((item) => (
														<li key={item.id}>
															<UploadMediaItem
																className="media-upload-item-main"
																title={item.name}
																fileSize={item.size}
																status={item.status}
																statusText={item.statusText}
																progress={item.progress}
																onPause={() => this.pauseUpload(item.id)}
																onContinue={() => this.continueUpload(item.id)}
																onCancel={() => this.removeUploadItem(item.id)}
																onRetry={() => this.retryUpload(item.id)}
																onReupload={() => this.replaceUpload(item.id)}
																onDelete={() => this.requestDelete(item.id)}
															/>
														</li>
													))}
												</ul>
											}
											onSubmitSuccess={this.clearSubmittedToken}
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

						<aside
							className={cn(
								'hidden min-w-0 @5xl/page:block @5xl/page:col-start-3 @5xl/page:row-start-2 @5xl/page:sticky @5xl/page:top-[calc(var(--header-height)+1rem)] @5xl/page:self-start',
								'@5xl/page:mt-19',
								isBulk && '@5xl/page:hidden'
							)}
						>
							{!isBulk && uploadedMedia ? (
								<QuickPreview
									title={singlePreview.title}
									subtitle={this.config.userName || ''}
									country={singlePreview.country}
									category={singlePreview.category}
									thumbnailUrl={singlePreview.thumbnailUrl}
									thumbnailFrame={singlePreview.thumbnailFrame}
									views={0}
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

				<Dialog open={!!noticeMessage} onOpenChange={(open) => !open && this.setState({ noticeMessage: '' })}>
					<ConfirmationDialogContent
						title="Notice"
						subtitle={noticeMessage}
						aria-label="Upload notice"
						actions={
							<Button variant="primary" onClick={() => this.setState({ noticeMessage: '' })}>
								Close
							</Button>
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
