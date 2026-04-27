import React from 'react';
import ReactDOM from 'react-dom';

import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';

import PageStore from '../_PageStore';

import { ProfilePage } from './index.js';

import ProfilePageStore from './store.js';

import ProfilePagesHeader from './includes/ProfilePagesHeader';
import ProfilePagesContent from './includes/ProfilePagesContent';

import { MediaListWrapper } from '../components/MediaListWrapper';

import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class ProfilePlaylistsPage extends ProfilePage {
	constructor(props) {
		super(props, 'author-playlists');

		this.state = {
			loadedAuthor: false,
			loadedPlaylists: false,
			playlistsCount: -1,
		};

		this.getPlaylistsCountFunc = this.getPlaylistsCountFunc.bind(this);
	}

	getPlaylistsCountFunc(resultsCount) {
		this.setState({
			loadedPlaylists: true,
			playlistsCount: resultsCount,
		});
	}

	pageContent() {
		return [
			this.state.author ? (
				<ProfilePagesHeader key="ProfilePagesHeader" author={this.state.author} type="playlists" />
			) : null,
			this.state.author ? (
				<ProfilePagesContent key="ProfilePagesContent">
					<ApiUrlConsumer>
						{(apiUrl) => (
							<MediaListWrapper
								title={-1 < this.state.playlistsCount ? 'Created playlists' : void 0}
								className="profile-playlists-content items-list-ver"
							>
								<LazyLoadItemListAsync
									requestUrl={apiUrl.user.playlists + this.state.author.username}
									itemsCountCallback={this.getPlaylistsCountFunc}
									hideViews={!PageStore.get('config-media-item').displayViews}
									hideAuthor={!PageStore.get('config-media-item').displayAuthor}
									hideDate={!PageStore.get('config-media-item').displayPublishDate}
								/>
							</MediaListWrapper>
						)}
					</ApiUrlConsumer>
				</ProfilePagesContent>
			) : null,
		];
	}
}
