import React from 'react';
import ReactDOM from 'react-dom';

import UserContext from '../../../contexts/UserContext';
import SiteContext from '../../../contexts/SiteContext';
import PlaylistsContext from '../../../contexts/PlaylistsContext';

import PropTypes from 'prop-types';

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

import { formatInnerLink } from '../../../functions/formatInnerLink';

function Tooltip(el){

	// const parent = el.parentNode;
	const parent = document.body;

	const tooltipElem = document.createElement('span');

	tooltipElem.innerText = el.getAttribute('data-tooltip');
	tooltipElem.setAttribute( 'class', 'tooltip' );

	el.removeAttribute('data-tooltip');

	// console.log(el);
	// console.log(tooltipElem);

	function onMouseenter(){
		const targetClientRect = el.getBoundingClientRect();
		parent.appendChild(tooltipElem);
		tooltipElem.style.top = ( targetClientRect.top - ( 0 + tooltipElem.offsetHeight ) ) + 'px';
		tooltipElem.style.left = targetClientRect.left + 'px';
		document.addEventListener( 'scroll', onScroll );
	}

	function onMouseleave(){
		parent.removeChild(tooltipElem);
		tooltipElem.style.top = '';
		tooltipElem.style.left = '';
		document.removeEventListener( 'scroll', onScroll );
	}

	function onScroll(){
		const targetClientRect = el.getBoundingClientRect();
		tooltipElem.style.top = ( targetClientRect.top - ( 0 + tooltipElem.offsetHeight ) ) + 'px';
		tooltipElem.style.left = targetClientRect.left + 'px';
	}

	el.addEventListener( 'mouseenter', onMouseenter );
	el.addEventListener( 'mouseleave', onMouseleave );
}

export default class ViewerInfoTitleBanner extends React.PureComponent {

	constructor(props){

		super(props);

		this.state = {
			likedMedia: MediaPageStore.get('user-liked-media'),
			dislikedMedia: MediaPageStore.get('user-disliked-media'),
		};

		// @note: Allow only image files to download directly.
		this.downloadLink = "video" !== MediaPageStore.get( 'media-type' ) ? formatInnerLink( MediaPageStore.get('media-original-url'), SiteContext._currentValue.url ) : null;

		this.updateStateValues = this.updateStateValues.bind(this);
	}

	componentDidMount() {
		MediaPageStore.on( "liked_media", this.updateStateValues );
		MediaPageStore.on( "unliked_media", this.updateStateValues );
		MediaPageStore.on( "disliked_media", this.updateStateValues );
		MediaPageStore.on( "undisliked_media", this.updateStateValues );

		const tooltips = document.querySelectorAll('[data-tooltip]');

		if( tooltips.length ){
			tooltips.forEach( tooltipElem => Tooltip( tooltipElem ) );
		}
	}

	updateStateValues(){
		this.setState({
			likedMedia: MediaPageStore.get('user-liked-media'),
			dislikedMedia: MediaPageStore.get('user-disliked-media'),
		});
	}

	mediaCategories( overTitle ){

		if( void 0 === this.props.categories || null === this.props.categories || ! this.props.categories.length ){
			return null;
		}

		let i = 0;
		let cats = [];
		while( i < this.props.categories.length ){
			cats.push( <span key={i}><a href={ formatInnerLink( this.props.categories[i].url, SiteContext._currentValue.url ) } title={ this.props.categories[i].title }>{ this.props.categories[i].title }</a></span> );
			i += 1;
		}

		return <div className={ "media-under-title-categories" + ( !! overTitle ? ' over-title' : '' )}>{ cats }</div>;
	}

	render(){

		const displayViews = PageStore.get('config-options').pages.media.displayViews && void 0 !== this.props.views;
		const mediaState = MediaPageStore.get('media-data').state;

		let stateTooltip = '';

		switch( mediaState ){
			case 'private':
				stateTooltip = 'The site admins have to make its access public';
				break;
			case 'unlisted':
				stateTooltip = 'The site admins have to make it appear on listings';
				break;
			case 'restricted':
				stateTooltip = 'The site admins have to make its access public';
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

				{ <span className="author-banner-date">Published on { publishedOnDate( new Date( this.props.published ) ) }</span> }

				{ displayViews ? <div className="media-views">{ formatNumber( this.props.views, true ) } { 1 >= this.props.views ? 'view' : 'views' }</div> : null }

				<div className="media-actions">
					<div>
						{ UserContext._currentValue.can.likeMedia ? <MediaLikeIcon/> : null }
						{ UserContext._currentValue.can.shareMedia ? <MediaShareButton isVideo={false} /> : null }

						{ ! UserContext._currentValue.is.anonymous && UserContext._currentValue.can.saveMedia && -1 < PlaylistsContext._currentValue.mediaTypes.indexOf( MediaPageStore.get( 'media-type' ) ) ? <MediaSaveButton/> : null }

						{ ! this.props.allowDownload || ! UserContext._currentValue.can.downloadMedia ? null : ( ! this.downloadLink ? <VideoMediaDownloadLink /> : <OtherMediaDownloadLink link={ this.downloadLink } title={ this.props.title } /> ) }

						<MediaMoreOptionsIcon allowDownload={ this.props.allowDownload } />

					</div>
				</div>
			</div>

		</div>;
	}
}

ViewerInfoTitleBanner.propTypes = {
	allowDownload: PropTypes.bool.isRequired,
};

ViewerInfoTitleBanner.defaultProps = {
	allowDownload: false,
};
