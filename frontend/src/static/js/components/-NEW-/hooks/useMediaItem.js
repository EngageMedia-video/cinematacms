import React, { useState, useEffect } from 'react';
import { format } from 'timeago.js';

import { useItem } from './useItem';

import {
	MediaItemThumbnailLink,
	MediaItemAuthor,
	MediaItemAuthorLink,
	MediaItemMetaViews,
	MediaItemMetaDate,
	MediaItemCategories,
	MediaItemCategoriesLinks,
	MediaItemMetaCountry,
	MediaItemVideoPlayer,
	MediaItemPlaylistIndex,
	MediaItemEditLink,
} from '../includes/items';

import { formatInnerLink } from '../../../functions/formatInnerLink';

import PageStore from '../../../pages/_PageStore.js';

export function itemClassname(defaultClassname, inheritedClassname, isActiveInPlaylistPlayback) {
	let classname = defaultClassname;

	if ('' !== inheritedClassname) {
		classname += ' ' + inheritedClassname;
	}

	if (isActiveInPlaylistPlayback) {
		classname += ' pl-active-item';
	}

	return classname;
}

export function useMediaItem(props) {
	const [titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper] = useItem({ ...props });

	function editMediaComponent() {
		return <MediaItemEditLink link={props.editLink} />;
	}

	function authorComponent() {
		if (props.hideAuthor) {
			return null;
		}

		if (props.singleLinkContent) {
			return <MediaItemAuthor name={props.author_name} />;
		}

		const authorUrl =
			'' === props.author_link ? null : formatInnerLink(props.author_link, PageStore.get('config-site').url);

		return <MediaItemAuthorLink name={props.author_name} link={authorUrl} />;
	}

	function categoriesComponent() {
		if (props.singleLinkContent) {
			return <MediaItemCategories categories={props.categories} />;
		}

		return <MediaItemCategoriesLinks categories={props.categories} />;
	}

	function CountryComponent() {
		return <MediaItemMetaCountry countries={props.countries} />;
	}

	function viewsComponent() {
		return props.hideViews ? null : <MediaItemMetaViews views={props.views} />;
	}

	function dateComponent() {
		if (props.hideDate) {
			return null;
		}

		const publishDate = format(new Date(props.publish_date));
		const publishDateTime =
			'string' === typeof props.publish_date
				? Date.parse(props.publish_date)
				: Date.parse(new Date(props.publish_date));

		// console.log( props.publish_date, publishDate, publishDateTime );

		return <MediaItemMetaDate time={props.publish_date} dateTime={publishDateTime} text={publishDate} />;
	}

	function metaComponents() {
		return props.hideAllMeta ? null : (
			<span className="item-meta">
				{authorComponent()}
				{categoriesComponent()}
				<CountryComponent />
				{viewsComponent()}
				{dateComponent()}
			</span>
		);
	}

	return [titleComponent, descriptionComponent, thumbnailUrl, UnderThumbWrapper, editMediaComponent, metaComponents];
}
