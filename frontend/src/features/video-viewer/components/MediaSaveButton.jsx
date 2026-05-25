import React, { useState } from 'react';

import { usePopup } from '../../../static/js/components/-NEW-/hooks/usePopup';

import { PopupMain } from '../../../static/js/components/-NEW-/Popup';

import { PlaylistsSelection } from '../../../static/js/components/-NEW-/PlaylistsSelection';

import { NavigationContentApp } from '../../../static/js/components/-NEW-/NavigationContentApp';
import { Button } from '../../shared/components/Button/Button';
import { Icon } from '../../shared/components/Icon/Icon';
import { Text } from '../../shared/components/Text/Text';

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
		<div className="save" style={{ position: 'relative' }}>
			<div className="sm:hidden">
				<PopupTrigger contentRef={popupContentRef}>
					<Button
						aria-label="Save to playlist"
						variant="secondary"
						icon={<Icon name="bookmarkFilled" className="text-cinemata-strait-blue-100" />}
						className="body-body-14-medium whitespace-nowrap p-size-8"
						size="sm"
					/>
				</PopupTrigger>
			</div>
			<div className="hidden sm:block">
				<PopupTrigger contentRef={popupContentRef}>
					<Button
						aria-label="Save to playlist"
						variant="secondary"
						icon={<Icon name="bookmarkFilled" className="text-cinemata-strait-blue-100" />}
						className="body-body-14-medium whitespace-nowrap"
						size="sm"
					>
						<Text
							as="span"
							variant="body-14-medium"
							className="text-neutral-50 dark:text-cinemata-strait-blue-100 whitespace-nowrap"
						>
							Save To Playlist
						</Text>
					</Button>
				</PopupTrigger>
			</div>

			<PopupContent
				contentRef={popupContentRef}
				className="media-save-popup"
				style={{
					position: 'absolute',
					top: 0,
					right: 0,
					width: 0,
					height: 0,
					overflow: 'visible',
					backgroundColor: 'transparent',
					boxShadow: 'none',
				}}
			>
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
