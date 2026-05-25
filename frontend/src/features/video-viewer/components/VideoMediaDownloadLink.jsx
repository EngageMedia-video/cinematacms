import React, { Fragment, useContext, useState } from 'react';
import PropTypes from 'prop-types';

import { usePopup } from '../../../static/js/components/-NEW-/hooks/usePopup';

import SiteContext from '../../../static/js/contexts/SiteContext';

import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';

import { PopupMain } from '../../../static/js/components/-NEW-/Popup';

import { NavigationMenuList } from '../../../static/js/components/-NEW-/NavigationMenuList';
import { NavigationContentApp } from '../../../static/js/components/-NEW-/NavigationContentApp';

import { formatInnerLink } from '../../../static/js/functions/formatInnerLink';
import { Button } from '../../shared/components/Button/Button.jsx';
import { Icon } from '../../shared/components/Icon/Icon.jsx';
import { Text } from '../../shared/components/Text/Text.jsx';

function downloadOptionsList(siteUrl) {
	const media_data = MediaPageStore.get('media-data');

	const title = media_data.title;
	const encodings_info = media_data.encodings_info;

	const optionsList = {};

	let k, g;
	for (k in encodings_info) {
		if (encodings_info.hasOwnProperty(k)) {
			if (Object.keys(encodings_info[k]).length) {
				for (g in encodings_info[k]) {
					if (encodings_info[k].hasOwnProperty(g)) {
						if ('success' === encodings_info[k][g].status && 100 === encodings_info[k][g].progress) {
							let downloaded_filename = media_data.title + '_' + k + '_' + g;
							if (g === 'vp9') {
								downloaded_filename = downloaded_filename + '.webm';
							} else {
								downloaded_filename = downloaded_filename + '.mp4';
							}
							optionsList[encodings_info[k][g].title] = {
								// icon: "arrow_downward",
								// iconPos: 'right',
								text: k + ' - ' + g.toUpperCase() + ' (' + encodings_info[k][g].size + ')',
								link: formatInnerLink(encodings_info[k][g].url, siteUrl),
								linkAttr: {
									target: '_blank',
									download: downloaded_filename,
								},
							};
						}
					}
				}
			}
		}
	}

	optionsList.original_media_url = {
		// icon: "arrow_downward",
		// iconPos: 'right',
		text: 'Original file (' + media_data.size + ')',
		link: formatInnerLink(media_data.original_media_url, siteUrl),
		linkAttr: {
			target: '_blank',
			download: media_data.title,
		},
	};

	return Object.values(optionsList);
}

function downloadOptionsPages(siteUrl) {
	return {
		main: (
			<div className="main-options">
				<PopupMain>
					<NavigationMenuList items={downloadOptionsList(siteUrl)} />
				</PopupMain>
			</div>
		),
	};
}

export function VideoMediaDownloadLink({
	contentRef: externalContentRef,
	popupClassName,
	popupHideCallback,
	popupShowCallback,
	popupStyle,
	triggerRef,
}) {
	const site = useContext(SiteContext);
	const [internalContentRef, PopupContent, PopupTrigger] = usePopup();
	const popupContentRef = externalContentRef || internalContentRef;

	const [downloadOptionsCurrentPage] = useState('main');

	return (
		<Fragment>
			<div ref={triggerRef} className="video-downloads" style={{ position: 'relative' }}>
				<div className="sm:hidden">
					<PopupTrigger contentRef={popupContentRef}>
						<Button
							aria-label="Download"
							variant="secondary"
							icon={<Icon name="downloadMedia" className="text-cinemata-strait-blue-100" />}
							className="body-body-14-medium whitespace-nowrap p-size-8"
							size="sm"
						/>
					</PopupTrigger>
				</div>
				<div className="hidden sm:block">
					<PopupTrigger contentRef={popupContentRef}>
						<Button
							aria-label="Download"
							variant="secondary"
							icon={<Icon name="downloadMedia" className="text-cinemata-strait-blue-100" />}
							className="body-body-14-medium whitespace-nowrap"
							size="sm"
						>
							<Text
								as="span"
								variant="body-14-medium"
								className="text-neutral-50 dark:text-cinemata-strait-blue-100 whitespace-nowrap"
							>
								Download
							</Text>
							<Icon name="caretDown" className="ml-2 w-4 h-4" />
						</Button>
					</PopupTrigger>
				</div>
			</div>

			<PopupContent
				contentRef={popupContentRef}
				className={popupClassName}
				hideCallback={popupHideCallback}
				showCallback={popupShowCallback}
				style={
					popupStyle || {
						position: 'absolute',
						top: 'calc(100% + 8px)',
						right: 0,
						zIndex: 4,
					}
				}
			>
				<div className={'nav-page-' + downloadOptionsCurrentPage}>
					<NavigationContentApp
						pageChangeCallback={null}
						initPage="main"
						focusFirstItemOnPageChange={false}
						pages={downloadOptionsPages(site.url)}
						pageChangeSelector={'.change-page'}
						pageIdSelectorAttr={'data-page-id'}
					/>
				</div>
			</PopupContent>
		</Fragment>
	);
}

VideoMediaDownloadLink.propTypes = {
	contentRef: PropTypes.shape({ current: PropTypes.object }),
	popupClassName: PropTypes.string,
	popupHideCallback: PropTypes.func,
	popupShowCallback: PropTypes.func,
	popupStyle: PropTypes.object,
	renderPopup: PropTypes.bool,
	renderTrigger: PropTypes.bool,
	triggerRef: PropTypes.shape({ current: PropTypes.any }),
};

VideoMediaDownloadLink.defaultProps = {
	contentRef: null,
	popupClassName: undefined,
	popupHideCallback: undefined,
	popupShowCallback: undefined,
	popupStyle: null,
	renderPopup: true,
	renderTrigger: true,
	triggerRef: null,
};
