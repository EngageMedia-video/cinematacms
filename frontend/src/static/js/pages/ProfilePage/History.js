import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';

import PageStore from '../_PageStore';

import { ProfilePage } from './index.js';

import { MediaListWrapper } from '../components/MediaListWrapper';

import ProfilePagesHeader from './includes/ProfilePagesHeader';
import ProfilePagesContent from './includes/ProfilePagesContent';

import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

import ProfilePageStore from './store.js';

export class ProfileHistoryPage extends ProfilePage {
	constructor(props) {
		super(props, 'author-history');

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
		return [
			this.state.author ? (
				<ProfilePagesHeader key="ProfilePagesHeader" author={this.state.author} type="history" />
			) : null,
			this.state.author ? (
				<ProfilePagesContent key="ProfilePagesContent">
					<ApiUrlConsumer>
						{(apiUrl) => (
							<MediaListWrapper
								title={
									this.props.title +
									(null !== this.state.resultsCount ? ' (' + this.state.resultsCount + ')' : '')
								}
								className="items-list-ver"
							>
								<LazyLoadItemListAsync
									itemsCountCallback={this.getCountFunc}
									requestUrl={apiUrl.user.history}
									hideAuthor={!PageStore.get('config-media-item').displayAuthor}
									hideViews={!PageStore.get('config-media-item').displayViews}
									hideDate={!PageStore.get('config-media-item').displayPublishDate}
									canEdit={false}
								/>
							</MediaListWrapper>
						)}
					</ApiUrlConsumer>
				</ProfilePagesContent>
			) : null,
		];
	}
}

ProfilePage.propTypes = {
	title: PropTypes.string.isRequired,
};

ProfilePage.defaultProps = {
	title: 'My history', // TODO: Continue here...
};
