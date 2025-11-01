import React from 'react';
import PropTypes from 'prop-types';

import { ApiUrlConsumer } from '../contexts/ApiUrlContext';

import { MediaMultiListWrapper } from './components/MediaMultiListWrapper';
import { MediaListRow } from './components/MediaListRow';

import { LazyLoadItemListAsync } from '../components/-NEW-/LazyLoadItemListAsync';
import { InlineSliderItemList } from '../components/-NEW-/InlineSliderItemList.js';
import { PendingItemsList } from '../components/-NEW-/PendingItemsList.js';

import { Page } from './_Page';
import PageStore from './_PageStore';
import { config as mediacmsConfig } from '../mediacms/config.js';

export class HomeSingleFeaturedPage extends Page {
  constructor(props) {
    super(props, 'home');

    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    this.state = {
      loadedLatest: false,
      visibleLatest: false,
      loadedFeatured: false,
      visibleFeatured: false,
      loadedRecommended: false,
      visibleRecommended: false,
      indexFeaturedList: [],
      featuredVideos: [],
    };

    this.onLoadLatest = this.onLoadLatest.bind(this);
    this.onLoadFeatured = this.onLoadFeatured.bind(this);
    this.onLoadRecommended = this.onLoadRecommended.bind(this);
  }

  async componentDidMount() {
    try {
      // Fetch main featured videos
      const featuredRes = await fetch(this.mediacms_config.api.featured);
      const featuredData = await featuredRes.json();
      const featuredVideos = Array.isArray(featuredData)
        ? featuredData
        : featuredData.results || [];

      // Fetch all featured playlists
      const res = await fetch(this.mediacms_config.api.indexfeatured);
      const indexFeaturedListData = await res.json();

      const withVideos = await Promise.all(
        indexFeaturedListData.map(async (playlist) => {
          if (!playlist.api_url) return playlist;
          try {
            const videosRes = await fetch(playlist.api_url);
            const videosData = await videosRes.json();
            const videos = Array.isArray(videosData)
              ? videosData
              : videosData.results || [];
            return { ...playlist, items: videos };
          } catch (err) {
            console.error(`❌ Failed to load videos for playlist: ${playlist.title}`, err);
            return { ...playlist, items: [] };
          }
        })
      );

      this.setState({ indexFeaturedList: withVideos, featuredVideos });
    } catch (err) {
      console.error('❌ Failed to load featured playlists', err);
    }
  }

  onLoadLatest(length) {
    this.setState({ loadedLatest: true, visibleLatest: 0 < length });
  }

  onLoadFeatured(length) {

    this.setState({ loadedFeatured: true, visibleFeatured: 0 < length });
  }

  onLoadRecommended(length) {
    this.setState({ loadedRecommended: true, visibleRecommended: 0 < length });
  }

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
              <MediaMultiListWrapper className="items-list-ver ">
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
            ) : !loadedFeatured ? (
              <PendingItemsList className="featured-carousel" />
            ) : null}

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
