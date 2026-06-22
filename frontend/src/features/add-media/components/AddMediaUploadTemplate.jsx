import React from 'react';
import { UploadMediaItem } from '../../shared/components/UploadMediaItem';
import { Icon } from '../../shared/components/Icon';
import confirmationCorner from '../../shared/components/ConfirmationDialog/assets/confirmation-corner.webp';

export function AddMediaUploadTemplate() {
	return (
		<div id="qq-template" style={{ display: 'none' }}>
			<div className="add-media-fine-uploader qq-uploader-selector">
				<ul className="add-media-upload-items media-upload-items-list qq-upload-list-selector overflow-clip">
					<li>
						<UploadMediaItem className="media-upload-item-main" includeFineUploaderSelectors={true} />
					</li>
				</ul>

				<dialog className="qq-alert-dialog-selector w-full max-w-[520px] border-none bg-transparent p-0 text-left backdrop:bg-black/50">
					<div className="relative overflow-hidden rounded-2xl border-[0.5px] border-border-subtle bg-linear-to-br from-bg-surface-raised to-bg-surface p-5 sm:p-[26px]">
						<img
							src={confirmationCorner}
							alt=""
							width={320}
							height={320}
							aria-hidden="true"
							className="pointer-events-none absolute right-0 bottom-0 w-[160px] max-w-[52%] object-contain"
							loading="lazy"
							decoding="async"
						/>

						<div className="relative z-10 flex flex-col">
							<div className="flex flex-col items-start text-left">
								<Icon name="info3d" size={68} decorative className="shrink-0" />
								<h2 className="heading-h5-24-medium m-0 mt-4 p-0 text-text-strong">Notice</h2>
								<p className="qq-dialog-message-selector body-body-16-regular m-0 mt-2 p-0 text-text-subtle"></p>
							</div>

							<div className="qq-dialog-buttons relative z-10 mt-8 flex flex-wrap justify-end gap-3 sm:gap-4">
								<button
									type="button"
									className="qq-cancel-button-selector inline-flex items-center justify-center rounded-ds-8 border border-transparent bg-brand-primary px-space-base py-size-10 text-btn-text body-body-16-bold hover:bg-brand-primary-hover"
								>
									CLOSE
								</button>
							</div>
						</div>
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
