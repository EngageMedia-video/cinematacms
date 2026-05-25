import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { usePopup } from '../../../static/js/components/-NEW-/hooks/usePopup';

import { PopupMain } from '../../../static/js/components/-NEW-/Popup';

import { MediaShareEmbed } from '../../../static/js/components/-NEW-/MediaShareEmbed';
import { MediaShareOptions } from '../../../static/js/components/-NEW-/MediaShareOptions';

import { NavigationContentApp } from '../../../static/js/components/-NEW-/NavigationContentApp';
import { Button } from '../../shared/components/Button/Button';
import { Icon } from '../../shared/components/Icon/Icon';
import { Text } from '../../shared/components/Text/Text';

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

export function MediaShareButton({ isVideo }) {
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
			<div className="sm:hidden">
				<PopupTrigger contentRef={popupContentRef}>
					<Button
						aria-label="Share"
						variant="secondary"
						icon={<Icon name="shareMedia" className="text-cinemata-strait-blue-100" />}
						className="dark:bg-cinemata-strait-blue-900 body-body-14-medium whitespace-nowrap p-size-8"
						size="sm"
					/>
				</PopupTrigger>
			</div>
			<div className="hidden sm:block">
				<PopupTrigger contentRef={popupContentRef}>
					<Button
						aria-label="Share"
						variant="secondary"
						icon={<Icon name="shareMedia" className="text-cinemata-strait-blue-100" />}
						className="dark:bg-cinemata-strait-blue-900 body-body-14-medium whitespace-nowrap"
						size="sm"
					>
						<Text
							as="span"
							variant="body-14-medium"
							className="text-neutral-50 dark:text-cinemata-strait-blue-100 whitespace-nowrap"
						>
							Share
						</Text>
					</Button>
				</PopupTrigger>
			</div>

			<PopupContent contentRef={popupContentRef} className="media-share-popup" hideCallback={onPopupHide}>
				<NavigationContentApp
					initPage={popupCurrentPage}
					pageChangeSelector={'.change-page'}
					pageIdSelectorAttr={'data-page-id'}
					pages={isVideo ? videoSharePopupPages(triggerPopupClose) : mediaSharePopupPages()}
					focusFirstItemOnPageChange={false}
					pageChangeCallback={onPopupPageChange}
				/>
			</PopupContent>
		</div>
	);
}

MediaShareButton.propTypes = {
	isVideo: PropTypes.bool.isRequired,
};
