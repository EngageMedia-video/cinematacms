import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { UserConsumer } from '../../contexts/UserContext';

import PageStore from '../_PageStore';

import { ProfilePage } from './index.js';

import { MediaListWrapper } from '../components/MediaListWrapper';

import ProfilePagesHeader from './includes/ProfilePagesHeader';
import ProfilePagesContent from './includes/ProfilePagesContent';

import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

import ProfilePageStore from './store.js';

export class ProfileMediaPage extends ProfilePage {

	constructor(props){
		super(props, 'author-media');
	}

	pageContent(){

		return [ this.state.author ? <ProfilePagesHeader key="ProfilePagesHeader" author={ this.state.author } type="videos" /> : null,
				 this.state.author ?
					<ApiUrlConsumer>
					{ apiUrl => 
						<UserConsumer>
						{ user => {
							const isMediaAuthor = ProfilePageStore.get('author-data').username === user.username;
							const isManagerOrAdmin = user.is.manager || user.is.admin;
							const canEditMedia = isMediaAuthor || isManagerOrAdmin;
							
							return (
								<ProfilePagesContent key="ProfilePagesContent">
									<MediaListWrapper title={ this.props.title } className="items-list-ver">
										<LazyLoadItemListAsync
											requestUrl={ apiUrl.media + '?author=' + this.state.author.id }
											hideAuthor={ true }
											hideViews={ ! PageStore.get('config-media-item').displayViews }
											hideDate={ ! PageStore.get('config-media-item').displayPublishDate }
											canEdit={ canEditMedia } />
									</MediaListWrapper>
								</ProfilePagesContent>
							);
						}}
						</UserConsumer>
					}
					</ApiUrlConsumer>
				: null
			];
	}
}

ProfilePage.propTypes = {
	title: PropTypes.string.isRequired,
};

ProfilePage.defaultProps = {
	title: 'Uploads',
};
