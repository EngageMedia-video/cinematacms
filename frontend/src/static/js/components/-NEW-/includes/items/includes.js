import React from 'react';
import { format } from 'timeago.js';

import PageStore from '../../../../pages/_PageStore.js';

import { formatNumber } from '../../../../functions';
import { extractImageExtension } from '../../../../functions';
import { formatInnerLink } from '../../../../functions/formatInnerLink';

import { VideoPlayerByPageLink } from "../../VideoPlayerByPageLink.js";

export function ItemDescription(props) {
	return ('' === props.description ? null : <div className="item-description"><div>{props.description}</div></div>);
}

export function ItemMain(props) {
	return (<div className="item-main">{props.children}</div>);
}

export function ItemMainInLink(props) {
	return (<ItemMain><a className="item-content-link" href={props.link} title={props.title}>{props.children}</a></ItemMain>);
}

export function ItemTitle(props) {
	return ('' === props.title ? null : <h3><span aria-label={props.ariaLabel}>{props.title}</span></h3>);
}

export function ItemTitleLink(props) {
	return ('' === props.title ? null : <h3><a href={props.link} title={props.title}><span aria-label={props.ariaLabel}>{props.title}</span></a></h3>);
}

export function UserItemMemberSince(props) {
	return (<time key="member-since">Member for {format(new Date(props.date)).replace(" ago", "")}</time>);
}

export function TaxonomyItemMediaCount(props) {
	return (<span key="item-media-count" className="item-media-count">{' ' + props.count} media</span>);
}

export function PlaylistItemMetaDate(props) {
	return (<span className="item-meta">
		<span className="playlist-date">
			<time dateTime={props.dateTime}>{props.text}</time>
		</span>
	</span>);
}

export function MediaItemEditLink(props) {
	return (void 0 === props.link ? null : <a href={props.link} title="Edit media" className="item-edit-link">EDIT MEDIA</a>);
}

export function MediaItemThumbnailLink(props) {

	const attr = {
		key: 'item-thumb',
		href: props.link,
		title: props.title,
		tabIndex: '-1',
		'aria-hidden': true,
		className: 'item-thumb' + (!props.src ? ' no-thumb' : ''),
		style: !props.src ? null : { backgroundImage: 'url(\'' + props.src + '\')' },
	};

	return (<a {...attr}>
		{!props.src ? null : <div key="item-type-icon" className="item-type-icon"><div></div></div>}
	</a>);
}

export function UserItemThumbnailLink(props) {

	const attr = {
		key: 'item-thumb',
		href: props.link,
		title: props.title,
		tabIndex: '-1',
		'aria-hidden': true,
		className: 'item-thumb' + (!props.src ? ' no-thumb' : ''),
		style: !props.src ? null : { backgroundImage: 'url(\'' + props.src + '\')' },
	};

	return (<a {...attr}></a>);
}

export function MediaItemCategories(props) {

	if (!props.categories.length) {
		return null;
	}

	const catElems = [];
	let i = 0;
	while (i < props.categories.length) {
		catElems.push(<span key={'cat_elem_' + i}><span>{props.categories[i].title}</span></span>);
		i += 1;
	}

	return (<span className="item-categories">{catElems}</span>);
}

export function MediaItemCategoriesLinks(props) {

	if (!props.categories.length) {
		return null;
	}

	const catElems = [];
	let i = 0;
	while (i < props.categories.length) {
		catElems.push(<span key={'cat_elem_' + i}><a href={formatInnerLink(props.categories[i].url, PageStore.get('config-site').url)} title={props.categories[i].title}>{props.categories[i].title}</a></span>);
		i += 1;
	}

	return (<span className="item-categories">{catElems}</span>);
}

export function MediaItemAuthor(props) {

	return ('' === props.name ? null : <span className="item-author">
		<span>{props.name}</span>
	</span>);
}

export function MediaItemAuthorLink(props) {

	return ('' === props.name ? null : <span className="item-author">
		<a href={props.link} title={props.name}>
			<span>{props.name}</span>
		</a>
	</span>);
}

export function MediaItemMetaViews(props) {
	return (<span className="item-views">{formatNumber(props.views) + ' ' + (1 >= props.views ? 'view' : 'views')}</span>);
}

export function MediaItemMetaCountry({ countries = [] }) {
	return (countries.length > 0 && countries.map(country => <span key={country.title}>
		<span className="item-country">{country.title}</span>
		<span className="dot-divider--country">·</span>
	</span>)
	);
}

export function MediaItemMetaDate(props) {
	return (<span className="item-date"><time dateTime={props.dateTime} content={props.time}>{props.text}</time></span>);
}

export function MediaItemDuration(props) {
	return (<span className="item-duration">
		<span aria-label={props.ariaLabel} content={props.time}>{props.text}</span>
	</span>);
}

export function MediaItemVideoPreviewer(props) {

	if ('' === props.url) {
		return null
	}

	// Parse URL to handle versioned URLs with query parameters
	const url = props.url;
	if (!url) return null;  // Add check

	const urlParts = url.split('?');
	const pathPart = urlParts[0];
	const queryPart = urlParts.length > 1 ? '?' + urlParts[1] : '';

	const src = pathPart.split('.').slice(0, -1).join('.') + queryPart;
	const ext = extractImageExtension(pathPart);

	return (<span className="item-img-preview" data-src={src} data-ext={ext}></span>);
}

export function MediaItemVideoPlayer(props) {
	return (<div className="item-player-wrapper"><div className="item-player-wrapper-inner"><VideoPlayerByPageLink pageLink={props.mediaPageLink} /></div></div>);
}

export function MediaItemPlaylistIndex(props) {

	return (<div className="item-order-number">
		<div>
			<div data-order={props.index} data-id={props.media_id}>{props.inPlayback && props.index === props.activeIndex ? <i className="material-icons">play_arrow</i> : props.index}</div>
		</div>
	</div>);
}

