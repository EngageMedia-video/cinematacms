import React from 'react';

import MediaPageStore from '../../../../static/js/pages/MediaPage/store.js';

import { AutoPlay } from './AutoPlay';
import { RelatedMedia } from './RelatedMedia';

import PlaylistView from './playlist-view';

export default class ViewerSidebar extends React.PureComponent {
	constructor(props) {
		super(props);

		this.state = {
			playlistData: props.playlistData,
			isPlaylistPage: !!props.playlistData,
			activeItem: 0,
			mediaType: MediaPageStore.get('media-type'),
		};

		if (props.playlistData?.playlist_media) {
			let i = 0;
			while (i < props.playlistData.playlist_media.length) {
				if (props.mediaId === props.playlistData.playlist_media[i].friendly_token) {
					this.state.activeItem = i + 1;
					break;
				}

				i += 1;
			}
		}

		this.onMediaLoad = this.onMediaLoad.bind(this);
	}

	componentDidMount() {
		MediaPageStore.on('loaded_media_data', this.onMediaLoad);
	}

	onMediaLoad() {
		this.setState({
			mediaType: MediaPageStore.get('media-type'),
		});
	}

	render() {
		return (
			<>
				{this.state.isPlaylistPage ? (
					<PlaylistView activeItem={this.state.activeItem} playlistData={this.props.playlistData} />
				) : 'video' === this.state.mediaType || 'audio' === this.state.mediaType ? (
					<AutoPlay />
				) : null}

				<RelatedMedia hideFirst={!this.state.isPlaylistPage} />
			</>
		);
	}
}
