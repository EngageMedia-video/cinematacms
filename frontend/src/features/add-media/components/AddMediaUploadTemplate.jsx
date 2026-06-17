import React from 'react';
import { UploadMediaItem } from '../../shared/components/UploadMediaItem';

export function AddMediaUploadTemplate() {
	return (
		<div id="qq-template" style={{ display: 'none' }}>
			<div className="add-media-fine-uploader qq-uploader-selector">
				<ul className="add-media-upload-items media-upload-items-list qq-upload-list-selector overflow-clip">
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
	);
}
