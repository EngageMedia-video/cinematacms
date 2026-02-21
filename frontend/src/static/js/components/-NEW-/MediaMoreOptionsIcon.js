import React, { useState, useEffect } from 'react';

import PropTypes from 'prop-types';

import { usePopup } from './hooks/usePopup';

import LinksContext from '../../contexts/LinksContext';
import UserContext from '../../contexts/UserContext';
import SiteContext from '../../contexts/SiteContext';

import PageStore from '../../pages/_PageStore.js';
import * as PageActions from '../../pages/_PageActions.js';

import MediaPageStore from '../../pages/MediaPage/store.js';
import * as MediaPageActions from '../../pages/MediaPage/actions.js';

import { PopupMain } from './Popup';

import { CircleIconButton } from './CircleIconButton';
import { MaterialIcon } from './MaterialIcon';
import { NavigationMenuList } from './NavigationMenuList';
import { ReportForm } from './ReportForm';

import { NavigationContentApp } from './NavigationContentApp';

import { formatInnerLink } from '../../functions/formatInnerLink';

function downloadOptions(mediaData, allowDownload){

	const user = UserContext._currentValue;
	const site = SiteContext._currentValue;

	const encodingsInfo = mediaData.encodings_info;

	const options = {};

	let k, g;

	for(k in encodingsInfo){

		if( encodingsInfo.hasOwnProperty(k) ){

			if( Object.keys( encodingsInfo[k] ).length ){

				for(g in encodingsInfo[k]){

					if( encodingsInfo[k].hasOwnProperty(g) ){

						if( 'success' === encodingsInfo[k][g].status && 100 === encodingsInfo[k][g].progress ){

							options[ encodingsInfo[k][g].title ] = {
								// icon: "arrow_downward",
								// iconPos: 'right',
								text: k + ' - ' + g.toUpperCase() + ' (' + encodingsInfo[k][g].size + ')',
								link: formatInnerLink( encodingsInfo[k][g].url, site.url ),
								linkAttr: {
									target: '_blank',
									download: mediaData.title + '_' + k + '_' + g.toUpperCase(),
								},
							};
						}
					}
				}
			}
		}
	}

	options.original_media_url = {
		// icon: "arrow_downward",
		// iconPos: 'right',
		text: 'Original file (' + mediaData.size + ')',
		link: formatInnerLink( mediaData.original_media_url, site.url ),
		linkAttr: {
			target: '_blank',
			download: mediaData.title,
		},
	};

	return Object.values( options );
}

function optionsItems(mediaData, allowDownload, downloadLink, mediaReported){

	const items = [];

	const user = UserContext._currentValue;
	const site = SiteContext._currentValue;

	const mediaType = mediaData.media_type;
	const mediaIsVideo = 'video' === mediaType;
	const mediaReportedTimes = mediaData.reported_times;

	if( allowDownload && user.can.downloadMedia ){

		if( ! mediaIsVideo ){

			if( downloadLink ){

				items.push({
					itemType: "link",
					link: downloadLink,
					text: "Download",
					icon: "arrow_downward",
					itemAttr:{
			 			className: 'visible-only-in-small'
					},
					linkAttr: {
						target: "_blank",
						download: mediaData.title
					},
				});
			}
		}
		else{

			items.push({
				itemType: "open-subpage",
				text: "Download",
				icon: "arrow_downward",
				itemAttr:{
					className: 'visible-only-in-small'
				},
				buttonAttr: {
					className: 'change-page',
					'data-page-id': 'videoDownloadOptions',
				},
			});
		}
	}

	if( mediaIsVideo && user.can.editMedia ){
		items.push({
			itemType: "open-subpage",
			text: "Status info",
			icon: "info",
			buttonAttr: {
				className: 'change-page',
				'data-page-id': 'mediaStatusInfo',
			},
		});
	}

	if( user.can.reportMedia ){

		/*{ 0 < MediaPageStore.get('media-data').reported_times ? <li className="reports">Reports: <span>{ MediaPageStore.get('media-data').reported_times }</span></li> : null }*/

		if( mediaReported ){
			items.push({
				itemType: "div",
				text: "Reported",
				icon: "flag",
				divAttr: {
					className: 'reported-label loggedin-media-reported',
				},
			});
		}
		else if( user.is.anonymous ){
			// Anonymous users: redirect to sign-in page
			const currentPath = window.location.href.replace(site.url, '').replace(/^\//g, '');
			const loginUrl = LinksContext._currentValue.signin + '?next=/' + currentPath;
			items.push({
				itemType: "link",
				link: loginUrl,
				text: "Report",
				icon: "flag",
			});
		}
		else{
			// Authenticated users: open report form
			items.push({
				itemType: "open-subpage",
				text: "Report",
				icon: "flag",
				buttonAttr: {
					className: 'change-page' + ( mediaReportedTimes ? ' loggedin-media-reported' : '' ),
					'data-page-id': 'loggedInReportMedia',
				},
			});
		}
	}

	return items;
}

function getPopupPages( mediaData, allowDownload, downloadLink, mediaReported, submitReportForm, cancelReportForm ){

	const user = UserContext._currentValue;

	const mediaUrl = mediaData.url;
	const mediaType = mediaData.media_type;
	const mediaState = mediaData.state || 'N/A';
	const mediaEncodingStatus = mediaData.encoding_status || 'N/A';
	const mediaReportedTimes = mediaData.reported_times;
	const mediaIsReviewed = mediaData.is_reviewed;

	const mediaIsVideo = 'video' === mediaType;

	const navItems = optionsItems(mediaData, allowDownload, downloadLink, mediaReported);

	const pages = {};

	if( navItems.length ){
		pages.main = <div className="main-options"><PopupMain><NavigationMenuList items={ navItems } /></PopupMain></div>;
	}

	if( user.can.reportMedia ){
		pages.loggedInReportMedia = mediaReported ? null : <div className="popup-fullscreen">
										<PopupMain>
											<span className="popup-fullscreen-overlay"></span>
											<div><ReportForm mediaUrl={ mediaUrl } submitReportForm={ submitReportForm } cancelReportForm={ cancelReportForm } /></div>
									  	</PopupMain>
								  	</div>;
	}

	if( user.can.editMedia ){
		pages.mediaStatusInfo = <div className="main-options">
									<PopupMain>
										<ul className="media-status-info">
											<li>Media type: <span>{ mediaType }</span></li>
											<li>State: <span>{ mediaState }</span></li>
											<li>Review state: <span>{ mediaIsReviewed ? 'Is reviewed' : 'Pending review' }</span></li>
											{ mediaIsVideo ? <li>Encoding Status: <span>{ mediaEncodingStatus }</span></li> : null }
											{ mediaReportedTimes ? <li className="reports">Reports: <span>{ mediaReportedTimes }</span></li> : null }
										</ul>
								  	</PopupMain>
							  	</div>;
  	}

  	/*if( user.is.anonymous ){

	  	moreOptionsPages.reportMediaSignIn = <div><PopupMain>
										  		<div className="popup-message">
										  			<span className="popup-message-title">Need to report the media?</span>
													<span className="popup-message-main">Sign in to report inappropriate content.</span>
												</div>
												<hr/>
												<span className="popup-message-bottom">
													<a href={ LinksContext._currentValue.signin } className="button-link sign-in" title="Sign in">SIGN IN</a>
												</span>
											</PopupMain></div>;
	}*/

	if( allowDownload && user.can.downloadMedia && mediaIsVideo ){
		pages.videoDownloadOptions = <div className="video-download-options">
										<PopupMain><NavigationMenuList items={ downloadOptions(mediaData, allowDownload) } /></PopupMain>
									</div>;
	}

	return pages;
}

const defaultContainerClassname = 'more-options active-options';

export function MediaMoreOptionsIcon(props){
	props = { allowDownload: false, ...props };

	const user = UserContext._currentValue;
	const site = SiteContext._currentValue;

	const downloadLink = formatInnerLink( MediaPageStore.get( 'media-original-url' ), site.url );
	const mediaData = MediaPageStore.get('media-data');
	const mediaIsVideo = 'video' === mediaData.media_type;

	const [ popupContentRef, PopupContent, PopupTrigger ] = usePopup();

	const [visible, setVisible] = useState(false);
	const [reported, setReported] = useState(false);
	const [popupPages, setPopupPages] = useState({});
	const [popupCurrentPage, setPopupCurrentPage] = useState('main');
	const [containerClassname, setContainerClassname] = useState(defaultContainerClassname);

	function submitReportForm( reportDescription ){ MediaPageActions.reportMedia( reportDescription ); }
	function cancelReportFormSubmission(){ popupContentRef.current.toggle(); }
	function onPopupPageChange(newPage){ setPopupCurrentPage(newPage); }
	function onPopupHide(){ setPopupCurrentPage('main'); }

	function onCompleteMediaReport(){
		popupContentRef.current.tryToHide();
		PageActions.addNotification( "Media Reported", 'reportedMedia' );
		setReported(true);
		MediaPageStore.removeListener( "reported_media", onCompleteMediaReport );
	}

	useEffect( () => {
		if( ! reported ){
			if( visible ){
				MediaPageStore.on( "reported_media", onCompleteMediaReport );
			}
			else{
				MediaPageStore.removeListener( "reported_media", onCompleteMediaReport );
			}
		}
	}, [visible]);

	useEffect( () => {
		setVisible( Object.keys( popupPages ).length && props.allowDownload && user.can.downloadMedia );
	}, [popupPages]);

	useEffect( () => {
		let classname = defaultContainerClassname;
		if( props.allowDownload && user.can.downloadMedia && 'videoDownloadOptions' === popupCurrentPage ){
			classname += ' video-downloads';
		}
		if( 1 === Object.keys( popupPages ).length && props.allowDownload && user.can.downloadMedia && ( mediaIsVideo || downloadLink ) ){
			classname += ' visible-only-in-small';
		}
		setContainerClassname( classname );
	}, [popupCurrentPage]);

	useEffect( () => {
		setPopupPages( getPopupPages( mediaData, props.allowDownload, downloadLink, reported, submitReportForm, cancelReportFormSubmission ) );
	}, [reported]);

	useEffect( () => {
		setPopupPages( getPopupPages( mediaData, props.allowDownload, downloadLink, reported, submitReportForm, cancelReportFormSubmission ) );
	    return () => {
	    	if( visible && ! reported ){
	    		MediaPageStore.removeListener( "reported_media", onCompleteMediaReport );
	    	}
	    }
	}, []);

	return 	(! visible ? null : <div className={ containerClassname }>

				<PopupTrigger contentRef={ popupContentRef }>
					<span><CircleIconButton type="button"><MaterialIcon type="more_horiz" /></CircleIconButton></span>
				</PopupTrigger>

				<div className={ "nav-page-" + popupCurrentPage }>
					<PopupContent contentRef={ popupContentRef } hideCallback={ onPopupHide }>
						<NavigationContentApp
							pageChangeCallback={ onPopupPageChange }
							initPage={ popupCurrentPage }
							focusFirstItemOnPageChange={ false }
							pages={ popupPages }
							pageChangeSelector={ '.change-page' }
							pageIdSelectorAttr={ 'data-page-id' } />
					</PopupContent>
				</div>

			</div>);
}

MediaMoreOptionsIcon.propTypes = {
	allowDownload: PropTypes.bool.isRequired,
};

