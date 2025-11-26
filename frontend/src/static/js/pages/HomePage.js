import React, { useContext } from 'react';
import PropTypes from 'prop-types';

import { LinksConsumer } from '../contexts/LinksContext';
import { ApiUrlConsumer } from '../contexts/ApiUrlContext';

import { MediaMultiListWrapper } from './components/MediaMultiListWrapper';
import { MediaListRow } from './components/MediaListRow';

import { ItemListAsync } from '../components/-NEW-/ItemListAsync';
import { InlineSliderItemListAsync } from '../components/-NEW-/InlineSliderItemListAsync';

import { Page } from './_Page';
import PageStore from './_PageStore';

export class HomePage extends Page {

	constructor( props ){

		super( props, 'home' );

		this.state = {
			loadedLatest: false,
			visibleLatest: false,
			loadedFeatured: false,
			visibleFeatured: false,
			loadedRecommended: false,
			visibleRecommended: false,
		};

		this.onLoadLatest = this.onLoadLatest.bind(this);
		this.onLoadFeatured = this.onLoadFeatured.bind(this);
		this.onLoadRecommended = this.onLoadRecommended.bind(this);
	}

	onLoadLatest( length ){
		this.setState({ loadedLatest: true, visibleLatest: 0 < length });
	}

	onLoadFeatured( length ){
		this.setState({ loadedFeatured: true, visibleFeatured: 0 < length });
	}

	onLoadRecommended( length ){
		this.setState({ loadedRecommended: true, visibleRecommended: 0 < length });
	}

	pageContent(){
		return <LinksConsumer>
				{ links =>
					<ApiUrlConsumer>
					{ apiUrl =>
						<MediaMultiListWrapper className="items-list-ver">

							{ ! PageStore.get('config-enabled').pages.featured || ! PageStore.get('config-enabled').pages.featured.enabled || ( this.state.loadedFeatured && ! this.state.visibleFeatured ) ? null :
								<MediaListRow title={ this.props.featured_title } style={ ! this.state.visibleFeatured ? { display: 'none' } : null } viewAllLink={ this.props.featured_view_all_link ? links.featured : null }>
									{ this.props.featured_hero_player ?
										<ItemListAsync
											firstItemViewer={ true }
											pageItems={ 20 }
											maxItems={ 20 }
											className="feat-first-item"
											requestUrl={ apiUrl.featured }
											itemsCountCallback={ this.onLoadFeatured }
											hideViews={ ! PageStore.get('config-media-item').displayViews }
											hideAuthor={ ! PageStore.get('config-media-item').displayAuthor }
											hideDate={ ! PageStore.get('config-media-item').displayPublishDate } /> :
										<InlineSliderItemListAsync
											requestUrl={ apiUrl.featured }
											itemsCountCallback={ this.onLoadFeatured }
											hideViews={ ! PageStore.get('config-media-item').displayViews }
											hideAuthor={ ! PageStore.get('config-media-item').displayAuthor }
											hideDate={ ! PageStore.get('config-media-item').displayPublishDate } /> }
								</MediaListRow> }

							{ ! PageStore.get('config-enabled').pages.recommended || ! PageStore.get('config-enabled').pages.recommended.enabled || ( this.state.loadedRecommended && ! this.state.visibleRecommended ) ? null :
								<MediaListRow title={ this.props.recommended_title } style={ ! this.state.visibleRecommended ? { display: 'none' } : null } viewAllLink={ this.props.recommended_view_all_link ? links.recommended : null }>
									<InlineSliderItemListAsync
										requestUrl={ apiUrl.recommended }
										itemsCountCallback={ this.onLoadRecommended }
										hideViews={ ! PageStore.get('config-media-item').displayViews }
										hideAuthor={ ! PageStore.get('config-media-item').displayAuthor }
										hideDate={ ! PageStore.get('config-media-item').displayPublishDate } />
								</MediaListRow> }

							{ this.state.loadedLatest && ! this.state.visibleLatest ? null :
								<MediaListRow title={ this.props.latest_title } style={ ! this.state.visibleLatest ? { display: 'none' } : null } viewAllLink={ this.props.latest_view_all_link ? links.latest : null }>
									<ItemListAsync
										pageItems={ 20 }
										maxItems={ 20 }
										requestUrl={ apiUrl.media }
										itemsCountCallback={ this.onLoadLatest }
										hideViews={ ! PageStore.get('config-media-item').displayViews }
										hideAuthor={ ! PageStore.get('config-media-item').displayAuthor }
										hideDate={ ! PageStore.get('config-media-item').displayPublishDate } />
								</MediaListRow> }

						</MediaMultiListWrapper>
					}
					</ApiUrlConsumer>
				}
				</LinksConsumer>;
	}
}

HomePage.propTypes = {
	latest_title: PropTypes.string.isRequired,
	featured_title: PropTypes.string.isRequired,
	recommended_title: PropTypes.string.isRequired,
	latest_view_all_link: PropTypes.bool.isRequired,
	featured_view_all_link: PropTypes.bool.isRequired,
	recommended_view_all_link: PropTypes.bool.isRequired,
	featured_hero_player: PropTypes.bool.isRequired,
};

HomePage.defaultProps = {
	featured_title: PageStore.get('config-options').pages.home.sections.featured.title,
	recommended_title: PageStore.get('config-options').pages.home.sections.recommended.title,
	latest_title: PageStore.get('config-options').pages.home.sections.latest.title,
	latest_view_all_link: false,
	featured_view_all_link: true,
	recommended_view_all_link: true,
	featured_hero_player: false,
};
