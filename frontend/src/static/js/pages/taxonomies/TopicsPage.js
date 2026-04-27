import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { Page } from '../_Page';
import PageStore from '../_PageStore.js';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class TopicsPage extends Page {
	constructor(props) {
		super(props, 'topics-archive');
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inTopicsList={true}
							requestUrl={apiUrl.archive.topics}
							hideAllMeta={true}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

TopicsPage.propTypes = {
	title: PropTypes.string.isRequired,
};

TopicsPage.defaultProps = {
	title: 'Topics',
};
