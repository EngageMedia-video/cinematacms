import React, { useEffect, useRef, useState } from 'react';
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

  const [hasScrolled, setHasScrolled] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [totalDots, setTotalDots] = useState(1);

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

    const updateDots = () => {
      if (!itemsListRef.current) return;

      // Get all direct child list items
      const itemElements = Array.from(itemsListRef.current.children).filter(
        (el) => el.nodeType === 1 // only element nodes
      );

      if (!itemElements.length) return;

      // Take width of the first item as reference
      const itemWidth = itemElements[0].clientWidth;
        if (!itemWidth) {
          return;
        }

      // Compute how many items fit in view
      const totalVisible = Math.max(1,Math.floor(itemsListWrapperRef.current.clientWidth / itemWidth));

      // Compute total scroll dots
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
  if (!container || !itemsListRef.current) return;

  const firstItem = itemsListRef.current.children[0];
  if (!firstItem) return;

  const itemWidth = firstItem.offsetWidth; // 345px
  const itemMarginRight = parseInt(getComputedStyle(firstItem).marginRight) || 0; // 27px
  const scrollAmount = itemWidth + itemMarginRight;

  setHasScrolled(true);
  container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
};

const handlePrev = () => {
  const container = itemsListWrapperRef.current;
  if (!container || !itemsListRef.current) return;

  const firstItem = itemsListRef.current.children[0];
  if (!firstItem) return;

  const itemWidth = firstItem.offsetWidth;
  const itemMarginRight = parseInt(getComputedStyle(firstItem).marginRight) || 0;
  const scrollAmount = itemWidth + itemMarginRight;

  container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
};


  const activeDot = Math.round(scrollProgress * (totalDots - 1));
  const listOuterClass = `${classname.listOuter} featured-carousel`;

  if (!countedItems) return <PendingItemsList className={listOuterClass} />;
  if (!items.length) return null;

  // 🔹 Hide arrows if only one item or first-item viewer (big featured top)
  const showArrows = !(props.firstItemViewer && items.length === 1) && items.length > 1;

  return (
    <div className={listOuterClass}>
      {/* Left arrow */}
      {showArrows && (
        <button
          className={`featured-carousel-arrow left ${atStart ? 'disabled' : ''} ${
            !hasScrolled ? 'disabled' : ''
          }`}
          onClick={handlePrev}
          aria-label="Previous"
        >
          <ArrowLeftIcon/>
        </button>
      )}

      <div ref={itemsListWrapperRef} className="featured-items-wrap">
        <div ref={itemsListRef} className={`${classname.list} featured-items-list`}>
          {items.map((itm, index) => {
            if (props.firstItemViewer && index === 0) {
              return (
                <section className="hw-featured-video-section" key={index}>
                  {props.headingText && <h1>{props.headingText}</h1>}
                    <ListItem
                      {...listItemProps(props, itm, index)}
                      firstItemDescr={props.firstItemDescr || true}
                      hideViews={props.hideViews}
                      hideAuthor={props.hideAuthor}
                      hideDate={props.hideDate}
                    />
                </section>
              );
            }

            return (
              <div
                key={index}
                className="featured-item"
              >
                <ListItem {...listItemProps(props, itm, index)} />
              </div>


            );
          })}
        </div>
      </div>

      {/* Right arrow */}
      {showArrows && (
        <button
          className={`featured-carousel-arrow right ${atEnd ? 'disabled' : ''}`}
          onClick={!atEnd ? handleNext : undefined}
          aria-label="Next"
          disabled={atEnd}
        >
          <ArrowRightIcon/>
        </button>

      )}

      {/* Scroll progress dots */}

        {!props.firstItemViewer && totalDots > 1 && (
          <div className="slider-progress-dots" aria-hidden="true">
            {Array.from({ length: totalDots }).map((_, i) => (
              <div key={i} className={`slider-progress-dot ${i === activeDot ? 'active' : ''}`}></div>
            ))}
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
};

InlineSliderItemList.defaultProps = {
  ...ItemList.defaultProps,
  pageItems: 6,
  layout: 'featured',
  firstItemViewer: false,
};
