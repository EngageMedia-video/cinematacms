import React, { useRef, useState } from 'react';

import { usePopup } from './hooks/usePopup';

import { PopupMain } from './Popup';

import { MaterialIcon } from './MaterialIcon';
import { CircleIconButton } from './CircleIconButton';
import { PlaylistsSelection } from './PlaylistsSelection';

import { NavigationContentApp } from './NavigationContentApp';

function mediaSavePopupPages(onTriggerPopupClose) {
	return {
		selectPlaylist: (
			<div className="popup-fullscreen">
				<PopupMain>
					<span className="popup-fullscreen-overlay"></span>
					<PlaylistsSelection triggerPopupClose={onTriggerPopupClose} />
				</PopupMain>
			</div>
		),
		createPlaylist: (
			<div className="popup-fullscreen">
				<PopupMain>
					<span className="popup-fullscreen-overlay"></span>
					{/* TODO: Continue here... */}
				</PopupMain>
			</div>
		),
	};
}

export function MediaSaveButton(props) {
	const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

	const [popupCurrentPage, setPopupCurrentPage] = useState('selectPlaylist');

	function triggerPopupClose() {
		popupContentRef.current.toggle();
	}

	return (
		<div className="save">
			<PopupTrigger contentRef={popupContentRef}>
				<button>
					<CircleIconButton type="span">
						<MaterialIcon type="playlist_add" />
					</CircleIconButton>
					<span>SAVE</span>
				</button>
			</PopupTrigger>

			<PopupContent contentRef={popupContentRef}>
				<NavigationContentApp
					initPage={popupCurrentPage}
					pageChangeSelector={'.change-page'}
					pageIdSelectorAttr={'data-page-id'}
					pages={mediaSavePopupPages(triggerPopupClose)}
					focusFirstItemOnPageChange={false}
					pageChangeCallback={setPopupCurrentPage}
				/>
			</PopupContent>
		</div>
	);
}
