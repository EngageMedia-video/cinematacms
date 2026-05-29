import React, { Fragment, useContext } from 'react';
import PropTypes from 'prop-types';
import SiteContext from '../../../static/js/contexts/SiteContext';
import MediaPageStore from '../../../static/js/pages/MediaPage/store.js';
import { formatInnerLink } from '../../../static/js/functions/formatInnerLink';
import { Button } from '../../shared/components/Button/Button.jsx';
import { Icon } from '../../shared/components/Icon/Icon.jsx';
import { PopupContent, PopupMain, PopupTrigger, usePopup } from '../../shared/components/Popup';
import { Text } from '../../shared/components/Text/Text.jsx';

function downloadOptionsList(siteUrl) {
	const media_data = MediaPageStore.get('media-data');

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

export function VideoMediaDownloadLink({
	contentRef: externalContentRef,
	popupClassName,
	popupHideCallback,
	popupShowCallback,
	popupStyle,
	triggerRef,
}) {
	const site = useContext(SiteContext);
	const internalContentRef = usePopup();
	const popupContentRef = externalContentRef || internalContentRef;
	const downloadOptions = downloadOptionsList(site.url);

	function hidePopup() {
		popupContentRef.current?.tryToHide();
	}

	return (
		<Fragment>
			<div ref={triggerRef} className="video-downloads relative">
				<div className="sm:hidden">
					<PopupTrigger contentRef={popupContentRef}>
						<Button
							aria-label="Download"
							variant="secondary"
							icon={<Icon name="downloadMedia" className="text-current" />}
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
							icon={<Icon name="downloadMedia" className="text-current" />}
							className="body-body-14-medium whitespace-nowrap"
							size="sm"
						>
							<Text
								as="span"
								variant="body-14-medium"
								className="whitespace-nowrap text-current"
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
				<PopupMain>
					<nav
						aria-label="Download options"
						className="min-w-[220px] overflow-hidden rounded-ds-4 border border-border-strong-constant bg-bg-surface"
					>
						<ul role="menu" className="m-0 list-none p-size-4">
							{downloadOptions.map((option) => (
								<li key={option.link} role="none">
									<a
										{...(option.linkAttr || {})}
										href={option.link}
										role="menuitem"
										title={option.text}
										onClick={hidePopup}
										className="body-body-14-medium block rounded-ds-4 px-size-12 py-size-10 text-text-strong no-underline transition-colors duration-150 hover:bg-bg-surface-hover focus:bg-bg-surface-hover focus:outline-none"
									>
										{option.text}
									</a>
								</li>
							))}
						</ul>
					</nav>
				</PopupMain>
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
