import React, { useContext } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import axios from 'axios';

import { usePage, PageLayout } from '../../static/js/pages/page';
import ApiUrlContext from '../../static/js/contexts/ApiUrlContext';
import SiteContext from '../../static/js/contexts/SiteContext';
import useDemoStore from './useDemoStore';

import '../../static/css/tailwind.css';

// ─── Token Reference Data ────────────────────────────────────────────────────
// Each entry: [tailwindToken, cssVariable, purpose]
// Tailwind class = <utility>-<tailwindToken>, e.g. bg-brand-primary, text-content-body

const TOKEN_SECTIONS = [
	// ── Core sections (rendered as swatches + live recipes) ───────────────────
	{
		id: 'brand',
		title: 'Brand & Theme',
		group: 'core',
		description:
			'Site identity colors. brand-theme is the masthead/nav tint; brand-accent is the secondary identity color.',
		display: 'swatch',
		tokens: [
			['brand-theme', '--default-theme-color', 'Theme accent (header, active states)'],
			['brand-accent', '--default-brand-color', 'Secondary brand color'],
		],
	},
	{
		id: 'buttons',
		title: 'Buttons',
		group: 'core',
		description: 'Primary and secondary button colors — backgrounds, text, icons, borders, and hover states.',
		display: 'swatch',
		tokens: [
			['brand-primary', '--btn-primary-bg-color', 'Primary button background'],
			['brand-primary-hover', '--btn-primary-bg-hover-color', 'Primary button hover'],
			['brand-primary-icon', '--btn-primary-icon-color', 'Primary button icon'],
			['btn-text', '--btn-color', 'Primary button text'],
			['brand-secondary', '--btn-secondary-bg-color', 'Secondary button background'],
			['brand-secondary-hover', '--btn-secondary-bg-hover-color', 'Secondary button hover'],
			['brand-secondary-border', '--btn-secondary-border-color', 'Secondary button border'],
			['btn-secondary-text', '--btn-secondary-color', 'Secondary button text'],
			['btn-secondary-icon', '--btn-secondary-icon-color', 'Secondary button icon'],
			['btn-secondary-icon-hover', '--btn-secondary-icon-hover-color', 'Secondary button icon hover'],
		],
	},
	{
		id: 'surfaces',
		title: 'Surfaces',
		group: 'core',
		description: 'Background surfaces — the visual layers of the UI from body to popup.',
		display: 'swatch',
		tokens: [
			['surface-body', '--body-bg-color', 'Page background'],
			['surface-sidebar', '--sidebar-bg-color', 'Sidebar background'],
			['surface-header', '--header-bg-color', 'Header background'],
			['surface-input', '--input-bg-color', 'Input field background'],
			['surface-input-disabled', '--input-disabled-bg-color', 'Disabled input background'],
			['surface-popup', '--popup-bg-color', 'Popup/modal background'],
		],
	},
	{
		id: 'content',
		title: 'Content & Text',
		group: 'core',
		description: 'Text and foreground colors — body copy, inputs, links, and status indicators.',
		display: 'swatch',
		tokens: [
			['content-body', '--body-text-color', 'Main body text'],
			['content-input', '--input-color', 'Input text'],
			['content-link', '--links-color', 'Hyperlink text'],
			['content-error', '--error-text-color', 'Error messages'],
			['content-success', '--success-color', 'Success indicators'],
			['content-warning', '--warning-color', 'Warning indicators'],
			['content-danger', '--danger-color', 'Danger/destructive actions'],
		],
	},
	{
		id: 'borders',
		title: 'Borders',
		group: 'core',
		description: 'Border and divider colors.',
		display: 'swatch',
		tokens: [
			['border-input', '--input-border-color', 'Input/card borders'],
			['border-hr', '--hr-color', 'Horizontal rules'],
			['border-dotted-outline', '--dotted-outline-color', 'Dotted outlines (focus, dropzones)'],
		],
	},
	{
		id: 'typography',
		title: 'Typography',
		group: 'core',
		description: 'Font family tokens. Use font-heading for titles and font-sans for body text.',
		display: 'info',
		tokens: [
			['font-sans', "'Amulya', 'Arial', sans-serif", 'Body text font'],
			['font-heading', "'Facultad', 'Arial', sans-serif", 'Heading font'],
		],
	},
	{
		id: 'spacing',
		title: 'Layout Spacing',
		group: 'core',
		description: 'Dimension tokens read live CSS vars, so _extra.css overrides flow through automatically.',
		display: 'info',
		tokens: [
			['header-height', '--header-height', 'Header bar height'],
			['sidebar-width', '--sidebar-width', 'Sidebar width'],
			['sidebar-nav-px', '1.5rem', 'Sidebar nav horizontal padding'],
			['header-px', '1rem', 'Header horizontal padding'],
			['logo-height', '--default-logo-height', 'Site logo height'],
			['item-width', '--default-item-width', 'Media card width'],
		],
	},
	{
		id: 'site-palette',
		title: 'Site Palette',
		group: 'core',
		description:
			'Formalised from _extra.css hardcoded colors into proper theme variables. These auto-switch on dark/light toggle — no dark: prefix needed.',
		display: 'pairs',
		tokenCount: 10,
		// [purpose, token, lightHex, darkHex]
		pairs: [
			['Meta text & icons (viewer sidebar, filters, playlist counters)', 'site-meta', '#869ea5', '#bad8dd'],
			['Links & headings (year produced, sidebar icons, category links)', 'site-heading', '#1a3f61', '#7bbbbf'],
			['Emphasis content (custom pages .emphasis, .emphasis-large)', 'site-emphasis', '#026690', '#7bbbbf'],
			['Content boxes (.box, .box-list backgrounds)', 'site-box-bg', '#ebf7f9', '#0b3145'],
			['Brand CTA orange (Sign In, edit buttons, play button hover)', 'site-accent', '#ed7c30', '#ed7c30'],
			['Brand salmon (heading underlines, decorative elements)', 'site-accent-alt', '#e7a27b', '#e7a27b'],
			['Header search field background', 'site-search-bg', '#102c40', '#102c40'],
			['Form buttons (login, register) — navy in light, teal in dark', 'site-form-btn', '#1a3f61', '#7bbbbf'],
			['Featured item content overlay', 'site-featured-bg', '#dfeff4', '#0b3144'],
			['Video player accent (play button, progress bar)', 'site-player-accent', '#026690', '#026690'],
		],
	},
	{
		id: 'button-theme-switches',
		title: 'Button Theme Switches',
		group: 'core',
		description:
			'Existing theme variables that change dramatically between light and dark. These are already bridged as Tailwind tokens — this table highlights the visual difference for developer awareness.',
		display: 'pairs',
		tokenCount: 3,
		// [purpose, token, lightHex, darkHex]
		pairs: [
			['Primary button bg — navy in light, orange in dark', 'brand-primary', '#1a3f61', '#ed7c30'],
			[
				'Primary button hover — deep blue in light, dark orange in dark',
				'brand-primary-hover',
				'#026690',
				'#c16732',
			],
			['Secondary button hover — teal in light, navy in dark', 'brand-secondary-hover', '#4a90a4', '#1a3f61'],
		],
	},

	// ── Component sections (rendered as condensed tables) ─────────────────────
	{
		id: 'header-sidebar-nav',
		title: 'Header, Sidebar & Nav',
		group: 'component',
		description: 'Navigation chrome — header buttons, sidebar links, and nav menu states.',
		display: 'table',
		tokens: [
			['header-btn', '--header-circle-button-color', 'Header circle button icon'],
			['header-popup-text', '--header-popup-menu-color', 'Header dropdown text'],
			['header-popup-icon', '--header-popup-menu-icon-color', 'Header dropdown icon'],
			['sidebar-nav-border', '--sidebar-nav-border-color', 'Sidebar nav divider'],
			['sidebar-nav-text', '--sidebar-nav-item-text-color', 'Sidebar nav link text'],
			['sidebar-nav-icon', '--sidebar-nav-item-icon-color', 'Sidebar nav link icon'],
			['sidebar-bottom-link', '--sidebar-bottom-link-color', 'Sidebar footer link'],
			['nav-active-bg', '--nav-menu-active-item-bg-color', 'Active nav item background'],
			['nav-hover-bg', '--nav-menu-item-hover-bg-color', 'Nav item hover background'],
			['nav-popup-hover-bg', '--in-popup-nav-menu-item-hover-bg-color', 'Popup nav hover background'],
		],
	},
	{
		id: 'search',
		title: 'Search Field',
		group: 'component',
		description: 'Search input and submit button colors.',
		display: 'table',
		tokens: [
			['search-input-text', '--search-field-input-text-color', 'Search input text'],
			['search-input-bg', '--search-field-input-bg-color', 'Search input background'],
			['search-input-border', '--search-field-input-border-color', 'Search input border'],
			['search-submit-text', '--search-field-submit-text-color', 'Submit button text'],
			['search-submit-bg', '--search-field-submit-bg-color', 'Submit button background'],
			['search-submit-border', '--search-field-submit-border-color', 'Submit button border'],
			['search-submit-hover-bg', '--search-field-submit-hover-bg-color', 'Submit hover background'],
			['search-submit-hover-border', '--search-field-submit-hover-border-color', 'Submit hover border'],
			['search-result-title', '--search-results-item-content-link-title-text-color', 'Result title text'],
		],
	},
	{
		id: 'comments',
		title: 'Comments',
		group: 'component',
		description: 'Comment textarea, author, dates, actions, and reply/cancel buttons.',
		display: 'table',
		tokens: [
			['comment-textarea-border', '--comments-textarea-wrapper-border-color', 'Textarea border'],
			['comment-textarea-after-bg', '--comments-textarea-wrapper-after-bg-color', 'Textarea pseudo-element bg'],
			['comment-textarea-text', '--comments-textarea-text-color', 'Textarea text'],
			['comment-textarea-placeholder', '--comments-textarea-text-placeholder-color', 'Textarea placeholder'],
			['comment-list-border', '--comments-list-inner-border-color', 'Comment list divider'],
			['comment-author', '--comment-author-text-color', 'Author name'],
			['comment-date', '--comment-date-text-color', 'Date text'],
			['comment-date-hover', '--comment-date-hover-text-color', 'Date hover text'],
			['comment-text', '--comment-text-color', 'Comment body text'],
			['comment-action-icon', '--comment-actions-material-icon-text-color', 'Action icon'],
			['comment-likes', '--comment-actions-likes-num-text-color', 'Like count'],
			['comment-reply', '--comment-actions-reply-button-text-color', 'Reply button'],
			['comment-reply-hover', '--comment-actions-reply-button-hover-text-color', 'Reply button hover'],
			['comment-cancel', '--comment-actions-cancel-removal-button-text-color', 'Cancel button'],
			['comment-cancel-hover', '--comment-actions-cancel-removal-button-hover-text-color', 'Cancel button hover'],
		],
	},
	{
		id: 'media-items',
		title: 'Media Items & Lists',
		group: 'component',
		description: 'Media cards, item metadata, playlist links, and load-more buttons.',
		display: 'table',
		tokens: [
			['item-bg', '--item-bg-color', 'Card background'],
			['item-title', '--item-title-text-color', 'Card title text'],
			['item-thumb-bg', '--item-thumb-bg-color', 'Thumbnail placeholder bg'],
			['item-meta', '--item-meta-text-color', 'Meta text (views, date)'],
			['item-meta-link', '--item-meta-link-text-color', 'Meta link text'],
			['item-meta-link-hover', '--item-meta-link-hover-text-color', 'Meta link hover'],
			['item-profile-title-bg', '--profile-page-item-content-title-bg-color', 'Profile card title bg'],
			['item-playlist-link', '--playlist-item-main-view-full-link-text-color', 'Playlist item link'],
			[
				'item-playlist-link-hover',
				'--playlist-item-main-view-full-link-hover-text-color',
				'Playlist item link hover',
			],
			['item-list-load-more', '--item-list-load-more-text-color', 'Load more button'],
			['item-list-load-more-hover', '--item-list-load-more-hover-text-color', 'Load more hover'],
			['media-list-border', '--media-list-row-border-color', 'Media list row border'],
			['media-list-header-link', '--media-list-header-title-link-text-color', 'List header link'],
		],
	},
	{
		id: 'playlist',
		title: 'Playlist',
		group: 'component',
		description: 'Playlist form, save popup, view header, page layout, and video list.',
		display: 'table',
		tokens: [
			// Form
			['pl-form-title-focus', '--playlist-form-title-focused-bg-color', 'Form title focused bg'],
			['pl-form-privacy-border', '--playlist-privacy-border-color', 'Privacy select border'],
			['pl-form-cancel', '--playlist-form-cancel-button-text-color', 'Form cancel button'],
			['pl-form-cancel-hover', '--playlist-form-cancel-button-hover-text-color', 'Form cancel hover'],
			['pl-form-field-text', '--playlist-form-field-text-color', 'Form field text'],
			['pl-form-field-border', '--playlist-form-field-border-color', 'Form field border'],
			// Save popup
			['pl-save-text', '--playlist-save-popup-text-color', 'Save popup text'],
			['pl-save-border', '--playlist-save-popup-border-color', 'Save popup border'],
			['pl-save-create-icon', '--playlist-save-popup-create-icon-text-color', 'Create icon'],
			['pl-save-create-focus-bg', '--playlist-save-popup-create-focus-bg-color', 'Create focused bg'],
			// View
			['pl-view-header-bg', '--playlist-view-header-bg-color', 'View header bg'],
			['pl-view-toggle', '--playlist-view-header-toggle-text-color', 'Toggle text'],
			['pl-view-toggle-bg', '--playlist-view-header-toggle-bg-color', 'Toggle bg'],
			['pl-view-title-link', '--playlist-view-title-link-text-color', 'Title link'],
			['pl-view-meta', '--playlist-view-meta-text-color', 'View meta text'],
			['pl-view-meta-link', '--playlist-view-meta-link-color', 'View meta link'],
			['pl-view-meta-link-hover', '--playlist-view-meta-link-hover-text-color', 'View meta link hover'],
			['pl-view-status', '--playlist-view-status-text-color', 'Status text'],
			['pl-view-status-bg', '--playlist-view-status-bg-color', 'Status bg'],
			['pl-view-status-icon', '--playlist-view-status-icon-text-color', 'Status icon'],
			['pl-view-actions-bg', '--playlist-view-actions-bg-color', 'Actions bar bg'],
			['pl-view-media-bg', '--playlist-view-media-bg-color', 'Media section bg'],
			['pl-view-order', '--playlist-view-media-order-number-color', 'Track order number'],
			['pl-view-item-title', '--playlist-view-item-title-text-color', 'Item title'],
			['pl-view-item-author', '--playlist-view-item-author-text-color', 'Item author'],
			['pl-view-item-author-bg', '--playlist-view-item-author-bg-color', 'Item author bg'],
			// Page
			['pl-page-bg', '--playlist-page-bg-color', 'Page bg'],
			['pl-page-details', '--playlist-page-details-text-color', 'Details text'],
			['pl-page-details-bg', '--playlist-page-details-bg-color', 'Details bg'],
			['pl-page-thumb-bg', '--playlist-page-thumb-bg-color', 'Thumbnail bg'],
			['pl-page-title-link', '--playlist-page-title-link-text-color', 'Page title link'],
			['pl-page-action-icon', '--playlist-page-actions-circle-icon-text-color', 'Action icon'],
			['pl-page-action-icon-bg', '--playlist-page-actions-circle-icon-bg-color', 'Action icon bg'],
			['pl-page-action-btn', '--playlist-page-actions-nav-item-button-text-color', 'Action button text'],
			['pl-page-cancel', '--playlist-page-actions-popup-message-bottom-cancel-button-text-color', 'Cancel text'],
			[
				'pl-page-cancel-hover',
				'--playlist-page-actions-popup-message-bottom-cancel-button-hover-text-color',
				'Cancel hover',
			],
			[
				'pl-page-cancel-icon-hover',
				'--playlist-page-actions-popup-message-bottom-cancel-button-icon-hover-text-color',
				'Cancel icon hover',
			],
			['pl-page-status', '--playlist-page-status-text-color', 'Status text'],
			['pl-page-status-bg', '--playlist-page-status-bg-color', 'Status bg'],
			['pl-page-status-icon', '--playlist-page-status-icon-text-color', 'Status icon'],
			['pl-page-author-border', '--playlist-page-author-border-top-color', 'Author border'],
			['pl-page-author-name', '--playlist-page-author-name-link-color', 'Author name'],
			['pl-page-edit-icon', '--playlist-page-author-edit-playlist-icon-button-text-color', 'Edit icon'],
			['pl-page-edit-icon-bg', '--playlist-page-author-edit-playlist-icon-button-bg-color', 'Edit icon bg'],
			[
				'pl-page-edit-icon-active',
				'--playlist-page-author-edit-playlist-icon-button-active-text-color',
				'Edit icon active',
			],
			['pl-page-edit-form-text', '--playlist-page-author-edit-playlist-form-wrap-text-color', 'Edit form text'],
			['pl-page-edit-form-bg', '--playlist-page-author-edit-playlist-form-wrap-bg-color', 'Edit form bg'],
			[
				'pl-page-edit-form-border',
				'--playlist-page-author-edit-playlist-form-wrap-border-color',
				'Edit form border',
			],
			[
				'pl-page-edit-form-icon-hover',
				'--playlist-page-author-edit-playlist-form-wrap-title-circle-icon-hover-text-color',
				'Edit form icon hover',
			],
			[
				'pl-page-edit-author-thumb',
				'--playlist-page-author-edit-playlist-author-thumb-text-color',
				'Author thumb text',
			],
			[
				'pl-page-edit-author-thumb-bg',
				'--playlist-page-author-edit-playlist-author-thumb-bg-color',
				'Author thumb bg',
			],
			['pl-page-video-list-bg', '--playlist-page-video-list-bg-color', 'Video list bg'],
			['pl-page-video-item-title-bg', '--playlist-page-video-list-item-title-bg-color', 'Video title bg'],
			['pl-page-video-item-hover-bg', '--playlist-page-video-list-item-hover-bg-color', 'Video item hover bg'],
			[
				'pl-page-video-item-title-hover-bg',
				'--playlist-page-video-list-item-title-hover-bg-color',
				'Video title hover bg',
			],
			['pl-page-video-item-after-bg', '--playlist-page-video-list-item-after-bg-color', 'Video item after bg'],
			['pl-page-video-order', '--playlist-page-video-list-item-order-text-color', 'Video order number'],
			[
				'pl-page-video-options-hover',
				'--playlist-page-video-list-item-options-icon-hover-color',
				'Options icon hover',
			],
			[
				'pl-page-video-cancel',
				'--playlist-page-video-list-item-options-popup-cancel-removal-button-text-color',
				'Video cancel text',
			],
			[
				'pl-page-video-cancel-hover',
				'--playlist-page-video-list-item-options-popup-cancel-removal-button-hover-text-color',
				'Video cancel hover',
			],
			[
				'pl-page-video-cancel-icon-hover',
				'--playlist-page-video-list-item-options-popup-cancel-removal-button-hover-icon-text-color',
				'Video cancel icon hover',
			],
		],
	},
	{
		id: 'upload',
		title: 'Upload',
		group: 'component',
		description: 'Add-media page — dialog, dropzone, uploader buttons and spinners.',
		display: 'table',
		tokens: [
			['upload-dialog-bg', '--add-media-page-tmplt-dialog-bg-color', 'Dialog bg'],
			['upload-uploader-bg', '--add-media-page-tmplt-uploader-bg-color', 'Uploader bg'],
			['upload-dropzone-bg', '--add-media-page-tmplt-dropzone-bg-color', 'Dropzone bg'],
			['upload-drag-text', '--add-media-page-tmplt-drag-drop-inner-text-color', 'Drag-drop text'],
			['upload-spinner', '--add-media-page-tmplt-upload-item-spiner-text-color', 'Upload spinner'],
			['upload-actions', '--add-media-page-tmplt-upload-item-actions-text-color', 'Upload actions text'],
			['upload-btn-text', '--add-media-page-qq-gallery-upload-button-text-color', 'Upload button text'],
			['upload-btn-icon', '--add-media-page-qq-gallery-upload-button-icon-text-color', 'Upload button icon'],
			[
				'upload-btn-hover-text',
				'--add-media-page-qq-gallery-upload-button-hover-text-color',
				'Button hover text',
			],
			[
				'upload-btn-hover-icon',
				'--add-media-page-qq-gallery-upload-button-hover-icon-text-color',
				'Button hover icon',
			],
			['upload-btn-focus', '--add-media-page-qq-gallery-upload-button-focus-text-color', 'Button focus text'],
			['upload-page', '--add-media-page-color', 'Upload page text'],
		],
	},
	{
		id: 'profile',
		title: 'Profile',
		group: 'component',
		description: 'Profile page header, navigation, and video count.',
		display: 'table',
		tokens: [
			['profile-bg', '--profile-page-bg-color', 'Page bg'],
			['profile-header-bg', '--profile-page-header-bg-color', 'Header bg'],
			['profile-videos-count', '--profile-page-info-videos-number-text-color', 'Video count text'],
			['profile-nav-link', '--profile-page-nav-link-text-color', 'Nav link text'],
			['profile-nav-link-hover', '--profile-page-nav-link-hover-text-color', 'Nav link hover'],
			['profile-nav-link-active', '--profile-page-nav-link-active-text-color', 'Nav link active'],
			['profile-nav-active-bar', '--profile-page-nav-link-active-after-bg-color', 'Active tab bar'],
		],
	},
	{
		id: 'popup',
		title: 'Popup / Modal',
		group: 'component',
		description: 'Popup overlays — header, messages, and dividers.',
		display: 'table',
		tokens: [
			['popup-hr', '--popup-hr-bg-color', 'Popup divider'],
			['popup-top-text', '--popup-top-text-color', 'Popup header text'],
			['popup-top-bg', '--popup-top-bg-color', 'Popup header bg'],
			['popup-msg-title', '--popup-msg-title-text-color', 'Message title'],
			['popup-msg-body', '--popup-msg-main-text-color', 'Message body'],
		],
	},
	{
		id: 'media-page',
		title: 'Media Page',
		group: 'component',
		description: 'Media viewing page — title, actions, sharing, author banner, and embed.',
		display: 'table',
		tokens: [
			// Title & Banner
			['media-title-border', '--media-title-banner-border-color', 'Title banner border'],
			['media-labels', '--media-title-labels-area-text-color', 'Labels text'],
			['media-labels-bg', '--media-title-labels-area-bg-color', 'Labels background'],
			['media-views', '--media-title-views-text-color', 'View count text'],
			// Actions
			['media-action-focus-bg', '--media-actions-not-popup-circle-icon-focus-bg-color', 'Action focus bg'],
			['media-action-active-bg', '--media-actions-not-popup-circle-icon-active-bg-color', 'Action active bg'],
			['media-like-border', '--media-actions-like-before-border-color', 'Like divider border'],
			// Share
			['media-share-title', '--media-actions-share-title-text-color', 'Share title text'],
			['media-share-nav-btn', '--media-actions-share-options-nav-button-text-color', 'Share nav button'],
			['media-share-link', '--media-actions-share-options-link-text-color', 'Share link text'],
			['media-share-copy-border', '--media-actions-share-copy-field-border-color', 'Copy field border'],
			['media-share-copy-bg', '--media-actions-share-copy-field-bg-color', 'Copy field bg'],
			['media-share-copy-text', '--media-actions-share-copy-field-input-text-color', 'Copy field text'],
			['media-more-popup-bg', '--media-actions-more-options-popup-bg-color', 'More options popup bg'],
			['media-more-popup-link', '--media-actions-more-options-popup-nav-link-text-color', 'More options link'],
			[
				'media-share-fullscreen-bg',
				'--media-actions-share-fullscreen-popup-main-bg-color',
				'Fullscreen share bg',
			],
			// Author
			['media-author-name', '--media-author-banner-name-text-color', 'Author name'],
			['media-author-date', '--media-author-banner-date-text-color', 'Author date'],
			[
				'media-author-cancel',
				'--media-author-actions-popup-bottom-cancel-removal-button-text-color',
				'Author cancel text',
			],
			[
				'media-author-cancel-hover',
				'--media-author-actions-popup-bottom-cancel-removal-button-hover-text-color',
				'Author cancel hover',
			],
			[
				'media-author-cancel-icon-hover',
				'--media-author-actions-popup-bottom-cancel-removal-button-hover-icon-text-color',
				'Author cancel icon hover',
			],
			// Content & Status
			['media-content-border', '--media-content-banner-border-color', 'Content border'],
			['media-status', '--media-status-info-item-text-color', 'Status text'],
			// Embed
			['embed-border', '--share-embed-inner-on-right-border-color', 'Embed border'],
			['embed-title', '--share-embed-inner-on-right-ttl-text-color', 'Embed title'],
			['embed-icon', '--share-embed-inner-on-right-icon-text-color', 'Embed icon'],
			['embed-textarea-text', '--share-embed-inner-textarea-text-color', 'Embed textarea text'],
			['embed-textarea-border', '--share-embed-inner-textarea-border-color', 'Embed textarea border'],
			['embed-textarea-bg', '--share-embed-inner-textarea-bg-color', 'Embed textarea bg'],
			['embed-wrap-icon', '--share-embed-inner-embed-wrap-iconn-text-color', 'Embed wrap icon'],
		],
	},
	{
		id: 'viewer-sidebar',
		title: 'Viewer Sidebar',
		group: 'component',
		description: 'Video viewer sidebar — autoplay controls and labels.',
		display: 'table',
		tokens: [
			['viewer-autoplay-border', '--viewer-sidebar-auto-play-border-bottom-color', 'Autoplay divider'],
			['viewer-autoplay-label', '--viewer-sidebar-auto-play-next-label-text-color', 'Autoplay label'],
			['viewer-autoplay-option', '--viewer-sidebar-auto-play-option-text-color', 'Autoplay option text'],
		],
	},
	{
		id: 'user-forms',
		title: 'User & Report Forms',
		group: 'component',
		description: 'Login/MFA forms and report submission forms.',
		display: 'table',
		tokens: [
			['user-form-bg', '--user-action-form-inner-bg-color', 'Form background'],
			['user-form-title-border', '--user-action-form-inner-title-border-bottom-color', 'Form title border'],
			['user-form-input-border', '--user-action-form-inner-input-border-color', 'Form input border'],
			['user-form-input-text', '--user-action-form-inner-input-text-color', 'Form input text'],
			['user-form-input-bg', '--user-action-form-inner-input-bg-color', 'Form input bg'],
			['user-form-otp-text', '--user-action-form-inner-otp-input-text-color', 'OTP input text'],
			[
				'user-form-recovery-text',
				'--user-action-form-inner-recovery-code-input-text-color',
				'Recovery code text',
			],
			['report-title', '--report-form-title-text-color', 'Report title'],
			['report-label', '--report-form-field-label-text-color', 'Report label'],
			['report-input-text', '--report-form-field-input-text-color', 'Report input text'],
			['report-input-border', '--report-form-field-input-border-color', 'Report input border'],
			['report-input-bg', '--report-form-field-input-bg-color', 'Report input bg'],
			['report-help', '--report-form-help-text-color', 'Report help text'],
		],
	},
	{
		id: 'misc',
		title: 'Miscellaneous',
		group: 'component',
		description: 'Spinner, user thumbnail, form actions border, profile banner cancel buttons.',
		display: 'table',
		tokens: [
			['spinner', '--spinner-loader-color', 'Loading spinner'],
			['user-thumb-bg', '--logged-in-user-thumb-bg-color', 'User avatar bg'],
			['form-actions-border', '--form-actions-bottom-border-top-color', 'Form actions top border'],
			[
				'profile-banner-cancel',
				'--profile-banner-wrap-popup-bottom-cancel-removal-button-text-color',
				'Banner cancel text',
			],
			[
				'profile-banner-cancel-hover',
				'--profile-banner-wrap-popup-bottom-cancel-removal-button-hover-text-color',
				'Banner cancel hover',
			],
			[
				'profile-banner-cancel-icon-hover',
				'--profile-banner-wrap-popup-bottom-cancel-removal-button-hover-icon-text-color',
				'Banner cancel icon hover',
			],
		],
	},
];

const CORE_SECTIONS = TOKEN_SECTIONS.filter((s) => s.group === 'core');
const COMPONENT_SECTIONS = TOKEN_SECTIONS.filter((s) => s.group === 'component');
const TOTAL_TOKENS = TOKEN_SECTIONS.reduce((n, s) => n + (s.tokenCount || s.tokens?.length || 0), 0);

// ─── Utility Helpers ─────────────────────────────────────────────────────────

function formatDuration(seconds) {
	if (!seconds) return null;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateString) {
	if (!dateString) return '';
	const diff = Date.now() - new Date(dateString).getTime();
	const days = Math.floor(diff / 86400000);
	if (days < 1) return 'today';
	if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
	const years = Math.floor(months / 12);
	return `${years} year${years > 1 ? 's' : ''} ago`;
}

// ─── Media Grid ──────────────────────────────────────────────────────────────

function MediaGrid({ items }) {
	const viewMode = useDemoStore((s) => s.viewMode);

	if (!items.length) {
		return <p className="text-content-body py-8 text-center">No media found.</p>;
	}

	if (viewMode === 'list') {
		return (
			<div className="flex flex-col gap-4">
				{items.map((item) => {
					const duration = formatDuration(item.duration);
					const country = item.media_country_info?.[0]?.title;
					return (
						<a key={item.friendly_token} href={item.url} className="flex no-underline text-inherit gap-4">
							<div className="relative w-44 shrink-0">
								{item.thumbnail_url && (
									<img
										src={item.thumbnail_url}
										alt={item.title}
										className="aspect-video w-full rounded-md object-cover"
										loading="lazy"
										decoding="async"
									/>
								)}
								{duration && (
									<span className="absolute right-1 bottom-1 rounded-sm bg-black/80 px-1 py-0.5 text-[11px] font-medium tracking-wide text-white">
										{duration}
									</span>
								)}
							</div>
							<div className="min-w-0 py-0.5">
								<h3 className="line-clamp-2 text-sm font-medium leading-[18px] text-content-body">
									{item.title}
								</h3>
								<p className="mt-1 text-[13px] leading-[18px] text-brand-primary">{item.user}</p>
								<p className="mt-0.5 text-[13px] leading-[18px] text-content-body/60">
									{country && <>{country} &middot; </>}
									{item.views} view{item.views !== 1 ? 's' : ''}
									{item.add_date && <> &middot; {timeAgo(item.add_date)}</>}
								</p>
							</div>
						</a>
					);
				})}
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-3 xl:grid-cols-4">
			{items.map((item) => {
				const duration = formatDuration(item.duration);
				const country = item.media_country_info?.[0]?.title;

				return (
					<a key={item.friendly_token} href={item.url} className="block no-underline text-inherit">
						{/* Thumbnail */}
						<div className="relative overflow-hidden rounded-md">
							{item.thumbnail_url ? (
								<img
									src={item.thumbnail_url}
									alt={item.title}
									className="aspect-video w-full object-cover"
									loading="lazy"
									decoding="async"
								/>
							) : (
								<div className="aspect-video w-full bg-surface-sidebar" />
							)}
							{duration && (
								<span className="absolute right-1 bottom-1 rounded-sm bg-black/80 px-1 py-0.5 text-[11px] font-medium tracking-wide text-white">
									{duration}
								</span>
							)}
						</div>

						{/* Title — 2-line clamp like legacy */}
						<h3 className="mt-3 mb-2 line-clamp-2 text-sm font-medium leading-[18px] text-content-body">
							{item.title}
						</h3>

						{/* Author */}
						<p className="text-[13px] leading-[18px] text-brand-primary">{item.user}</p>

						{/* Meta: country · views · date */}
						<p className="text-[13px] leading-[18px] text-content-body/60">
							{country && <>{country} &middot; </>}
							{item.views} view{item.views !== 1 ? 's' : ''}
							{item.add_date && <> &middot; {timeAgo(item.add_date)}</>}
						</p>
					</a>
				);
			})}
		</div>
	);
}

// ─── Token Rendering Primitives ──────────────────────────────────────────────

function swatchColor(value) {
	return value.startsWith('--') ? `var(${value})` : value;
}

function SwatchRow({ token }) {
	const [name, cssVar, purpose] = token;
	return (
		<div className="flex items-center gap-3 py-1">
			<div
				className="h-6 w-6 shrink-0 rounded border border-border-input"
				style={{ backgroundColor: swatchColor(cssVar) }}
				title={cssVar}
			/>
			<code className="shrink-0 text-xs text-content-body">{name}</code>
			<span className="text-xs text-content-body/50">{purpose}</span>
		</div>
	);
}

function TokenTable({ tokens }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-xs">
				<thead>
					<tr className="border-b border-border-input text-content-body/50">
						<th className="w-6 pb-1 pr-2 font-medium" />
						<th className="pb-1 pr-3 font-medium">Token</th>
						<th className="pb-1 pr-3 font-medium">CSS Variable</th>
						<th className="pb-1 font-medium">Purpose</th>
					</tr>
				</thead>
				<tbody>
					{tokens.map(([name, cssVar, purpose]) => (
						<tr key={name} className="border-b border-border-input/30">
							<td className="py-1 pr-2">
								<div
									className="h-3 w-3 rounded-sm border border-border-input/50"
									style={{ backgroundColor: swatchColor(cssVar) }}
								/>
							</td>
							<td className="py-1 pr-3">
								<code className="text-content-body">{name}</code>
							</td>
							<td className="py-1 pr-3 text-content-body/50">
								<code>{cssVar}</code>
							</td>
							<td className="py-1 text-content-body/50">{purpose}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function PairsTable({ pairs }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-left text-xs">
				<thead>
					<tr className="border-b border-border-input text-content-body/50">
						<th className="pb-1 pr-3 font-medium">Purpose</th>
						<th className="pb-1 pr-3 font-medium">Token</th>
						<th className="pb-1 pr-3 font-medium" colSpan={2}>
							Light
						</th>
						<th className="pb-1 font-medium" colSpan={2}>
							Dark
						</th>
					</tr>
				</thead>
				<tbody>
					{pairs.map(([purpose, token, lightHex, darkHex], i) => (
						<tr key={i} className="border-b border-border-input/30">
							<td className="py-1.5 pr-3 text-content-body">{purpose}</td>
							<td className="py-1.5 pr-3">
								<code className="text-content-body">{token}</code>
							</td>
							<td className="w-5 py-1.5 pr-1">
								<div
									className="h-4 w-4 rounded-sm border border-border-input/50"
									style={{ backgroundColor: lightHex }}
								/>
							</td>
							<td className="py-1.5 pr-3 text-content-body/40">{lightHex}</td>
							<td className="w-5 py-1.5 pr-1">
								<div
									className="h-4 w-4 rounded-sm border border-border-input/50"
									style={{ backgroundColor: darkHex }}
								/>
							</td>
							<td className="py-1.5 text-content-body/40">{darkHex}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function TokenSection({ section, children }) {
	const tokenCount = section.tokenCount || section.tokens?.length || 0;

	return (
		<section id={section.id} className="scroll-mt-12">
			<div className="mb-3 flex items-baseline gap-3">
				<h3 className="text-base font-semibold text-content-body">{section.title}</h3>
				<span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
					{tokenCount}
				</span>
			</div>
			<p className="mb-4 text-xs text-content-body/60">{section.description}</p>

			{section.display === 'swatch' && (
				<div className="grid gap-1 sm:grid-cols-2">
					{section.tokens.map((t) => (
						<SwatchRow key={t[0]} token={t} />
					))}
				</div>
			)}

			{section.display === 'pairs' && <PairsTable pairs={section.pairs} />}

			{section.display === 'info' && (
				<div className="space-y-2">
					{section.tokens.map(([name, value, purpose]) => (
						<div key={name} className="flex items-baseline gap-3 text-xs">
							<code className="text-content-body">{name}</code>
							<span className="text-content-body/50">{value}</span>
							<span className="text-content-body/40">&mdash; {purpose}</span>
						</div>
					))}
				</div>
			)}

			{section.display === 'table' && <TokenTable tokens={section.tokens} />}

			{children}
		</section>
	);
}

function TokenNav() {
	return (
		<nav className="sticky top-0 z-10 -mx-4 mb-6 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-border-input/50 bg-surface-body px-4 py-3">
			<span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-content-body/40">Core</span>
			{CORE_SECTIONS.map((s) => (
				<a
					key={s.id}
					href={`#${s.id}`}
					className="rounded px-2 py-0.5 text-[11px] text-content-link no-underline hover:bg-brand-primary/10"
				>
					{s.title}
				</a>
			))}
			<span className="mx-1 text-content-body/20">|</span>
			<span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-content-body/40">
				Components
			</span>
			{COMPONENT_SECTIONS.map((s) => (
				<a
					key={s.id}
					href={`#${s.id}`}
					className="rounded px-2 py-0.5 text-[11px] text-content-link no-underline hover:bg-brand-primary/10"
				>
					{s.title}
				</a>
			))}
		</nav>
	);
}

function HowItWorks() {
	return (
		<div className="mb-8 rounded-lg border border-border-input bg-surface-sidebar/30 p-5">
			<h3 className="mb-3 text-sm font-semibold text-content-body">How the Token Bridge Works</h3>
			<div className="space-y-3 text-xs text-content-body/80">
				<div>
					<strong className="text-content-body">Naming pattern:</strong>{' '}
					<code className="rounded bg-surface-sidebar px-1">
						{'{utility}'}-{'{group}'}-{'{variant}'}
					</code>{' '}
					&mdash; e.g. <code className="rounded bg-surface-sidebar px-1">bg-brand-primary</code>,{' '}
					<code className="rounded bg-surface-sidebar px-1">text-content-body</code>
				</div>
				<div>
					<strong className="text-content-body">Auto dark/light:</strong> Tokens resolve CSS variables that
					change when <code className="rounded bg-surface-sidebar px-1">body.dark_theme</code> is toggled
					&mdash; no extra classes needed.
				</div>
				<div>
					<strong className="text-content-body">Bridge chain:</strong>{' '}
					<span className="inline-flex flex-wrap items-center gap-1">
						<code className="rounded bg-surface-sidebar px-1">_light_theme.scss</code>
						<span>&rarr;</span>
						<code className="rounded bg-surface-sidebar px-1">CSS var</code>
						<span>&rarr;</span>
						<code className="rounded bg-surface-sidebar px-1">tailwind.css @theme</code>
						<span>&rarr;</span>
						<code className="rounded bg-surface-sidebar px-1">Tailwind utility</code>
					</span>
				</div>
				<div>
					<strong className="text-content-body">Opacity modifier:</strong>{' '}
					<code className="rounded bg-surface-sidebar px-1">text-content-body/60</code> applies 60% opacity.
				</div>
			</div>
			<div className="mt-4">
				<h4 className="mb-2 text-xs font-semibold text-content-body">Quick Start &mdash; 5 Most Used</h4>
				<table className="w-full text-left text-xs">
					<thead>
						<tr className="border-b border-border-input text-content-body/50">
							<th className="pb-1 pr-4 font-medium">Class</th>
							<th className="pb-1 font-medium">Use for</th>
						</tr>
					</thead>
					<tbody className="text-content-body/80">
						<tr className="border-b border-border-input/30">
							<td className="py-1 pr-4">
								<code>text-content-body</code>
							</td>
							<td>Default body text</td>
						</tr>
						<tr className="border-b border-border-input/30">
							<td className="py-1 pr-4">
								<code>bg-brand-primary</code>
							</td>
							<td>Primary action buttons</td>
						</tr>
						<tr className="border-b border-border-input/30">
							<td className="py-1 pr-4">
								<code>bg-surface-body</code>
							</td>
							<td>Page backgrounds</td>
						</tr>
						<tr className="border-b border-border-input/30">
							<td className="py-1 pr-4">
								<code>border-border-input</code>
							</td>
							<td>Input/card borders</td>
						</tr>
						<tr>
							<td className="py-1 pr-4">
								<code>text-content-link</code>
							</td>
							<td>Hyperlink text</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);
}

// ─── Live Usage Recipes ──────────────────────────────────────────────────────

function ButtonRecipe() {
	return (
		<div className="mt-4 rounded border border-border-input/50 bg-surface-body p-4">
			<p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-content-body/40">Live example</p>
			<div className="flex flex-wrap gap-3">
				<button className="rounded bg-brand-primary px-4 py-2 text-sm text-btn-text hover:bg-brand-primary-hover">
					Primary Action
				</button>
				<button className="rounded border border-brand-secondary-border bg-brand-secondary px-4 py-2 text-sm text-btn-secondary-text hover:bg-brand-secondary-hover hover:text-btn-text">
					Secondary
				</button>
			</div>
		</div>
	);
}

function SurfaceRecipe() {
	return (
		<div className="mt-4 rounded border border-border-input/50 bg-surface-body p-4">
			<p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-content-body/40">
				Live example &mdash; visual hierarchy
			</p>
			<div className="flex gap-3">
				<div className="rounded border border-border-input bg-surface-body p-3 text-xs text-content-body">
					body
					<div className="mt-2 rounded bg-surface-sidebar p-3">
						sidebar
						<div className="mt-2 rounded border border-border-input bg-surface-popup p-3">popup</div>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<div className="rounded bg-surface-header p-3 text-xs text-content-body">header</div>
					<div className="rounded border border-border-input bg-surface-input p-3 text-xs text-content-input">
						input
					</div>
					<div className="rounded border border-border-input bg-surface-input-disabled p-3 text-xs text-content-body/40">
						disabled
					</div>
				</div>
			</div>
		</div>
	);
}

function ContentRecipe() {
	return (
		<div className="mt-4 rounded border border-border-input/50 bg-surface-body p-4">
			<p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-content-body/40">Live example</p>
			<p className="text-sm text-content-body">
				Regular body text with a{' '}
				<a href="#content" className="text-content-link underline">
					link
				</a>
				, <span className="text-content-error">an error</span>,{' '}
				<span className="inline-block rounded bg-content-success/10 px-1.5 py-0.5 text-xs text-content-success">
					success
				</span>{' '}
				<span className="inline-block rounded bg-content-warning/10 px-1.5 py-0.5 text-xs text-content-warning">
					warning
				</span>{' '}
				<span className="inline-block rounded bg-content-danger/10 px-1.5 py-0.5 text-xs text-content-danger">
					danger
				</span>
			</p>
		</div>
	);
}

function BorderRecipe() {
	return (
		<div className="mt-4 rounded border border-border-input/50 bg-surface-body p-4">
			<p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-content-body/40">Live example</p>
			<div className="space-y-3">
				<div>
					<hr className="border-t border-border-input" />
					<span className="text-[10px] text-content-body/40">border-input</span>
				</div>
				<div>
					<hr className="border-t border-border-hr" />
					<span className="text-[10px] text-content-body/40">border-hr</span>
				</div>
				<div>
					<hr className="border-t border-dashed border-border-dotted-outline" />
					<span className="text-[10px] text-content-body/40">border-dotted-outline</span>
				</div>
			</div>
		</div>
	);
}

function TypographyRecipe() {
	return (
		<div className="mt-4 rounded border border-border-input/50 bg-surface-body p-4">
			<p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-content-body/40">Live example</p>
			<h4 className="font-heading text-lg font-semibold text-content-body">Heading in font-heading (Facultad)</h4>
			<p className="mt-1 font-sans text-sm text-content-body">
				Body text in font-sans (Amulya) &mdash; the default for all UI elements.
			</p>
		</div>
	);
}

function SpacingRecipe() {
	return (
		<div className="mt-4 rounded border border-border-input/50 bg-surface-body p-4">
			<p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-content-body/40">
				Live values (from current theme)
			</p>
			<div className="space-y-2">
				{[
					['header-height', '--header-height'],
					['sidebar-width', '--sidebar-width'],
					['logo-height', '--default-logo-height'],
					['item-width', '--default-item-width'],
				].map(([label, cssVar]) => (
					<div key={label} className="flex items-center gap-3">
						<code className="w-28 shrink-0 text-[11px] text-content-body">{label}</code>
						<div className="h-4 rounded bg-brand-primary/20" style={{ width: `var(${cssVar}, 60px)` }} />
					</div>
				))}
			</div>
		</div>
	);
}

const RECIPES = {
	buttons: ButtonRecipe,
	surfaces: SurfaceRecipe,
	content: ContentRecipe,
	borders: BorderRecipe,
	typography: TypographyRecipe,
	spacing: SpacingRecipe,
};

// ─── Demo Page Content ───────────────────────────────────────────────────────

function DemoContent() {
	const apiUrl = useContext(ApiUrlContext);
	const site = useContext(SiteContext);

	const viewMode = useDemoStore((s) => s.viewMode);
	const searchQuery = useDemoStore((s) => s.searchQuery);
	const setViewMode = useDemoStore((s) => s.setViewMode);
	const setSearchQuery = useDemoStore((s) => s.setSearchQuery);

	// NOTE: This demo fetches only page 1 (~50 items) and filters client-side.
	// For production features, pass the search query as a server-side parameter:
	//   queryKey: ['media', { q: debouncedQuery }]
	//   queryFn: () => axios.get(apiUrl.search, { params: { q: debouncedQuery } })
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ['demo-media'],
		queryFn: async () => {
			const res = await axios.get(apiUrl.media);
			return res.data?.results ?? res.data ?? [];
		},
	});

	const filteredItems = (data || []).filter((item) => item.title?.toLowerCase().includes(searchQuery.toLowerCase()));

	return (
		<div data-modern-track className="mx-auto max-w-5xl px-4 py-6">
			<h1 className="mb-2 text-2xl font-bold text-content-body">Modern Track Demo</h1>
			<p className="mb-6 text-sm text-content-body/60">
				This page demonstrates the modern track architecture: TanStack Query for server state, Zustand for
				client state, and Tailwind CSS for styling. Built on {site.title || 'CinemataCMS'}.
			</p>

			{/* Controls */}
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<input
					type="text"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Filter by title..."
					aria-label="Filter media by title"
					className="rounded border border-border-input bg-surface-input px-3 py-1.5 text-sm text-content-input outline-none"
				/>
				<div className="flex rounded border border-border-input" role="group" aria-label="View mode">
					<button
						onClick={() => setViewMode('grid')}
						aria-pressed={viewMode === 'grid'}
						className={`border-0 px-3 py-1.5 text-xs ${viewMode === 'grid' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-body'}`}
					>
						Grid
					</button>
					<button
						onClick={() => setViewMode('list')}
						aria-pressed={viewMode === 'list'}
						className={`border-0 px-3 py-1.5 text-xs ${viewMode === 'list' ? 'bg-brand-primary text-white' : 'bg-transparent text-content-body'}`}
					>
						List
					</button>
				</div>
			</div>

			{/* Media content */}
			{isLoading && <p className="py-8 text-center text-content-body/60">Loading media...</p>}
			{isError && !data && (
				<p className="py-8 text-center text-content-error" role="alert">
					Failed to load media: {error?.message || 'Is the API running?'}
				</p>
			)}
			{data && <MediaGrid items={filteredItems} />}

			{/* ── Comprehensive Token Reference ──────────────────────────────── */}
			<div className="mt-10 rounded border border-border-input p-4">
				<div className="mb-4 flex items-baseline gap-3">
					<h2 className="font-heading text-lg font-semibold text-content-body">Token Reference</h2>
					<span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
						{TOTAL_TOKENS} tokens
					</span>
				</div>
				<p className="mb-6 text-xs text-content-body/60">
					Complete reference for the Tailwind CSS bridge. Every legacy CSS variable is mapped to a semantic
					Tailwind token. Toggle dark mode to see all colors update automatically.
				</p>

				<TokenNav />
				<HowItWorks />

				<div className="space-y-10">
					{CORE_SECTIONS.map((section) => {
						const Recipe = RECIPES[section.id];
						return (
							<TokenSection key={section.id} section={section}>
								{Recipe && <Recipe />}
							</TokenSection>
						);
					})}

					<hr className="border-t border-border-hr" />

					<div>
						<h2 className="font-heading text-base font-semibold text-content-body">Component Tokens</h2>
						<p className="mt-1 text-xs text-content-body/60">
							Component-specific tokens. Use with{' '}
							<code className="rounded bg-surface-sidebar px-1">bg-</code>,{' '}
							<code className="rounded bg-surface-sidebar px-1">text-</code>, or{' '}
							<code className="rounded bg-surface-sidebar px-1">border-</code> prefix as appropriate.
						</p>
					</div>

					{COMPONENT_SECTIONS.map((section) => (
						<TokenSection key={section.id} section={section} />
					))}
				</div>
			</div>

			{/* Comparison panel */}
			<div className="mt-10 rounded border border-border-input p-4">
				<h2 className="mb-4 text-lg font-semibold text-content-body">Architecture Comparison</h2>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="rounded bg-surface-sidebar p-3">
						<h3 className="mb-2 text-sm font-medium text-content-body">Legacy Pattern</h3>
						<pre className="overflow-x-auto text-xs text-content-body/80">
							{`// LayoutStore.js (~124 lines)
class LayoutStore extends EventEmitter {
  constructor() {
    super();
    this.state = { viewMode: 'grid' };
  }
  actions_handler(action) {
    switch(action.type) {
      case 'SET_VIEW':
        this.state.viewMode = action.mode;
        this.emit('change');
    }
  }
}
export default exportStore(
  new LayoutStore, 'actions_handler'
);`}
						</pre>
					</div>
					<div className="rounded bg-surface-sidebar p-3">
						<h3 className="mb-2 text-sm font-medium text-content-body">Modern Pattern</h3>
						<pre className="overflow-x-auto text-xs text-content-body/80">
							{`// useDemoStore.js (~10 lines)
import { create } from 'zustand';

const useDemoStore = create((set) => ({
  viewMode: 'grid',
  setViewMode: (mode) =>
    set({ viewMode: mode }),
}));

// In component:
const mode = useDemoStore(s => s.viewMode);`}
						</pre>
					</div>
				</div>
			</div>
		</div>
	);
}

class DemoErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false };
	}
	static getDerivedStateFromError() {
		return { hasError: true };
	}
	render() {
		if (this.state.hasError) {
			return <p className="py-8 text-center text-content-body">Something went wrong loading this page.</p>;
		}
		return this.props.children;
	}
}

export default function ModernDemoPage() {
	const [queryClient] = React.useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						refetchOnWindowFocus: false,
					},
				},
			})
	);

	usePage('modern-demo');

	return (
		<QueryClientProvider client={queryClient}>
			<PageLayout>
				<DemoErrorBoundary>
					<DemoContent />
				</DemoErrorBoundary>
			</PageLayout>
		</QueryClientProvider>
	);
}
