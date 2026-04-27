import React from 'react';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../contexts/ApiUrlContext';
import UserContext, { UserConsumer } from '../contexts/UserContext';

import { Page } from './_Page';
import PageStore from './_PageStore';
import { MediaListWrapper } from './components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../components/-NEW-/LazyLoadItemListAsync';

import { ProfileHistoryPage } from './ProfilePage/History';

import { addClassname } from '../functions/dom.js';

export class AnonymousHistoryPage extends Page {
	constructor(props) {
		super(props, 'history-media');

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
									requestUrl={apiUrl.user.history}
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

AnonymousHistoryPage.propTypes = {
	title: PropTypes.string.isRequired,
};

AnonymousHistoryPage.defaultProps = {
	title: PageStore.get('config-enabled').pages.history.title,
};

export class HistoryPage extends React.PureComponent {
	constructor(props) {
		super(props);
	}

	render() {
		if (UserContext._currentValue.is.anonymous || !PageStore.get('config-options').pages.profile.includeHistory) {
			return <AnonymousHistoryPage />;
		}

		addClassname(document.getElementById('page-history'), 'profile-page-history');

		window.MediaCMS.profileId = UserContext._currentValue.username;

		return <ProfileHistoryPage />;
	}
}
