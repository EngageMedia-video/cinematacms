import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

import PageStore from './_PageStore';
import { usePage, PageLayout } from './page';
import VideoViewer from '../components/MediaViewer/VideoViewer';
import { SiteConsumer } from '../contexts/SiteContext';
import CommentsList from '../components/-NEW-/Comments';

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


// // Setup mock MediaCMS for the demo page
// if (typeof window.MediaCMS === 'undefined') {
// 	window.MediaCMS = {
// 		features: {
// 			media: {
// 				actions: {
// 					timestampTimebar: true
// 				}
// 			}
// 		},
// 		config: {
// 			contents: {
// 				uploader: {
// 					postUploadMessage: ''
// 				}
// 			}
// 		}
// 	};
// } else {
// 	// Ensure nested properties exist
// 	window.MediaCMS.features = window.MediaCMS.features || {};
// 	window.MediaCMS.features.media = window.MediaCMS.features.media || {};
// 	window.MediaCMS.features.media.actions = window.MediaCMS.features.media.actions || {};
// 	window.MediaCMS.features.media.actions.timestampTimebar = true;

// 	window.MediaCMS.config = window.MediaCMS.config || {};
// 	window.MediaCMS.config.contents = window.MediaCMS.config.contents || {};
// 	window.MediaCMS.config.contents.uploader = window.MediaCMS.config.contents.uploader || {};
// 	window.MediaCMS.config.contents.uploader.postUploadMessage = '';
// }

// // Setup mock MemberContext for the demo page
// if (typeof window.MemberContext === 'undefined') {
// 	window.MemberContext = {
// 		_currentValue: {
// 			is: {
// 				anonymous: false
// 			},
// 			can: {
// 				readComment: true,
// 				editMedia: true,
// 				deleteComment: true
// 			}
// 		}
// 	};
// }

// Actual comments data
const actualComments = [
	{
		add_date: "2024-12-22T11:55:56.797092-05:00",
		text: "0:05 testing if I can timestamp in comments",
		parent: null,
		author_thumbnail_url: "/media/userlogos/2024/12/22/IMG_7818.jpeg",
		author_profile: "/user/dripps/",
		author_name: "Zachary Dripps",
		media_url: "/view?m=kHd7EKAVH",
		uid: "2b9b34ac-cd37-441d-999a-1917599ee851"
	},
	{
		add_date: "2025-03-02T12:49:20.928722-05:00",
		text: "1111",
		parent: null,
		author_thumbnail_url: "/media/userlogos/user.jpg",
		author_profile: "/user/habiburnatore/",
		author_name: "afiya",
		media_url: "/view?m=kHd7EKAVH",
		uid: "d29ec05c-9126-4d1b-b68e-800c7e5ce9cd"
	}
];

// Actual media data
const actualMediaData = {
	url: "https://stage.cinemata.org/view?m=1rCGGuMR4",
	user: "admin",
	title: "4ec2c228d8b240579792587d1626e184.KaDodoy_1080_H264.mp4",
	description: "",
	summary: "KaDodoy",
	add_date: "2025-05-02T19:31:30+01:00",
	edit_date: "2025-05-13T09:41:48.638740+01:00",
	media_type: "video",
	state: "public",
	duration: 301,
	thumbnail_url: "/media/original/thumbnails/user/admin/a1b0bb647d5e4146bfa4ed51e224edb9_64dWHtD.4ec2c228d8b240579792587d1626e184.KaDodoy_1080_H264.mp4.jpg",
	poster_url: "/media/original/thumbnails/user/admin/a1b0bb647d5e4146bfa4ed51e224edb9_PTdgsHA.4ec2c228d8b240579792587d1626e184.KaDodoy_1080_H264.mp4.jpg",
	author_name: "CinemataCMS",
	author_profile: "/user/admin/",
	author_thumbnail: "/media/userlogos/user.jpg",
	views: 9,
	likes: 1,
	dislikes: 0,
	enable_comments: true,
	categories_info: [
		{
			title: "Art",
			url: "/search?c=Art"
		}
	],
	media_country_info: [
		{
			title: "International",
			url: "/search?country=International"
		}
	],
	media_language_info: [
		{
			title: "English",
			url: "/search?language=English"
		}
	]
};

/**
	* DemoPage component using hook pattern, adapted to be similar to _VideoMediaPage
	*/
export const DemoPage = ({ pageTitle = 'Demo Page' }) => {
	// Initialize the page
	usePage('demo');

	// Initialize MediaPageStore with actual data
	useEffect(() => {
		if (typeof MediaPageStore !== 'undefined') {
			// Set up mock contexts if they don't exist
			if (typeof window.LinksContext === 'undefined') {
				window.LinksContext = {
					_currentValue: {
						signin: '/signin',
						profile: {
							media: ['/user/admin/']
						}
					}
				};
			}

			if (typeof window.SiteContext === 'undefined') {
				window.SiteContext = {
					_currentValue: {
						url: 'https://stage.cinemata.org'
					}
				};
			}

			// Set initial media data
			MediaPageStore.set('media-id', '1rCGGuMR4');
			MediaPageStore.set('media-data', actualMediaData);
			MediaPageStore.set('media-url', actualMediaData.url);
			MediaPageStore.set('media-type', 'video');

			// Set initial comments
			MediaPageStore.set('media-comments', actualComments);

			// Force update of actualMediaData to ensure enable_comments is true
			const mediaData = MediaPageStore.get('media-data');
			if (mediaData) {
				mediaData.enable_comments = true;
				MediaPageStore.set('media-data', mediaData);
			}

			// Directly render comments with actualComments to bypass MediaPageStore
			window.forceDisplayComments = actualComments;

			// Trigger comments load event
			MediaPageStore.emit('comments_load');

			// Try to trigger it again after a short delay to ensure it's processed
			setTimeout(() => {
				MediaPageStore.emit('comments_load');
			}, 100);
		}
	}, []);

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
								<>
									<ViewerSidebar mediaId={MediaPageStore.get('media-id')} playlistData={pagePlaylistData} />
									<div className="comments-section">
										<CommentsList />
									</div>
								</>
							)}
						</>
					) : (
						<>
							{pagePlaylistLoaded && currentMediaData && typeof MediaPageStore !== 'undefined' && (
								<>
									<ViewerSidebar mediaId={MediaPageStore.get('media-id')} playlistData={pagePlaylistData} />
									<div className="comments-section">
										<CommentsList />
									</div>
								</>
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

			{/* Always visible comments section */}
			<div className="demo-page__standalone-comments">
				<h2>Comments Section Demo</h2>
				<div className="comments-wrapper">
					<DirectCommentsList />
				</div>
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

// Create a simplified component for displaying comments directly
const DirectCommentsList = () => {
	// Function to process timestamps in comment text and make them clickable
	const processTimestamps = (text) => {
		if (!text) return '';

		// Regular expression to match timestamps like 0:05, 00:05, 0:00:05, etc.
		const timeRegex = /(((\d+):)?(\d+):(\d+))/g;

		// Replace timestamps with clickable links
		const processedText = text.replace(timeRegex, (match) => {
			// Convert timestamp to seconds
			const parts = match.split(':');
			let seconds = 0;
			let multiplier = 1;

			// Process parts from right to left (seconds, minutes, hours)
			for (let i = parts.length - 1; i >= 0; i--) {
				seconds += multiplier * parseInt(parts[i], 10);
				multiplier *= 60;
			}

			// Create clickable link with time parameter
			const videoUrl = `?t=${seconds}`;
			return `<a href="${videoUrl}" class="timestamp-link">${match}</a>`;
		});

		// Handle newlines
		return processedText.replace(/\n/g, '<br />');
	};

	// Use the actual comments data directly
	return (
		<div className="comments-list">
			<div className="comments-list-inner">
				<h2>{actualComments.length} Comments</h2>

				{actualComments.map((c) => (
					<div key={c.uid} className="comment">
						<div className="comment-inner">
							<a className="comment-author-thumb" href={c.author_profile} title={c.author_name}>
								<img src={c.author_thumbnail_url} alt={c.author_name} />
							</a>
							<div className="comment-content">
								<div className="comment-meta">
									<div className="comment-author">
										<a href={c.author_profile} title={c.author_name}>
											{c.author_name}
										</a>
									</div>
									<div className="comment-date">{new Date(c.add_date).toLocaleString()}</div>
								</div>
								<div className="comment-text show-all">
									<div
										className="comment-text-inner"
										dangerouslySetInnerHTML={{ __html: processTimestamps(c.text) }}
									></div>
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};
