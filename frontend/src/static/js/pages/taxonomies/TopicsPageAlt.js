import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import PageStore from '../_PageStore.js';
import { TopicsPage } from './TopicsPage';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class TopicsPageAlt extends TopicsPage {
	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver hover-overlay-title">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inTopicsList={true}
							requestUrl={apiUrl.archive.topics}
							hideAllMeta={false}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

TopicsPageAlt.propTypes = {
	title: PropTypes.string.isRequired,
};

TopicsPageAlt.defaultProps = {
	title: 'Topics',
};
