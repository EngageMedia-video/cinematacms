import React from 'react';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { LanguagesPage } from './LanguagesPage';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class LanguagesPageAlt extends LanguagesPage {
	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver hover-overlay-title">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inLanguagesList={true}
							requestUrl={apiUrl.archive.languages}
							hideAllMeta={false}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}
