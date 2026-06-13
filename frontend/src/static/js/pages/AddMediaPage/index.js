import React from 'react';
import { UploadMediaItem } from '../../../../features/shared/components/UploadMediaItem';
import { Button } from '../../../../features/shared/components/Button';
import { Dialog } from '../../../../features/shared/components/Dialog';
import { ConfirmationDialogContent } from '../../../../features/shared/components/ConfirmationDialog';
import UserContext from '../../contexts/UserContext';
import { Page } from '../_Page';

import '../../static_pages/styles/AddMediaPage.scss';

function getAddMediaConfig() {
	return (window.MediaCMS && window.MediaCMS.addMediaPage) || {};
}

function getCSRFToken() {
	let cookieVal = null;

	if (document.cookie && '' !== document.cookie) {
		const cookies = document.cookie.split(';');
		let i = 0;

		while (i < cookies.length) {
			const cookie = cookies[i].trim();

			if ('csrftoken=' === cookie.substring(0, 10)) {
				cookieVal = decodeURIComponent(cookie.substring(10));
				break;
			}

			i += 1;
		}
	}

	return cookieVal;
}

function getUploadStatus(status) {
	const qqStatus = window.qq && window.qq.status;

	if (!qqStatus) {
		return 'uploading';
	}

	switch (status) {
		case qqStatus.UPLOAD_SUCCESSFUL:
			return 'complete';
		case qqStatus.UPLOAD_FAILED:
		case qqStatus.REJECTED:
			return 'failed';
		case qqStatus.PAUSED:
			return 'paused';
		default:
			return 'uploading';
	}
}

function getStatusLabel(status) {
	switch (status) {
		case 'complete':
			return 'Complete';
		case 'failed':
			return 'Upload failed';
		case 'paused':
			return 'Paused';
		default:
			return 'Uploading';
	}
}

function updateUploadItemStatus(id, status, statusText) {
	const listEl = document.querySelector('.qq-file-id-' + id);
	const itemEl = listEl ? listEl.querySelector('.upload-media-item') : null;

	if (!itemEl) {
		return;
	}

	itemEl.setAttribute('data-upload-status', status);

	if (statusText) {
		const statusEl = itemEl.querySelector('.qq-upload-status-text-selector');

		if (statusEl) {
			statusEl.textContent = statusText;
		}
	}
}

function AddMediaUploadTemplate() {
	return (
		<div id="qq-template" style={{ display: 'none' }}>
			<div className="media-uploader-bottom-wrap qq-uploader-selector">
				<div className="media-uploader-bottom-left-wrap">
					<div className="media-drag-drop-wrap">
						<div className="media-drag-drop-inner" qq-drop-area-text="Drop files here">
							<div className="media-drag-drop-content">
								<div className="media-drag-drop-content-inner">
									<span>
										<i className="material-icons">cloud_upload</i>
									</span>
									<span>Drag and drop files</span>
									<span>or</span>
									<span className="browse-files-btn-wrap">
										<span className="qq-upload-button-selector">Browse your files</span>
									</span>
									<div className="qq-upload-drop-area-selector media-dropzone" qq-hide-dropzone="">
										<span className="qq-upload-drop-area-text-selector"></span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div className="media-uploader-bottom-right-wrap">
					<ul className="media-upload-items-list qq-upload-list-selector">
						<li>
							<UploadMediaItem className="media-upload-item-main" includeFineUploaderSelectors={true} />
						</li>
					</ul>

					<dialog style={{ backgroundColor: 'white' }} className="qq-alert-dialog-selector">
						<div className="qq-dialog-message-selector"></div>
						<div className="qq-dialog-buttons">
							<button type="button" className="qq-cancel-button-selector">
								CLOSE
							</button>
						</div>
					</dialog>

					<dialog className="qq-confirm-dialog-selector">
						<div className="qq-dialog-message-selector"></div>
						<div className="qq-dialog-buttons">
							<button type="button" className="qq-cancel-button-selector">
								NO
							</button>
							<button type="button" className="qq-ok-button-selector">
								YES
							</button>
						</div>
					</dialog>

					<dialog className="qq-prompt-dialog-selector">
						<div className="qq-dialog-message-selector"></div>
						<input type="text" />
						<div className="qq-dialog-buttons">
							<button type="button" className="qq-cancel-button-selector">
								CANCEL
							</button>
							<button type="button" className="qq-ok-button-selector">
								OK
							</button>
						</div>
					</dialog>
				</div>
			</div>
		</div>
	);
}

function LoginForm({ config }) {
	const redirectUrl = config.uploadMediaUrl || '/upload';
	const signupUrl = (config.signupUrl || '/accounts/signup/') + '?next=' + encodeURIComponent(redirectUrl);
	const loginUrl = config.loginUrl || '/accounts/login/';
	const resetPasswordUrl = config.resetPasswordUrl || '/accounts/password/reset/';

	return (
		<div className="user-action-form-wrap">
			<div className="user-action-form-inner">
				<h1>Sign In</h1>
				<p>Please log in or register before uploading a video.</p>
				<p>
					If you have not created an account yet, then please <a href={signupUrl}>sign up</a> first.
				</p>

				<form className="login" method="POST" action={loginUrl}>
					<input type="hidden" name="csrfmiddlewaretoken" value={config.csrfToken || ''} />
					<div dangerouslySetInnerHTML={{ __html: config.loginFormHtml || '' }}></div>
					<input type="hidden" name="next" value={redirectUrl} />

					<a className="button secondaryAction" href={resetPasswordUrl}>
						Forgot Password?
					</a>

					<button className="primaryAction" type="submit">
						Sign In
					</button>
				</form>
			</div>
		</div>
	);
}

function CannotUploadMessage({ config }) {
	return (
		<React.Fragment>
			{config.canUploadMessage || null}
			<br />
			<a href="/contact">Contact</a> the admin owners for more information.
		</React.Fragment>
	);
}

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
			pendingDeleteId: null,
			pendingDeleteName: '',
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
				onComplete: function (id, _name, response) {
					if (!response.success) {
						updateUploadItemStatus(id, 'failed', 'Upload failed');
						return;
					}

					updateUploadItemStatus(id, 'complete', 'Complete');

					if (this._currentItemLimit === 1) {
						// setTimeout(function(){ window.location.href = response.media_url; }, 500);
						window.location.href = response.media_url.replace('/view?', '/edit?');
						return;
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

		if (listEl && 0 === listEl.children.length) {
			try {
				this.uploader.reset();
			} catch (error) {
				console.warn('Unable to reset uploader', error);
			}
		}
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

	pageContent() {
		if (this.context.is.anonymous) {
			return <LoginForm config={this.config} />;
		}

		if (!this.config.canAdd) {
			return <CannotUploadMessage config={this.config} />;
		}

		const { confirmDeleteOpen, pendingDeleteName } = this.state;

		return (
			<div className="media-uploader-wrap p-6">
				<div className="media-uploader-top-wrap">
					<div className="media-uploader-top-left-wrap">
						<h1>Upload media files</h1>
					</div>
					<div className="media-uploader-top-right-wrap"> </div>
				</div>

				<AddMediaUploadTemplate />

				<div className="media-uploader" ref={this.uploaderRef}></div>

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
