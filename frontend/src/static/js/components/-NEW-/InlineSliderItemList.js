import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import { useItemListInlineSlider } from './hooks/useItemListInlineSlider';
import PageStore from '../../pages/_PageStore.js';
import LayoutStore from '../../stores/LayoutStore.js';

import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from './ListItem';
import { ItemList } from './ItemList';
import { ItemsFeaturedListHandler } from './includes/itemLists/ItemsFeaturedListHandler.js';

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

  const [hasScrolled, setHasScrolled] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [totalDots, setTotalDots] = useState(1);

  // ✅ Initialize featured list handler
  useEffect(() => {
    setListHandler(
      new ItemsFeaturedListHandler(
        props.items,
        props.pageItems,
        props.maxItems,
        onItemsCount,
        onItemsLoad
      )
    );

    PageStore.on('window_resize', winResizeListener);
    LayoutStore.on('sidebar-visibility-change', sidebarVisibilityChangeListener);

    return () => {
      PageStore.removeListener('window_resize', winResizeListener);
      LayoutStore.removeListener('sidebar-visibility-change', sidebarVisibilityChangeListener);

      if (listHandler) {
        listHandler.cancelAll();
        setListHandler(null);
      }
    };
  }, []);

  // ✅ Scroll state + dot progress tracking
  useEffect(() => {
    const container = itemsListWrapperRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      const buffer = 48;
      const start = scrollLeft <= buffer / 2;
      const end = scrollLeft + clientWidth >= scrollWidth - buffer;

      setAtStart(start);
      setAtEnd(end);
      if (!start) setHasScrolled(true);

      const progress = Math.min(scrollLeft / (scrollWidth - clientWidth), 1);
      setScrollProgress(progress);
    };

    // calculate total dots based on how many groups fit in view
    const updateDots = () => {
      const itemWidth = container.querySelector('.featured-item-thumb')?.clientWidth || 372;
      const totalVisible = Math.floor(container.clientWidth / itemWidth);
      const count = Math.max(1, Math.ceil(items.length / totalVisible));
      setTotalDots(count);
    };

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', updateDots);
    updateDots();
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateDots);
    };
  }, [items]);

  const handleNext = () => {
    const container = itemsListWrapperRef.current;
    if (!container) return;
    setHasScrolled(true);
    container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
  };

  const handlePrev = () => {
    const container = itemsListWrapperRef.current;
    if (!container) return;
    container.scrollBy({ left: -container.clientWidth * 0.8, behavior: 'smooth' });
  };

  const activeDot = Math.round(scrollProgress * (totalDots - 1));

  const listOuterClass = `${classname.listOuter} featured-carousel`;

  return !countedItems ? (
    <PendingItemsList className={listOuterClass} />
  ) : !items.length ? null : (
    <div className={listOuterClass}>
      {/* Left arrow */}
      <button
        className={`featured-carousel-arrow left ${atStart ? 'disabled' : ''} ${
          !hasScrolled ? 'disabled' : ''
        }`}
        onClick={handlePrev}
        aria-label="Previous"
      >
        ‹
      </button>

      {/* Wrapper */}
      <div ref={itemsListWrapperRef} className="items-list-wrap featured-items-wrap">
        <div ref={itemsListRef} className={`${classname.list} featured-items-list`}>
          {items.map((itm, index) => (
            <div key={index} className="featured-item-thumb">
              <ListItem {...listItemProps(props, itm, index)} />
            </div>
          ))}
        </div>
      </div>

      {/* Right arrow */}
      <button
        className={`featured-carousel-arrow right ${atEnd ? 'at-end' : ''}`}
        onClick={handleNext}
        aria-label="Next"
      >
        ›
      </button>

      {/* Scroll progress dots (mobile/tablet) */}
      <div className="slider-progress-dots" aria-hidden="true">
        {Array.from({ length: totalDots }).map((_, i) => (
          <div
            key={i}
            className={`slider-progress-dot ${i === activeDot ? 'active' : ''}`}
          ></div>
        ))}
      </div>
    </div>
  );
}

InlineSliderItemList.propTypes = {
  ...ItemList.propTypes,
  layout: PropTypes.oneOf(['default', 'featured']),
};

InlineSliderItemList.defaultProps = {
  ...ItemList.defaultProps,
  pageItems: 6,
  layout: 'featured',
};
