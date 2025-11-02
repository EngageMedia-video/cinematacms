import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { useItemListInlineSlider } from './hooks/useItemListInlineSlider';
import PageStore from '../../pages/_PageStore.js';
import LayoutStore from '../../stores/LayoutStore.js';

import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from './ListItem';
import { ItemList } from './ItemList';
import { ItemsFeaturedListHandler } from './includes/itemLists/ItemsFeaturedListHandler.js';
import ArrowRightIcon from './RightCarouselArrow.js';
import ArrowLeftIcon from '../LeftCarouselArrow.js';

export function InlineSliderItemList(props) {
  const [
    items,
    countedItems,
    listHandler,
    classname,
    setListHandler,
    onItemsCount,
    onItemsLoad,
    winResizeListener,
    sidebarVisibilityChangeListener,
    itemsListWrapperRef,
    itemsListRef,
  ] = useItemListInlineSlider(props);

  const [scrollProgress, setScrollProgress] = useState(0);
  const [totalDots, setTotalDots] = useState(1);
  const [showArrows, setShowArrows] = useState(false);

  // Separate first item if using firstItemViewer
  const firstItem = props.firstItemViewer && items.length ? items[0] : null;
  const carouselItems =
    props.firstItemViewer && items.length > 1 ? items.slice(1) : props.firstItemViewer ? [] : items;

  // Initialize list handler
  useEffect(() => {
    const handler = new ItemsFeaturedListHandler(
      props.items,
      props.pageItems,
      props.maxItems,
      onItemsCount,
      onItemsLoad
    );
    setListHandler(handler);

    PageStore.on('window_resize', winResizeListener);
    LayoutStore.on('sidebar-visibility-change', sidebarVisibilityChangeListener);

    return () => {
      PageStore.removeListener('window_resize', winResizeListener);
      LayoutStore.removeListener('sidebar-visibility-change', sidebarVisibilityChangeListener);

      handler.cancelAll();
      setListHandler(null);
    };
  }, [props.items]);

  // Carousel scroll & dots
  useEffect(() => {
    const container = itemsListWrapperRef.current;
    const list = itemsListRef.current;
    if (!container || !list || !list.children.length) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const progress = Math.min(scrollLeft / (scrollWidth - clientWidth), 1);
      setScrollProgress(progress);
    };

    const updateDots = () => {
      const itemElements = Array.from(list.children).filter((el) =>
        el.classList.contains('featured-item')
      );
      if (!itemElements.length) return;

      const itemWidth = itemElements[0].offsetWidth;
      const totalVisible = Math.max(1, Math.floor(container.clientWidth / itemWidth));
      setTotalDots(Math.max(1, Math.ceil(itemElements.length / totalVisible)));
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', updateDots);

    updateDots();
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateDots);
    };
  }, [carouselItems]);


  useEffect(() => {
    if (itemsListRef.current) {
      const itemCount = itemsListRef.current.querySelectorAll('.featured-item').length;
      setShowArrows(itemCount > 3); 
    }
  }, [carouselItems]);

  // Navigation
  const handleNext = () => {
    const container = itemsListWrapperRef.current;
    const list = itemsListRef.current;
    if (!container || !list || !list.children.length) return;

    const first = Array.from(list.children).find((el) =>
      el.classList.contains('featured-item')
    );
    if (!first) return;

    const itemWidth = first.offsetWidth;
    const itemMarginRight = parseInt(getComputedStyle(first).marginRight) || 0;
    const scrollAmount = itemWidth + itemMarginRight;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    container.scrollLeft + scrollAmount >= maxScrollLeft
      ? container.scrollTo({ left: 0, behavior: 'smooth' })
      : container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const handlePrev = () => {
    const container = itemsListWrapperRef.current;
    const list = itemsListRef.current;
    if (!container || !list || !list.children.length) return;

    const first = Array.from(list.children).find((el) =>
      el.classList.contains('featured-item')
    );
    if (!first) return;

    const itemWidth = first.offsetWidth;
    const itemMarginRight = parseInt(getComputedStyle(first).marginRight) || 0;
    const scrollAmount = itemWidth + itemMarginRight;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    container.scrollLeft <= 0
      ? container.scrollTo({ left: maxScrollLeft, behavior: 'smooth' })
      : container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  };

  if (!countedItems) return <PendingItemsList className={classname.listOuter} />;
  if (!items.length) return null;

  const activeDot = Math.round(scrollProgress * (totalDots - 1));

  return (
    <div className={classname.listOuter}>
      {/* First featured item - OUTSIDE carousel */}
      {firstItem && (
        <section className="hw-featured-video-section feat-first-item">
          {props.headingText && <h1 className="hw-featured-heading">{props.headingText}</h1>}
          <ListItem
            {...listItemProps(props, firstItem, 0)}
            firstItemDescr={props.firstItemDescr ?? true}
            hideViews={props.hideViews}
            hideAuthor={props.hideAuthor}
            hideDate={props.hideDate}
          />
        </section>
      )}

      {/* Carousel - ONLY for remaining items */}
      {carouselItems.length > 0 && (
        <div className="featured-carousel">
          {showArrows && (
            <button className="featured-carousel-arrow left" onClick={handlePrev} aria-label="Previous">
              <ArrowLeftIcon />
            </button>
          )}

          <div ref={itemsListWrapperRef} className="featured-items-wrap">
            <div ref={itemsListRef} className={`${classname.list} featured-items-list`}>
              {carouselItems.map((itm, index) => (
                <div key={index} className="featured-item">
                  <ListItem {...listItemProps(props, itm, index)} />
                </div>
              ))}
            </div>
          </div>

          {showArrows && (
            <button className="featured-carousel-arrow right" onClick={handleNext} aria-label="Next">
              <ArrowRightIcon />
            </button>
          )}

          {/* Slider Dots */}
          {!props.firstItemViewer && totalDots > 1 && (
            <div className="slider-progress-dots" aria-hidden="true">
              {Array.from({ length: totalDots }).map((_, i) => (
                <div key={i} className={`slider-progress-dot ${i === activeDot ? 'active' : ''}`}></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

InlineSliderItemList.propTypes = {
  ...ItemList.propTypes,
  layout: PropTypes.oneOf(['default', 'featured']),
  firstItemViewer: PropTypes.bool,
  headingText: PropTypes.string,
  firstItemDescr: PropTypes.bool,
  hideViews: PropTypes.bool,
  hideAuthor: PropTypes.bool,
  hideDate: PropTypes.bool,
};

InlineSliderItemList.defaultProps = {
  ...ItemList.defaultProps,
  pageItems: 6,
  layout: 'featured',
  firstItemViewer: false,
};
