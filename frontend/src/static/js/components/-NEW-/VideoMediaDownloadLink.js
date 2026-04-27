import React, { useState } from 'react';

import { usePopup } from './hooks/usePopup';

import SiteContext from '../../contexts/SiteContext';

import MediaPageStore from '../../pages/MediaPage/store.js';

import { CircleIconButton } from './CircleIconButton';
import { MaterialIcon } from './MaterialIcon';

import { PopupMain } from './Popup';

import { NavigationMenuList } from './NavigationMenuList';
import { NavigationContentApp } from './NavigationContentApp';

import { formatInnerLink } from '../../functions/formatInnerLink';

function downloadOptionsList() {
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
								link: formatInnerLink(encodings_info[k][g].url, SiteContext._currentValue.url),
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
		link: formatInnerLink(media_data.original_media_url, SiteContext._currentValue.url),
		linkAttr: {
			target: '_blank',
			download: media_data.title,
		},
	};

	return Object.values(optionsList);
}

function downloadOptionsPages() {
	return {
		main: (
			<div className="main-options">
				<PopupMain>
					<NavigationMenuList items={downloadOptionsList()} />
				</PopupMain>
			</div>
		),
	};
}

export function VideoMediaDownloadLink(props) {
	const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

	const [downloadOptionsCurrentPage, setDownloadOptionsCurrentPage] = useState('main');

	return (
		<div className="video-downloads hidden-only-in-small">
			<PopupTrigger contentRef={popupContentRef}>
				<button>
					<CircleIconButton type="span">
						<MaterialIcon type="arrow_downward" />
					</CircleIconButton>
					<span>DOWNLOAD</span>
				</button>
			</PopupTrigger>

			<div className={'nav-page-' + downloadOptionsCurrentPage}>
				<PopupContent contentRef={popupContentRef}>
					<NavigationContentApp
						pageChangeCallback={null}
						initPage="main"
						focusFirstItemOnPageChange={false}
						pages={downloadOptionsPages()}
						pageChangeSelector={'.change-page'}
						pageIdSelectorAttr={'data-page-id'}
					/>
				</PopupContent>
			</div>
		</div>
	);
}
