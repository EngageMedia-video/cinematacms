import React from 'react';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../contexts/ApiUrlContext';
import UserContext, { UserConsumer } from '../contexts/UserContext';

import { Page } from './_Page';
import PageStore from './_PageStore';
import { MediaListWrapper } from './components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/-NEW-/LazyLoadItemListAsync';

import { ProfileLikedPage } from './ProfilePage/Liked';

import { addClassname } from '../functions/dom.js';

export class AnonymousLikedMediaPage extends Page {
	constructor(props) {
		super(props, 'liked-media');

		this.state = {
			resultsCount: null,
		};

		this.getCountFunc = this.getCountFunc.bind(this);
	}

	getCountFunc(resultsCount) {
		this.setState({
			resultsCount: resultsCount,
		});
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<UserConsumer>
						{(user) => (
							<MediaListWrapper
								title={
									this.props.title +
									(null !== this.state.resultsCount ? ' (' + this.state.resultsCount + ')' : '')
								}
								className="search-results-wrap items-list-hor"
							>
								<LazyLoadItemListAsync
									singleLinkContent={false}
									horizontalItemsOrientation={true}
									itemsCountCallback={this.getCountFunc}
									requestUrl={apiUrl.user.liked}
									hideViews={!PageStore.get('config-media-item').displayViews}
									hideAuthor={!PageStore.get('config-media-item').displayAuthor}
									hideDate={!PageStore.get('config-media-item').displayPublishDate}
								/>
							</MediaListWrapper>
						)}
					</UserConsumer>
				)}
			</ApiUrlConsumer>
		);
	}
}

AnonymousLikedMediaPage.propTypes = {
	title: PropTypes.string.isRequired,
};

AnonymousLikedMediaPage.defaultProps = {
	title: PageStore.get('config-enabled').pages.liked.title,
};

export class LikedMediaPage extends React.PureComponent {
	constructor(props) {
		super(props);
	}

	render() {
		if (
			UserContext._currentValue.is.anonymous ||
			!PageStore.get('config-options').pages.profile.includeLikedMedia
		) {
			return <AnonymousLikedMediaPage />;
		}

		addClassname(document.getElementById('page-liked'), 'profile-page-liked');

		window.MediaCMS.profileId = UserContext._currentValue.username;

		return <ProfileLikedPage />;
	}
}
