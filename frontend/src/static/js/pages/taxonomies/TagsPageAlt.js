import React from 'react';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { TagsPage } from './TagsPage';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class TagsPageAlt extends TagsPage {
	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver hover-overlay-title">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inTagsList={true}
							requestUrl={apiUrl.archive.tags}
							hideAllMeta={false}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}
