import React, { useState } from 'react';

import { usePopup } from './hooks/usePopup';

import { default as Popup, PopupMain } from './Popup';

import { MaterialIcon } from './MaterialIcon';
import { CircleIconButton } from './CircleIconButton';
import { PlaylistShareOptions } from './PlaylistShareOptions';

import { NavigationContentApp } from './NavigationContentApp';

export function PlaylistShareButton(props) {
	const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

	function onPopupHide() {}

	return (
		<div className="share">
			<PopupTrigger contentRef={popupContentRef}>
				<button>
					<CircleIconButton type="span">
						<MaterialIcon type="share" />
					</CircleIconButton>
					<span>SHARE</span>
				</button>
			</PopupTrigger>

			<PopupContent contentRef={popupContentRef} hideCallback={onPopupHide}>
				<NavigationContentApp
					initPage="shareOptions"
					pageChangeSelector={'.change-page'}
					pageIdSelectorAttr={'data-page-id'}
					pages={{
						shareOptions: (
							<div className="popup-fullscreen">
								<PopupMain>
									<span className="popup-fullscreen-overlay"></span>
									<PlaylistShareOptions
										url={props.url}
										title={props.title}
										thumbnailUrl={props.thumbnailUrl}
									/>
								</PopupMain>
							</div>
						),
					}}
					focusFirstItemOnPageChange={false}
				/>
			</PopupContent>
		</div>
	);
}
