import React from 'react';
import ReactDOM from 'react-dom';

import UserContext from '../../../contexts/UserContext';
import PlaylistsContext from '../../../contexts/PlaylistsContext';

import PageStore from '../../_PageStore';

import MediaPageStore from '../store.js';

import { MediaLikeIcon } from '../../../components/-NEW-/MediaLikeIcon';
import { MediaDislikeIcon } from '../../../components/-NEW-/MediaDislikeIcon';
import { OtherMediaDownloadLink } from '../../../components/-NEW-/OtherMediaDownloadLink';
import { VideoMediaDownloadLink } from '../../../components/-NEW-/VideoMediaDownloadLink';
import { MediaSaveButton } from '../../../components/-NEW-/MediaSaveButton';

import { MediaShareButton } from '../../../components/-NEW-/MediaShareButton';

import { MediaMoreOptionsIcon } from '../../../components/-NEW-/MediaMoreOptionsIcon';

import {formatNumber, publishedOnDate} from '../../../functions';

import ViewerInfoTitleBanner from "./ViewerInfoTitleBanner";

import MediaDurationInfo from '../../../classes/MediaDurationInfo';

function CountriesField({ countries }){

	let i;
	let sep;
	let ret = [];

	if( countries.length ){
		i = 0;
		sep = 1 < countries.length ? ', ' : '';
		while( i < countries.length ){
			ret[i] = <span key={i}><a href={ countries[i].url } className="media-country" title={ countries[i].title }>{ countries[i].title }</a>{ i < ( countries.length - 1 ) ? sep : '' }</span>;
			i += 1;
		}
	}

	return ret;
}

function MediaMetaField(props){
	return (<div className="media-content-languages">
		<div className="media-content-field">
			<div className="media-content-field-label"><h4>{ props.title }</h4></div>
			<div className="media-content-field-content">{ props.value }</div>
		</div>
	</div>);
}

export default class ViewerInfoVideoTitleBanner extends ViewerInfoTitleBanner {

	render(){

		const displayViews = PageStore.get('config-options').pages.media.displayViews && void 0 !== this.props.views;

		const mediaState = MediaPageStore.get('media-data').state;

		const countries = MediaPageStore.get('media-countries');

		let stateTooltip = '';

		switch( mediaState ){
			case 'private':
				stateTooltip = 'The site admins have to make its access public';
				break;
			case 'unlisted':
				stateTooltip = 'The site admins have to make it appear on listings';
				break;
		}

		return <div className="media-title-banner">

			{ displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle ? this.mediaCategories( true ) : null }

			{ void 0 !== this.props.title ? <h1>{ this.props.title }</h1> : null }

			{ 'public' !== mediaState ?
				<div className="media-labels-area">
					<div className="media-labels-area-inner">
						<span className="media-label-state"><span>{ mediaState }</span></span>
						<span className="helper-icon" data-tooltip={ stateTooltip }><i className="material-icons">help_outline</i></span>
					</div>
				</div> : null }

			<div className={ "media-views-actions" + ( this.state.likedMedia ? ' liked-media' : '' ) + ( this.state.dislikedMedia ? ' disliked-media' : '' ) }>

				{ ! displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle ? this.mediaCategories() : null }

				<div>
					{ <span className="author-banner-date">Published on { publishedOnDate( new Date( this.props.published ) ) }</span> }
					{ countries.length > 0 && <><span className="dot-divider">·</span> <CountriesField countries={countries} /></> }
				</div>

				<div className="media-actions">
					<div className="media-actions-container">

						{ displayViews ? <div className="media-views">{ formatNumber( this.props.views, true ) } { 1 >= this.props.views ? 'view' : 'views' }</div> : null }
						{ UserContext._currentValue.can.likeMedia ? <MediaLikeIcon/> : null }
						{ UserContext._currentValue.can.shareMedia ? <MediaShareButton isVideo={true} /> : null }

						{ ! UserContext._currentValue.is.anonymous && UserContext._currentValue.can.saveMedia && -1 < PlaylistsContext._currentValue.mediaTypes.indexOf( MediaPageStore.get( 'media-type' ) ) ? <MediaSaveButton/> : null }

						{ ! this.props.allowDownload || ! UserContext._currentValue.can.downloadMedia ? null : ( ! this.downloadLink ? <VideoMediaDownloadLink /> : <OtherMediaDownloadLink link={ this.downloadLink } title={ this.props.title } /> ) }

						<MediaMoreOptionsIcon allowDownload={ this.props.allowDownload } />

					</div>
				</div>
			</div>

		</div>;
	}
}
