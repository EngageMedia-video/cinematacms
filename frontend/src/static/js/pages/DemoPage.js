import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import PageStore from './_PageStore';
import { usePage, PageLayout } from './page';
import VideoViewer from '../components/MediaViewer/VideoViewer';
import { SiteConsumer } from '../contexts/SiteContext';

// Imports from _VideoMediaPage
import MediaPageStore from './MediaPage/store.js';
import * as MediaPageActions from './MediaPage/actions.js';
import ViewerInfoVideo from './MediaPage/includes/ViewerInfoVideo';
import ViewerError from './MediaPage/includes/ViewerError';
import ViewerSidebar from './MediaPage/includes/ViewerSidebar';
import VideoViewerStore from '../components/MediaViewer/VideoViewer/store.js';

// Import styles
import './styles/DemoPage.scss';

const wideLayoutBreakpoint = 1216;

/**
	* DemoPage component using hook pattern, adapted to be similar to _VideoMediaPage
	*/
export const DemoPage = ({ pageTitle = 'Demo Page' }) => {
	// Initialize the page
	usePage('demo');

	// State from _VideoMediaPage logic
	const [wideLayout, setWideLayout] = useState(
		() => typeof PageStore !== 'undefined' && PageStore.get('window-inner-width') >= wideLayoutBreakpoint
	);
	const [mediaLoaded, setMediaLoaded] = useState(false);
	const [mediaLoadFailed, setMediaLoadFailed] = useState(false);
	const [isVideoMedia, setIsVideoMedia] = useState(false);
	const [theaterMode, setTheaterMode] = useState(false);
	const [pagePlaylistLoaded, setPagePlaylistLoaded] = useState(false);
	const [pagePlaylistData, setPagePlaylistData] = useState(
		() => typeof MediaPageStore !== 'undefined' ? MediaPageStore.get('playlist-data') : null
	);
	const [currentMediaData, setCurrentMediaData] = useState(null);

	// Event Handlers
	const handleWindowResize = useCallback(() => {
		if (typeof PageStore !== 'undefined') {
			setWideLayout(PageStore.get('window-inner-width') >= wideLayoutBreakpoint);
		}
	}, []);

	const handleViewerModeChange = useCallback(() => {
		if (typeof VideoViewerStore !== 'undefined') {
			setTheaterMode(VideoViewerStore.get('in-theater-mode'));
		}
	}, []);

	const handleMediaLoad = useCallback(() => {
		if (typeof MediaPageStore === 'undefined' || typeof VideoViewerStore === 'undefined') return;

		const mediaDataFromStore = MediaPageStore.get('media-data');
		const mediaTypeFromStore = MediaPageStore.get('media-type');
		const videoMedia = 'video' === mediaTypeFromStore;

		setCurrentMediaData(mediaDataFromStore);
		setMediaLoaded(true);
		setMediaLoadFailed(false); // Reset error state on successful load
		setIsVideoMedia(videoMedia);

		if (videoMedia) {
			VideoViewerStore.on('changed_viewer_mode', handleViewerModeChange);
			setTheaterMode(VideoViewerStore.get('in-theater-mode')); // Initial check
		}
	}, [handleViewerModeChange]);

	const handleMediaLoadError = useCallback(() => {
		setMediaLoadFailed(true);
		setMediaLoaded(false); // Ensure media is not considered loaded
	}, []);

	const handlePagePlaylistLoad = useCallback(() => {
		if (typeof MediaPageStore !== 'undefined') {
			setPagePlaylistLoaded(true);
			setPagePlaylistData(MediaPageStore.get('playlist-data'));
		}
	}, []);

	// useEffect for componentDidMount and componentWillUnmount equivalent
	useEffect(() => {
		// Ensure stores are available before proceeding
		if (typeof MediaPageActions !== 'undefined' && typeof PageStore !== 'undefined' && typeof MediaPageStore !== 'undefined') {
			const demoMediaId = '1rCGGuMR4'; // Extracted from previous hardcoded mediaData

			// Ensure window.MediaCMS object exists
			if (typeof window.MediaCMS === 'undefined') {
				window.MediaCMS = {};
			}
			const originalMediaId = window.MediaCMS.mediaId;
			window.MediaCMS.mediaId = demoMediaId;

			MediaPageActions.loadMediaData();

			PageStore.on('window_resize', handleWindowResize);
			MediaPageStore.on('loaded_media_data', handleMediaLoad);
			MediaPageStore.on('loaded_media_error', handleMediaLoadError);
			MediaPageStore.on('loaded_page_playlist_data', handlePagePlaylistLoad);
		}

		// Cleanup
		return () => {
			if (typeof PageStore !== 'undefined') {
				PageStore.off('window_resize', handleWindowResize);
			}
			if (typeof MediaPageStore !== 'undefined') {
				MediaPageStore.off('loaded_media_data', handleMediaLoad);
				MediaPageStore.off('loaded_media_error', handleMediaLoadError);
				MediaPageStore.off('loaded_page_playlist_data', handlePagePlaylistLoad);
			}
			// isVideoMedia is part of component state, check it directly for cleanup logic
			// VideoViewerStore listener is attached in handleMediaLoad
			if (typeof VideoViewerStore !== 'undefined') {
				VideoViewerStore.off('changed_viewer_mode', handleViewerModeChange);
			}

			// Restore original mediaId
			if (typeof window.MediaCMS !== 'undefined') {
				window.MediaCMS.mediaId = originalMediaId;
			}
		};
	}, [handleWindowResize, handleMediaLoad, handleMediaLoadError, handlePagePlaylistLoad, handleViewerModeChange]);


	const viewerClassname = `cf viewer-section${theaterMode ? ' theater-mode' : ' viewer-wide'}`;
	const viewerNestedClassname = `viewer-section-nested${theaterMode ? ' viewer-section' : ''}`;

	let pageSpecificContent;

	if (mediaLoadFailed) {
		pageSpecificContent = (
			<div className={viewerClassname}>
				<ViewerError />
			</div>
		);
	} else if (!mediaLoaded && !pagePlaylistLoaded) {
		pageSpecificContent = (
			<div className="demo-page__loading">
				<p>Loading media information...</p>
			</div>
		);
	}
	else {
		pageSpecificContent = (
			<div className={viewerClassname}>
				<div className="viewer-container">
					{mediaLoaded && currentMediaData ? (
						<SiteConsumer>
							{site => (
								<VideoViewer
									data={currentMediaData}
									siteUrl={site.url}
									inEmbed={false}
								/>
							)}
						</SiteConsumer>
					) : (
						<p>Loading player...</p>
					)}
				</div>
				<div className={viewerNestedClassname}>
					{(!wideLayout || (isVideoMedia && theaterMode)) ? (
						<>
							{mediaLoaded && <ViewerInfoVideo />}
							{pagePlaylistLoaded && currentMediaData && typeof MediaPageStore !== 'undefined' && (
								<ViewerSidebar mediaId={MediaPageStore.get('media-id')} playlistData={pagePlaylistData} />
							)}
						</>
					) : (
						<>
							{pagePlaylistLoaded && currentMediaData && typeof MediaPageStore !== 'undefined' && (
								<ViewerSidebar mediaId={MediaPageStore.get('media-id')} playlistData={pagePlaylistData} />
							)}
							{mediaLoaded && <ViewerInfoVideo />}
						</>
					)}
				</div>
			</div>
		);
	}


	const content = (
		<div className="demo-page">
			<h1 className="demo-page__title">{pageTitle}</h1>

			<div className="demo-page__warning">
				<p>This is a demo page showcasing a video viewer component, adapted with VideoMediaPage functionality.</p>
			</div>

			{pageSpecificContent}
		</div>
	);

	return (
		<PageLayout>
			{content}
		</PageLayout>
	);
};

DemoPage.propTypes = {
	pageTitle: PropTypes.string
};

export default DemoPage;
