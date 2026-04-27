import React from 'react';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { CategoriesPage } from './CategoriesPage';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class CategoriesPageAlt extends CategoriesPage {
	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver hover-overlay-title">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inCategoriesList={true}
							requestUrl={apiUrl.archive.categories}
							hideAllMeta={false}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}
