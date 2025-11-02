import React from 'react';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../contexts/ApiUrlContext';
import { MediaMultiListWrapper } from './components/MediaMultiListWrapper';
import { MediaListRow } from './components/MediaListRow';
import { LazyLoadItemListAsync } from '../components/-NEW-/LazyLoadItemListAsync';
import { InlineSliderItemList } from '../components/-NEW-/InlineSliderItemList';
import { PendingItemsList } from '../components/-NEW-/PendingItemsList';
import { Page } from './_Page';
import PageStore from './_PageStore';
import { config as mediacmsConfig } from '../mediacms/config';

export class HomeSingleFeaturedPage extends Page {
  constructor(props) {
    super(props, 'home');
    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    this.state = {
      featuredVideos: [],
      indexFeaturedList: [],
      loadedFeatured: false,
      visibleFeatured: false,
      loadedLatest: false,
      visibleLatest: false,
    };
  }

  async fetchData(url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while loading ${url}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.results || [];
  }

  async componentDidMount() {
    try {
      const featuredVideos = await this.fetchData(this.mediacms_config.api.featured);
      const indexFeaturedListData = await this.fetchData(this.mediacms_config.api.indexfeatured);

      const indexFeaturedList = await Promise.all(
        indexFeaturedListData.map(async (playlist) => {
          if (!playlist.api_url) return playlist;
          try {
            const items = await this.fetchData(playlist.api_url);
            return { ...playlist, items };
          } catch (err) {
            console.error(`❌ Failed to load videos for playlist: ${playlist.title}`, err);
            return { ...playlist, items: [] };
          }
        })
      );

        this.setState({
          indexFeaturedList,
          featuredVideos,
          loadedFeatured: true,
          visibleFeatured: indexFeaturedList.some(
          (playlist) => playlist?.items && playlist.items.length > 0
          ),
        });    
    } catch (err) {
      console.error('❌ Failed to load featured playlists', err);
    }
  }

  onLoadLatest = (length) =>
    this.setState({ loadedLatest: true, visibleLatest: length > 0 });

  onLoadFeatured = (length) =>
    this.setState({ loadedFeatured: true, visibleFeatured: length > 0 });

  pageContent() {
    const { featuredVideos, indexFeaturedList, loadedFeatured } = this.state;
    const firstFeatured = featuredVideos[0];
    const remainingFeatured = featuredVideos.slice(1);

    return (
      <ApiUrlConsumer>
        {(apiUrl) => (
          <>
            {/* 🔹 First featured video */}
            {firstFeatured ? (
              <MediaMultiListWrapper className="items-list-ver featured-carousel-wrapper hw-featured-first">
                <MediaListRow
                  className={'feat-first-item ' + (this.props.title ? '' : ' no-title')}
                >
                  <InlineSliderItemList
                    layout="featured"
                    items={[firstFeatured]}
                    firstItemViewer={true}
                    firstItemDescr={true}
                    pageItems={1}
                  />
                </MediaListRow>
              </MediaMultiListWrapper>
            ) : (
              <PendingItemsList className="items-list-ver featured-carousel" />
            )}

            {/* 🔹 Remaining featured videos carousel */}
            {remainingFeatured.length > 0 ? (
              <MediaMultiListWrapper className="items-list-ver featured-carousel-wrapper hw-featured-first">
                <MediaListRow
                  title="Featured by Curators"
                  viewAllLink="/videos/featured"
                  viewAllText="View all"
                  className={this.props.title ? '' : 'no-title'}
                >
                  <InlineSliderItemList
                    layout="featured"
                    items={remainingFeatured}
                    pageItems={6}
                    maxItems={8}
                    onItemsCount={this.onLoadFeatured}
                    onItemsLoad={this.onLoadFeatured}
                    firstItemViewer={false}
                  />
                </MediaListRow>
              </MediaMultiListWrapper>
            ) : featuredVideos.length === 1 ? null : (
              <PendingItemsList className="featured-carousel" />
             )}

            {/* 🔹 Other featured playlists */}
            {indexFeaturedList.length > 0 ? (
              indexFeaturedList.map((item, index) => (
                <MediaMultiListWrapper
                  key={index}
                  className={
                    'items-list-ver featured-carousel-wrapper ' +
                    (index % 2 === 0 ? 'hw-even-list' : 'hw-odd-list')
                  }
                >
                  {this.state.loadedFeatured && !this.state.visibleFeatured ? null : (
                    <MediaListRow
                      title={item.title}
                      viewAllLink={item.url}
                      viewAllText="View all"
                      desc={item.text}
                      className={void 0 === this.props.title ? 'no-title' : ''}
                    >
                      {!item.items?.length ? (
                        <PendingItemsList className="featured-carousel" />
                      ) : (
                        <InlineSliderItemList
                          headingText={item.title}
                          layout="featured"
                          items={item.items}
                          pageItems={6}
                          maxItems={8}
                          onItemsCount={this.onLoadFeatured}
                          onItemsLoad={this.onLoadFeatured}
                        />
                      )}
                    </MediaListRow>
                  )}
                </MediaMultiListWrapper>
              ))
            ) : (
              <PendingItemsList className="featured-carousel" />
            )}

            {/* 🔹 Recent videos */}
            <MediaMultiListWrapper className="items-list-ver">
              {this.state.loadedLatest && !this.state.visibleLatest ? null : (
                <MediaListRow
                  className={
                    'feat-first-item hw-most-recent-videos' +
                    (void 0 === this.props.title ? ' no-title' : '')
                  }
                >
                  <LazyLoadItemListAsync
                    headingText="Recent videos"
                    firstItemViewer={false}
                    firstItemDescr={false}
                    requestUrl={apiUrl.media}
                    itemsCountCallback={this.onLoadLatest}
                    hideViews={true}
                    hideAuthor={!PageStore.get('config-media-item').displayAuthor}
                    hideDate={!PageStore.get('config-media-item').displayPublishDate}
                    pageItems={20}
                  />
                </MediaListRow>
              )}
            </MediaMultiListWrapper>
          </>
        )}
      </ApiUrlConsumer>
    );
  }
}

HomeSingleFeaturedPage.propTypes = {
  title: PropTypes.string,
};
