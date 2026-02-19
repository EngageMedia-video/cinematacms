import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

import Sortable from "sortablejs";

import { usePopup } from '../../components/-NEW-/hooks/usePopup';

import UserContext from '../../contexts/UserContext';
import ApiUrlContext from '../../contexts/ApiUrlContext';

import { Page } from '../_Page';
import * as PageActions from '../_PageActions';

import * as PlaylistPageActions from './actions.js';
import PlaylistPageStore from './store.js';

import { CircleIconButton } from '../../components/-NEW-/CircleIconButton';
import { PlaylistPageMedia } from '../../components/-NEW-/PlaylistPageMedia';

import { PopupMain } from '../../components/-NEW-/Popup';

import { formatNumber, putRequest, getCSRFToken } from '../../functions';

import { MaterialIcon } from '../../components/-NEW-/MaterialIcon';
import { NavigationMenuList } from '../../components/-NEW-/NavigationMenuList';

import { PlaylistCreationForm } from '../../components/-NEW-/PlaylistCreationForm';

import { NavigationContentApp } from '../../components/-NEW-/NavigationContentApp';

import stylesheet from "../styles/PlaylistPage.scss";

function PlayAllLink(props){
	return ( ! props.media || ! props.media.length ? <span>{ props.children }</span> : <a href={ props.media[0].url + '&pl=' + props.id } title="">{ props.children }</a> );
}

function PlaylistThumb(props){

	const [ thumb, setThumb ] = useState( null );

	useEffect( () => {
		if( ! props.thumb || 'string' !== typeof props.thumb ){
			setThumb(null);
		}
		else{
			const tb = props.thumb.trim();
			setThumb( '' !== tb ? tb : null );
		}
	}, [props.thumb] );

	return ( <div className={ "playlist-thumb" + ( thumb ? '' : ' no-thumb'  ) } style={ { backgroundImage: 'url("' + thumb + '")' } }>
				<PlayAllLink id={ props.id } media={ props.media }>
					<span>
						{ thumb ? <img src={ thumb } alt="" /> : null }
						<span className="play-all">
							<span>
								<span>
									<i className="material-icons">play_arrow</i>
									<span className="play-all-label">PLAY ALL</span>
								</span>
							</span>
						</span>
					</span>
				</PlayAllLink>
			 </div> );
}

function PlaylistTitle(props){
	return (<div className="playlist-title"><h1>{ props.title }</h1></div>);
}

function PlaylistMeta(props){
	return (<div className="playlist-meta">
				<div className="playlist-videos-number">{ props.totalItems } media</div>
				{/*<div className="playlist-views">{ props.viewsCount } { 1 < formatNumber( props.viewsCount ) ? 'views' : 'view' }</div>*/}
				{ ! props.dateLabel ? null : <div className="playlist-last-update">{ props.dateLabel }</div> }
			</div>);
}

function PlaylistActions(props){

	/*function onSaveClick(){
		PlaylistPageActions.toggleSave();
	}*/

	return  ( props.loggedinUserPlaylist ? <div className="playlist-actions">
				{ /*props.loggedinUserPlaylist ? null : <CircleIconButton className="add-to-playlist" onClick={ onSaveClick } title={ props.savedPlaylist ? "Remove" : "Save playlist" }><i className="material-icons">{ this.props.savedPlaylist ? 'playlist_add_check' : 'playlist_add' }</i></CircleIconButton>*/ }
				{/*<CircleIconButton type="link" href="#" title="Shuffle play"><i className="material-icons">shuffle</i></CircleIconButton>*/}
				{ props.loggedinUserPlaylist ? <PlaylistOptions /> : null }
			</div> : null );
}

function PlaylistAuthor(props){

	return <div className="playlist-author">
				<div>
					<div className="playlist-author-thumb">
						<a href={ props.link } title={ props.name }>
							{ props.thumb ? <span style={ { backgroundImage: "url(" + props.thumb + ")" } }><img src={ props.thumb } alt="" /></span> : <span><MaterialIcon type="person" /></span> }
						</a>
					</div>
					<div className="playlist-author-name">
						<a href={ props.link } title={ props.name }>{ props.name }</a>
					</div>
					{ props.loggedinUserPlaylist ? <PlaylistEdit /> : null }
				</div>
			</div>;
}

function playlistOptionsList(){

	const items = {
		deleteMedia: {
			itemType: "open-subpage",
			text: "Delete",
			icon: "delete",
			buttonAttr: {
				className: 'change-page',
				'data-page-id': 'proceedPlaylistRemovalPopup',
			},
		}
	};

	return items;
}

function playlistOptionsPopupPages(proceedPlaylistRemoval, cancelPlaylistRemoval){

	const optionsList = playlistOptionsList();

	return {
			main: <PopupMain>
					<NavigationMenuList items={ [ optionsList.deleteMedia ] } />
				</PopupMain>,
			proceedPlaylistRemovalPopup: <PopupMain>
											<div className="popup-message">
												<span className="popup-message-title">Playlist removal</span>
												<span className="popup-message-main">You're willing to remove playlist permanently?</span>
											</div>
									  		<hr/>
											<span className="popup-message-bottom">
												<button className="button-link cancel-playlist-removal" onClick={ cancelPlaylistRemoval }>CANCEL</button>
												<button className="button-link proceed-playlist-removal" onClick={ proceedPlaylistRemoval }>PROCEED</button>
											</span>
									  	</PopupMain>,
		};
}

function PlaylistOptions(props){

	const [ popupContentRef, PopupContent, PopupTrigger ] = usePopup();

	const [ popupCurrentPage, setPopupCurrentPage ] = useState( 'main' );

	function proceedPlaylistRemoval(){
		PlaylistPageActions.removePlaylist();
		popupContentRef.current.toggle();
	}

	function cancelPlaylistRemoval(){
		popupContentRef.current.toggle();
	}

	return (<div className={ "playlist-options-wrap" + ( "main" === popupCurrentPage ? " playlist-options-main" : "") }>
				<PopupTrigger contentRef={ popupContentRef }>
					<CircleIconButton><MaterialIcon type="more_horiz" /></CircleIconButton>
				</PopupTrigger>

				<PopupContent contentRef={ popupContentRef }>
					<NavigationContentApp
						pageChangeCallback={ setPopupCurrentPage }
						initPage="main"
						focusFirstItemOnPageChange={ false }
						pages={ playlistOptionsPopupPages(proceedPlaylistRemoval, cancelPlaylistRemoval) }
						pageChangeSelector={ '.change-page' }
						pageIdSelectorAttr={ 'data-page-id' }
					/>
				</PopupContent>
			</div>);
}

function PlaylistEdit(props){

	const [ popupContentRef, PopupContent, PopupTrigger ] = usePopup();

	function onPlaylistSave(){
		// Empty for now...
	}

	function onClickExit(){
		popupContentRef.current.toggle();
	}

	function playlistUpdateCompleted( new_playlist_data ){
		PageActions.addNotification( "Playlist updated", 'playlistUpdateCompleted');
		onClickExit();
	}

	function playlistUpdateFailed(){
		PageActions.addNotification( "Playlist update failed", 'playlistUpdateFailed');
		onClickExit();
	}

	function playlistRemovalCompleted( playlistId ){
		PageActions.addNotification( "Playlist removed. Redirecting...", 'playlistDelete');
		setTimeout(function(){
			window.location.href = UserContext._currentValue.pages.playlists;
		}, 2000);
	}

	function playlistRemovalFailed(playlistId){
		PageActions.addNotification( "Playlist removal failed", 'playlistDeleteFail');
	}

	useEffect( () => {
		PlaylistPageStore.on( "playlist_update_completed", playlistUpdateCompleted );
		PlaylistPageStore.on( "playlist_update_failed", playlistUpdateFailed );
		PlaylistPageStore.on( "playlist_removal_completed", playlistRemovalCompleted );
		PlaylistPageStore.on( "playlist_removal_failed", playlistRemovalFailed );
		return () => {
			PlaylistPageStore.removeListener( "playlist_update_completed", playlistUpdateCompleted );
			PlaylistPageStore.removeListener( "playlist_update_failed", playlistUpdateFailed );
			PlaylistPageStore.removeListener( "playlist_removal_completed", playlistRemovalCompleted );
			PlaylistPageStore.removeListener( "playlist_removal_failed", playlistRemovalFailed );
		};
	}, []);

	return (<div className="edit-playlist">
				<PopupTrigger contentRef={ popupContentRef }>
					<CircleIconButton><MaterialIcon type="edit" /><span>EDIT</span></CircleIconButton>
				</PopupTrigger>

				<PopupContent contentRef={ popupContentRef }>
					<div className="popup-fullscreen">
						<PopupMain>
							<span className="popup-fullscreen-overlay"></span>
							<div className="edit-playlist-form-wrap">
								<div className="edit-playlist-popup-title">Edit playlist<CircleIconButton type="button" onClick={ onClickExit }><MaterialIcon type="close" /></CircleIconButton></div>
								{/*<PlaylistCreationForm id={ PlaylistPageStore.get('playlistId') } title={ this.state.title } description={ this.state.description } onCancel={ onClickExit } onPlaylistSave={ onPlaylistSave } />*/}
								<PlaylistCreationForm date={ (new Date).getTime() } id={ PlaylistPageStore.get('playlistId') } onCancel={ onClickExit } onPlaylistSave={ onPlaylistSave } />
							</div>
						</PopupMain>
					</div>
				</PopupContent>
			</div>);
}

export class PlaylistMediaList extends React.PureComponent {

	constructor( props ){

		super( props );

		this.state = {
			media: props.media,
		};
		this.containerRef = React.createRef();
		this.onItemsLoad = this.onItemsLoad.bind(this);
	}

	onItemsLoad(){
		if( ! this.props.loggedinUserPlaylist ){
			return;
		}

		const container = this.containerRef.current.querySelector('.items-list');

		if( ! container ){
			return;
		}

		const playlistId = this.props.id;

		function onPutMediaOrderingSuccess(response){
			// TODO: Continue here...
		}

		function onPutMediaOrderingFail(response){
			// TODO: Continue here...
		}

		// const updateMediaData = (function( newMediaArray ){
		// 	this.setState({
		// 		media: newMediaArray,
		// 	}, () => {
		// 		PlaylistPageActions.reorderedMediaInPlaylist( this.state.media );
		// 	});
		// }).bind(this);

		const getMediaArray = (function(index){
			return this.state.media[ index ];
		}).bind(this);

		const updateMediaData = (function( newMediaOrder ){

			// console.log( media );

			const newMediadata = [];
			let i = 0;
			while( i < newMediaOrder.length ){
				newMediadata.push( this.state.media[ newMediaOrder[i] ] );
				i += 1;
			}
			
			// console.log( newMediaOrder );
			// console.log( newMediadata );

			this.setState({
				media: newMediadata,
			}, () => {
				PlaylistPageActions.reorderedMediaInPlaylist( this.state.media );
			});

			// setMedia( newMediadata );
			// PlaylistPageActions.reorderedMediaInPlaylist( newMediadata );
		}).bind(this);

		/*const dragCallback = 'function' === typeof props.onDragComplete ? props.onDragComplete : null;*/

		const sortable = Sortable.create(container,{
			onStart: function(evt){
				container.classList.add('on-dragging');
			},
			onEnd: function(evt){

				// console.log( 'PRE', media );

				// console.log( this );

				const newMediadata = [];

				const newMediaOrder = [];

				const itemsOrderNumElems = container.querySelectorAll('.item-order-number div div');
				let oldOrdering, newOrdering, friendly_token;
				let i = 0;
				while( i < itemsOrderNumElems.length ){

					// oldOrdering = parseInt( itemsOrderNumElems[i].innerHTML, 10 );
					oldOrdering = parseInt( itemsOrderNumElems[i].getAttribute('data-order'), 10 );
					newOrdering = i + 1;

					// console.log( oldOrdering - 1, media[ oldOrdering - 1 ] );

					if( newOrdering !== oldOrdering ){

						friendly_token = getMediaArray( oldOrdering - 1 ).friendly_token;
						// friendly_token = itemsOrderNumElems[i].getAttribute('data-id');

						putRequest(
			                ApiUrlContext._currentValue.playlists + '/' + playlistId,
			                {
			                    type: 'ordering',
			                    ordering: newOrdering,
			                    media_friendly_token: friendly_token,
			                },
			                {
			                    headers: {
			                        'X-CSRFToken': getCSRFToken(),
			                    }
			                },
			                false,
			                onPutMediaOrderingSuccess,
			                onPutMediaOrderingFail
			            );
					}

					newMediaOrder.push( oldOrdering - 1 );

					// newMediadata[i] = getMediaArray(oldOrdering - 1);

					itemsOrderNumElems[i].setAttribute('data-order', newOrdering);
					itemsOrderNumElems[i].innerHTML = newOrdering;

					i += 1;
				}

				container.classList.remove('on-dragging');

				updateMediaData( newMediaOrder );

				// console.log( newMediadata );
				// console.log( 'POST', newMediadata );

				// setMedia( newMediadata );
				// this.media = newMediadata;

				// updateMediaData( newMediadata );

				/*if( dragCallback ){
					dragCallback();
				}*/
			},
		});
	}
	
	render(){
		return <div ref={ this.containerRef } className={ "playlist-videos-list" + ( this.props.loggedinUserPlaylist ? " draggable" : "" ) }>
					{ this.state.media.length ? 
						<PlaylistPageMedia
							itemsLoadCallback={ this.onItemsLoad }
							playlistId={ this.props.id }
							media={ this.state.media }
							hidePlaylistOptions={ ! this.props.loggedinUserPlaylist } /> : null }
				</div>;
	}
}

export class PlaylistPage extends Page {

	constructor(props){

		super(props, 'playlist-page');

		this.state = {
			thumb: PlaylistPageStore.get('thumb'),
			media: PlaylistPageStore.get('playlist-media'),
			savedPlaylist: PlaylistPageStore.get('saved-playlist'),
			loggedinUserPlaylist: PlaylistPageStore.get( 'logged-in-user-playlist' ),
			title: PlaylistPageStore.get('title'),
			description: PlaylistPageStore.get('description'),
		};

		this.onLoadPlaylistData = this.onLoadPlaylistData.bind(this);
		PlaylistPageStore.on('loaded_playlist_data', this.onLoadPlaylistData);

		/*this.onPlaylistSaveUpdate = this.onPlaylistSaveUpdate.bind(this);
		PlaylistPageStore.on('saved-updated', this.onPlaylistSaveUpdate);*/

		this.onMediaRemovedFromPlaylist = this.onMediaRemovedFromPlaylist.bind(this);
		PlaylistPageStore.on('removed_media_from_playlist', this.onMediaRemovedFromPlaylist);

		this.onMediaReorderedInPlaylist = this.onMediaReorderedInPlaylist.bind(this);
		PlaylistPageStore.on('reordered_media_in_playlist', this.onMediaReorderedInPlaylist);

		this.onCompletePlaylistUpdate = this.onCompletePlaylistUpdate.bind(this);
		PlaylistPageStore.on( "playlist_update_completed", this.onCompletePlaylistUpdate );
	}

	onCompletePlaylistUpdate(){
		this.setState({
			thumb: PlaylistPageStore.get('thumb'),
			title: PlaylistPageStore.get('title'),
			description: PlaylistPageStore.get('description'),
		});
	}

	onLoadPlaylistData(){
		this.setState({
			thumb: PlaylistPageStore.get('thumb'),
			title: PlaylistPageStore.get('title'),
			description: PlaylistPageStore.get('description'),
			media: PlaylistPageStore.get('playlist-media'),
			savedPlaylist: PlaylistPageStore.get('saved-playlist'),
			loggedinUserPlaylist: PlaylistPageStore.get( 'logged-in-user-playlist' ),
		});
	}

	componentDidMount(){
		PlaylistPageActions.loadPlaylistData();
	}

	/*onPlaylistSaveUpdate(){
		this.setState({
			savedPlaylist: PlaylistPageStore.get('saved-playlist'),
		}, () => {
			if( this.state.savedPlaylist ){
				PageActions.addNotification('Added to playlists library', 'added-to-playlists-lib');
			}
			else{
				PageActions.addNotification('Removed from playlists library', 'removed-from-playlists-lib');
			}
		});
	}*/

	onMediaRemovedFromPlaylist(){
		this.setState({
			media: PlaylistPageStore.get('playlist-media'),
			thumb: PlaylistPageStore.get('thumb'),
		});
	}

	onMediaReorderedInPlaylist(){
		this.setState({
			media: PlaylistPageStore.get('playlist-media'),
			thumb: PlaylistPageStore.get('thumb'),
		});
	}

	pageContent(){

		const playlistId = PlaylistPageStore.get('playlistId');

		if( ! playlistId ){
			return null;
		}

		return [<div key="playlistDetails" className="playlist-details">

					<PlaylistThumb id={ playlistId } thumb={ this.state.thumb } media={ this.state.media } />
					<PlaylistTitle title={ this.state.title } />
					<PlaylistMeta totalItems={ PlaylistPageStore.get('total-items') } dateLabel={ PlaylistPageStore.get('date-label') } viewsCount={ PlaylistPageStore.get('views-count') } />

					{/*'public' === PlaylistPageStore.get('visibility') ? null :
						<div className="playlist-status">
							<span>{ PlaylistPageStore.get('visibility-icon') }</span>
							<div>{ PlaylistPageStore.get('visibility') }</div>
						</div>*/}

					<PlaylistActions loggedinUserPlaylist={ this.state.loggedinUserPlaylist } savedPlaylist={ this.state.savedPlaylist }  />

					{ this.state.description ? <div className="playlist-description">{ this.state.description }</div> : null }

					<PlaylistAuthor
						name={ PlaylistPageStore.get('author-name') }
						link={ PlaylistPageStore.get('author-link') }
						thumb={ PlaylistPageStore.get('author-thumb') }
						loggedinUserPlaylist={ this.state.loggedinUserPlaylist } />

				</div>,

				<PlaylistMediaList 
					key={ "playlistMediaList_" + this.state.media.length }
					id={ playlistId }
					media={ this.state.media }
					loggedinUserPlaylist={ this.state.loggedinUserPlaylist } />
			];
	}
}
