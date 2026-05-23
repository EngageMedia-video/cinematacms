import React, { useState } from 'react';

import { usePopup } from '../../../static/js/components/-NEW-/hooks/usePopup';

import { PopupMain } from '../../../static/js/components/-NEW-/Popup';

import { MaterialIcon } from '../../../static/js/components/-NEW-/MaterialIcon';
import { CircleIconButton } from '../../../static/js/components/-NEW-/CircleIconButton';
import { PlaylistsSelection } from '../../../static/js/components/-NEW-/PlaylistsSelection';

import { NavigationContentApp } from '../../../static/js/components/-NEW-/NavigationContentApp';

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

export function MediaSaveButton() {
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
