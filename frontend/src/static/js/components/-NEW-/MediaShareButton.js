import React, { useRef, useState, useEffect } from 'react';

import { usePopup } from './hooks/usePopup';

import { default as Popup, PopupMain } from './Popup';

import { MaterialIcon } from './MaterialIcon';
import { CircleIconButton } from './CircleIconButton';
import { MediaShareEmbed } from './MediaShareEmbed';
import { MediaShareOptions } from './MediaShareOptions';

import { NavigationContentApp } from './NavigationContentApp';

function mediaSharePopupPages() {
	return {
		shareOptions: (
			<div className="popup-fullscreen">
				<PopupMain>
					<span className="popup-fullscreen-overlay"></span>
					<MediaShareOptions />
				</PopupMain>
			</div>
		),
	};
}

function videoSharePopupPages(onTriggerPopupClose) {
	return {
		...mediaSharePopupPages(),
		shareEmbed: (
			<div className="popup-fullscreen share-embed-popup">
				<PopupMain>
					<span className="popup-fullscreen-overlay"></span>
					<MediaShareEmbed triggerPopupClose={onTriggerPopupClose} />
				</PopupMain>
			</div>
		),
	};
}

export function MediaShareButton(props) {
	const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

	const [popupCurrentPage, setPopupCurrentPage] = useState('shareOptions');

	function triggerPopupClose() {
		popupContentRef.current.toggle();
	}

	function onPopupPageChange(newPage) {
		setPopupCurrentPage(newPage);
	}
	function onPopupHide() {
		setPopupCurrentPage('shareOptions');
	}

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
					initPage={popupCurrentPage}
					pageChangeSelector={'.change-page'}
					pageIdSelectorAttr={'data-page-id'}
					pages={props.isVideo ? videoSharePopupPages(triggerPopupClose) : mediaSharePopupPages()}
					focusFirstItemOnPageChange={false}
					pageChangeCallback={onPopupPageChange}
				/>
			</PopupContent>
		</div>
	);
}
