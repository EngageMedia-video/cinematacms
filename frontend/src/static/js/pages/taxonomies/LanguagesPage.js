import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlConsumer } from '../../contexts/ApiUrlContext';
import { Page } from '../_Page';
import PageStore from '../_PageStore.js';
import { MediaListWrapper } from '../components/MediaListWrapper';
import { LazyLoadItemListAsync } from '../../components/-NEW-/LazyLoadItemListAsync';

export class LanguagesPage extends Page {
	constructor(props) {
		super(props, 'languages-archive');
	}

	pageContent() {
		return (
			<ApiUrlConsumer>
				{(apiUrl) => (
					<MediaListWrapper title={this.props.title} className="items-list-ver">
						<LazyLoadItemListAsync
							singleLinkContent={true}
							inLanguagesList={true}
							requestUrl={apiUrl.archive.languages}
							hideAllMeta={true}
						/>
					</MediaListWrapper>
				)}
			</ApiUrlConsumer>
		);
	}
}

LanguagesPage.propTypes = {
	title: PropTypes.string.isRequired,
};

LanguagesPage.defaultProps = {
	title: 'Languages',
};
