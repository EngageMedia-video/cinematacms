import React from 'react';

import LinksContext from '../../contexts/LinksContext';

import PageStore from '../../pages/_PageStore.js';

import { UserItem } from './UserItem';
import { PlaylistItem } from './PlaylistItem';
import { TaxonomyItem } from './TaxonomyItem';
import { MediaItem as ImageItem } from './MediaItem';
import { MediaItem as PdfItem } from './MediaItem';
import { MediaItem as AttachmentItem  } from './MediaItem';
import { MediaItemAudio as AudioItem } from './MediaItemAudio';
import { MediaItemVideo as VideoItem } from './MediaItemVideo';

function extractPlaylistId(){

    let playlistId = null;

    const getParamsString = window.location.search;

    if( '' !== getParamsString ){

        let tmp = getParamsString.split('?');

        if( 2 === tmp.length ){

            tmp = tmp[1].split('&');

            let x;

            let i = 0;
            while(i < tmp.length){

                x = tmp[i].split('=');

                if( 'pl' === x[0] ){

                    if( 2 === x.length ){
                        playlistId = x[1];
                    }

                    break;
                }

                i += 1;
            }
        }
    }

    return playlistId;
}

function itemPageLink( props, item ){

	if( props.inCategoriesList ){
		return LinksContext._currentValue.search.category + item.title.replace( " ", "%20" );
	}

	if( props.inTagsList ){
		return LinksContext._currentValue.search.tag + item.title.replace( " ", "%20" );
	}

	if( props.inTopicsList ){
		return LinksContext._currentValue.search.topic + item.title.replace( " ", "%20" );
	}

	if( props.inLanguagesList ){
		return LinksContext._currentValue.search.language + item.title.replace( " ", "%20" );
	}

	if( props.inCountriesList ){
		return LinksContext._currentValue.search.country + item.title.replace( " ", "%20" );
	}

	const playlistId = extractPlaylistId();

	if( props.inPlaylistView && playlistId ){
		return item.url + '&pl=' + playlistId;
	}

	if( void 0 !== props.playlistId && null !== props.playlistId ){
		return item.url + '&pl=' + props.playlistId;
	}

	return item.url;
}

export function listItemProps( props, item, index ){
	const isArchiveItem = props.inCategoriesList || props.inTagsList || props.inTopicsList || props.inLanguagesList || props.inCountriesList;
	const isUserItem = ! isArchiveItem && void 0 !== item.username;
	const isPlaylistItem = ! isArchiveItem && ! isUserItem && ( "playlist" === item.media_type || ( void 0 !== item.url && -1 < item.url.indexOf('playlists') ) );	// TODO: Re-check this.
	const isMediaItem = ! isArchiveItem && ! isUserItem && ! isPlaylistItem;
	const isSearchItem = 'search-results' === PageStore.get('current-page');	// TODO: Re-check this.

	const url = {
		view: itemPageLink( props, item ),
		edit: props.canEdit ? item.url.replace('view?m=', 'edit?m=') : null,
	};

	const taxonomies = {
		categories: Array.isArray( item.categories_info ) && item.categories_info.length ? item.categories_info : null,
	};

	const thumbnail = item.thumbnail_url || "";
	const previewThumbnail = item.preview_url || "";

	let type, taxonomyType, title, date, description, meta_description;

	// For user items, use name field if available, otherwise username
	if (void 0 !== item.username && 'string' === typeof item.username) {
		title = (void 0 !== item.name && 'string' === typeof item.name && item.name.trim()) ? item.name : item.username;
	} else {
		title = void 0 !== item.title && 'string' === typeof item.title ? item.title : null;
	}

	date = void 0 !== item.date_added && 'string' === typeof item.date_added ? item.date_added : ( void 0 !== item.add_date && 'string' === typeof item.add_date ? item.add_date : null );

	// description = props.preferSummary && 'string' === typeof props.summary ? props.summary.trim() : ( 'string' === typeof item.description ? item.description.trim() : null );
	// description = null === description ? description : description.replace(/(<([^>]+)>)/ig,"");

	if( isUserItem ){
		type = 'user';
	}
	else if( isPlaylistItem ){
		type = 'playlist';
	}
	else if( isMediaItem ){
		type = item.media_type;
	}

	const taxonomyPage = {
		current: false,
		type: null,
	};

	const playlistPage = {
		current: props.inPlaylistPage,
		id: props.playlistId,
		hideOptions: props.hidePlaylistOptions || false,
		hideOrderNumber: props.hidePlaylistOrderNumber || false,
	};

	const playlistPlayback = {
		current: props.inPlaylistView,
		id: props.playlistId,
		activeItem: props.playlistActiveItem || false,
		hideOrderNumber: props.hidePlaylistOrderNumber || false,
	};

	if( isArchiveItem ){

		if( props.inCategoriesList ){
			taxonomyPage.type = 'categories';
		}
		else if( props.inTagsList ){
			taxonomyPage.type = 'tags';
		}
		else if( props.inTopicsList ){
			taxonomyPage.type = 'topics';
		}
		else if( props.inLanguagesList ){
			taxonomyPage.type = 'languages';
		}
		else if( props.inCountriesList ){
			taxonomyPage.type = 'countries';
		}

		if( null !== taxonomyPage.type ){
			taxonomyPage.current = true;
		}
	}

	const author = {
		name: item.author_name || item.user,
		url: item.author_profile ? item.author_profile.replace( " ", "%20" ) : null,
	};

	const stats = {
		views: item.views || null,
	};

	const hide = {
		allMeta: props.hideAllMeta || false,
	};

	let args = {
		order: index + 1,
		type,
		title,
		date,
		// [ isSearchItem || props.inCategoriesList || 'user' === type ? 'description' : 'meta_description' ] : description,
		url,
		author,
		stats,
		thumbnail,
		taxonomyPage,
		playlistPage,
		playlistPlayback,
		canEdit: null !== url.edit,
		singleLinkContent: props.singleLinkContent || false,
		hasMediaViewer: 0 === index && 'video' === item.media_type && !! props.firstItemViewer,
		hasMediaViewerDescr: false,
		countries: item.media_country_info || [],
	};

	args.hasMediaViewerDescr = args.hasMediaViewer && !! props.firstItemDescr;

	if( ! args.hasMediaViewerDescr ){

		description = props.preferSummary && 'string' === typeof props.summary ? props.summary.trim() : ( 'string' === typeof item.description ? item.description.trim() : null );
		description = null === description ? description : description.replace(/(<([^>]+)>)/ig,"");

		if( isSearchItem || props.inCategoriesList || 'user' === type ){
			args.description = description;
		}
		else{
			args.meta_description = description;
		}
	}
	else{

		if( !! props.firstItemViewer ){
			description = 'string' === typeof props.summary ? props.summary.trim() : null ;
		}
		else{
			description = 'string' === typeof item.description ? item.description.trim() : null;
		}

		description = null === description ? description : description.replace(/(<([^>]+)>)/ig,"");

		args.description = description;

		// TODO: Continue here...
		if( props.summary ){
			meta_description = props.summary.trim();
			meta_description = null === meta_description ? meta_description : meta_description.replace(/(<([^>]+)>)/ig,"");
			args.meta_description = meta_description;
		}
	}

	if( 'video' === type ){
		args.previewThumbnail = previewThumbnail;
	}

	if( 'video' === type || 'audio' === type ){
		args.duration = item.duration;
	}

	if( ( isArchiveItem || isPlaylistItem || isUserItem ) && ! isNaN( item.media_count ) ){
		args.media_count = parseInt( item.media_count, 10 );
	}

	// Pass user-specific fields
	if( isUserItem ){
		args.username = item.username;
		args.name = item.name;
		args.location = item.location;
		args.location_country = item.location_country;
		args.is_trusted = item.is_trusted;
		args.advancedUser = item.advancedUser;
		args.is_editor = item.is_editor;
		args.is_manager = item.is_manager;
	}

	if( isMediaItem ){

		hide.date = index === 0 ? true : (props.hideDate || false);
		hide.views = index === 0 ? false : (props.hideViews || false);
		hide.author = props.hideAuthor || false;
		hide.categories = props.hideCategories || false;

		if( hide.categories ){
			taxonomies.categories = null;
		}
	}

	args = { ...args, hide, taxonomies };

	// console.log( "\n" );
	// console.log( item );
	// console.log( args );

	return args;
}

export function ListItem(props){

	let isMediaItem = false;

	const args = {
		order: props.order,
		title: props.title,
		link: props.url.view,
		thumbnail: props.thumbnail,
		publish_date: props.date,
		singleLinkContent: props.singleLinkContent,
		hasMediaViewer: props.hasMediaViewer,
		hasMediaViewerDescr: props.hasMediaViewerDescr,
		countries: props.countries,
	};

	switch( props.type ){
		case 'user':
			// Pass user-specific props
			args.username = props.username;
			args.name = props.name;
			args.location = props.location;
			args.location_country = props.location_country;
			args.is_trusted = props.is_trusted;
			args.advancedUser = props.advancedUser;
			args.media_count = props.media_count;
			args.is_editor = props.is_editor;
			args.is_manager = props.is_manager;
			break;
		case 'playlist':
			break;
		case 'video':
			isMediaItem = true;
			args.duration = props.duration;
			args.preview_thumbnail = props.previewThumbnail;
			break;
		case 'audio':
			isMediaItem = true;
			args.duration = props.duration;
			break;
		case 'image':
			isMediaItem = true;
			break;
		case 'pdf':
			isMediaItem = true;
			break;
	}

	if( void 0 !== props.description ){
		args.description = props.description;
	}

	if( void 0 !== props.meta_description ){
		args.meta_description = props.meta_description;
	}

	if( ( props.taxonomyPage.current || 'playlist' === props.type ) && ! isNaN( props.media_count ) ){
		args.media_count = props.media_count;
	}

	if( null !== props.taxonomies.categories ){
		args.categories = props.taxonomies.categories;
	}

	args.hideAllMeta = props.hide.allMeta;

	if( isMediaItem ){

		args.views = props.stats.views;

		args.author_name = props.author.name;
		args.author_link = props.author.url;

		args.hideDate = props.hide.date;
		args.hideViews = props.hide.views;
		args.hideAuthor = props.hide.author;
		args.hideCategories = props.hide.categories;
	}

	if( props.playlistPage.current || props.playlistPlayback.current ){

		args.playlistOrder = props.order;

		if( props.playlistPlayback.current ){
			args.playlist_id = props.playlistPlayback.id;
			args.playlistActiveItem = props.playlistPlayback.activeItem;
			args.hidePlaylistOrderNumber = props.playlistPlayback.hideOrderNumber;
		}
		else{
			args.playlist_id = props.playlistPage.id;
			args.hidePlaylistOptions = props.playlistPage.hideOptions;
			args.hidePlaylistOrderNumber = props.playlistPage.hideOrderNumber;
		}
	}

	if( props.canEdit ){
		args.editLink = props.url.edit;
	}

	// console.log( args );

	if( props.taxonomyPage.current ){

		switch( props.taxonomyPage.type ){
			case 'categories':
				return <TaxonomyItem {...args} type='category' />;
			case 'tags':
				return <TaxonomyItem {...args} type='tag' />;
			case 'topics':
				return <TaxonomyItem {...args} type='topic' />;
			case 'languages':
				return <TaxonomyItem {...args} type='language' />;
			case 'countries':
				return <TaxonomyItem {...args} type='country' />;
		}
	}

	switch( props.type ){
		case 'user':
			return <UserItem {...args} />;
		case 'playlist':
			return <PlaylistItem {...args} />;
		case 'video':
			return <VideoItem {...args} />;
		case 'audio':
			return <AudioItem {...args} />;
		case 'image':
			return <ImageItem {...args} type='image' />;
		case 'pdf':
			return <PdfItem {...args} type='pdf' />;
	}

	return <AttachmentItem {...args} type='attachment' />;
}
