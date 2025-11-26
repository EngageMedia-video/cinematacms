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
     if (!window.MediaCMS) {
      console.warn('MediaCMS config not found on window');
      }
      this.mediacms_config = mediacmsConfig(window.MediaCMS || {});

    this.state = {
      featuredVideos: [],
      indexFeaturedList: [],
      loadedFeatured: false,
      visibleFeatured: false,
      loadedLatest: false,
      visibleLatest: false,
    };

    this._isMounted = false;
  }

  async fetchData(url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while loading ${url}`);
    }
    const data = await res.json();
    return Array.isArray(data) ? data : data.playlist_media || data.results || [];
  }

  async componentDidMount() {
    this._isMounted = true;
    const MAX_ITEMS = 20;
    try {
      // Load featured videos immediately (limited to 20)
      const allFeaturedVideos = await this.fetchData(this.mediacms_config.api.featured);
      const featuredVideos = allFeaturedVideos.slice(0, MAX_ITEMS);
      if (this._isMounted) {
        this.setState({ featuredVideos, loadedFeatured: true });
      }

      // Load playlist metadata
      const indexFeaturedListData = await this.fetchData(this.mediacms_config.api.indexfeatured);

      // Initialize playlists with loading state
      const initialPlaylists = indexFeaturedListData.map(playlist => ({
        ...playlist,
        items: null, // null = loading, [] = loaded empty, [...] = loaded with data
        loading: true,
      }));
      if (this._isMounted) {
        this.setState({ indexFeaturedList: initialPlaylists });
      }

      // Load each playlist's items concurrently and update state as they complete (limited to 20)
      indexFeaturedListData.forEach(async (playlist, index) => {
        if (!playlist.api_url) {
          this.updatePlaylist(index, { ...playlist, items: [], loading: false });
          return;
        }

        try {
          const allItems = await this.fetchData(playlist.api_url);
          const items = allItems.slice(0, MAX_ITEMS);
          this.updatePlaylist(index, { ...playlist, items, loading: false });
        } catch (err) {
          console.error(`❌ Failed to load videos for playlist: ${playlist.title}`, err);
          this.updatePlaylist(index, { ...playlist, items: [], loading: false });
        }
      });
    } catch (err) {
      console.error('❌ Failed to load featured playlists', err);
      if (this._isMounted) {
        this.setState({ loadedFeatured: true });
      }
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  updatePlaylist(index, updatedPlaylist) {
    if (!this._isMounted) return;
    this.setState(prevState => {
      const indexFeaturedList = [...prevState.indexFeaturedList];
      indexFeaturedList[index] = updatedPlaylist;
      return { indexFeaturedList };
    });
  }


  onLoadLatest = (length) =>
    this.setState({ loadedLatest: true, visibleLatest: length > 0 });

  onLoadFeatured = () =>
    this.setState({ loadedFeatured: true });

  pageContent() {
    const { featuredVideos, indexFeaturedList, loadedFeatured } = this.state;
    const firstFeatured = featuredVideos[0];
    const remainingFeatured = featuredVideos.slice(1);

    return (
      <ApiUrlConsumer>
        {(apiUrl) => (
          <>
            {/* 🔹 First featured video */}
            {!loadedFeatured ? (
              <PendingItemsList className="items-list-ver featured-carousel" />
            ) : firstFeatured ? (
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
              ) :
             null}

            {/* 🔹 Remaining featured videos carousel */}
            {remainingFeatured.length > 0 ? (
              <MediaMultiListWrapper className="items-list-ver featured-carousel-wrapper hw-featured-first">
                <MediaListRow
                  title="Featured by Curators"
                  viewAllLink={this.mediacms_config.url.featured}
                  viewAllText="View all"
                  className={this.props.title ? '' : 'no-title'}
                >
                  <InlineSliderItemList
                    layout="featured"
                    items={remainingFeatured}
                    pageItems={Math.min(remainingFeatured.length, 20)}
                    maxItems={Math.min(remainingFeatured.length, 20)}
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
                    <MediaListRow
                      title={item.title}
                      viewAllLink={item.url}
                      viewAllText="View all"
                      desc={item.text}
                      className={void 0 === this.props.title ? 'no-title' : ''}
                    >
                      {item.items === null || item.loading ? (
                        <PendingItemsList className="featured-carousel" />
                      ) : item.items?.length > 0 ? (
                        <InlineSliderItemList
                          headingText={item.title}
                          layout="featured"
                          items={item.items}
                          pageItems={Math.min(item.items.length, 20)}
                          maxItems={Math.min(item.items.length, 20)}
                        />
                      ) : null}
                    </MediaListRow>
                </MediaMultiListWrapper>
              ))
            ) : !loadedFeatured ? (
              <PendingItemsList className="featured-carousel" />
            ) : null}

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
                    maxItems={20}
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
