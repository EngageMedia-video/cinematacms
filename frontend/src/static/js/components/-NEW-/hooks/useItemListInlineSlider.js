import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useItemList } from './useItemList';
import ItemsInlineSlider from "../includes/itemLists/ItemsInlineSlider";
import { addClassname, removeClassname } from '../functions/dom';
import { useWindowResize, useSidebarVisibility } from '../../../contexts/LayoutContext';

export function useItemListInlineSlider(props) {
  const itemsListRef = useRef(null);
  const itemsListWrapperRef = useRef(null);

  const [
    items,
    countedItems,
    listHandler,
    setListHandler,
    onItemsLoad,
    onItemsCount,
    addListItems
  ] = useItemList(props, itemsListRef);

  const [inlineSlider, setInlineSlider] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // 🟢 Loader state

  // Use refs for timeout/state that persists across renders
  const resizeTimeoutRef = useRef(null);
  const sliderRecalTimeoutRef = useRef(null);
  const pendingChangeSlideRef = useRef(true);

  // ---- Helper classnames
  const classname = {
    list: 'items-list',
    listOuter: `items-list-outer list-inline list-slider${props.className ? ' ' + props.className : ''}`,
  };

  // ---- Slider initialization
  function initSlider() {
    if (!itemsListWrapperRef.current) return;
    setInlineSlider(new ItemsInlineSlider(itemsListWrapperRef.current, '.item'));
  }

  // ---- Update slider state after items load
  const updateSlider = useCallback((afterItemsUpdate = false) => {
    if (!inlineSlider) {
      initSlider();
      return;
    }

    inlineSlider.updateDataState(items.length, listHandler?.loadedAllItems(), !afterItemsUpdate);

    if (!listHandler?.loadedAllItems() && inlineSlider.loadItemsToFit()) {
      listHandler.loadItems(inlineSlider.itemsFit());
    } else {
      if (pendingChangeSlideRef.current) {
        pendingChangeSlideRef.current = false;
        inlineSlider.scrollToCurrentSlide();
      }
    }
  }, [inlineSlider, items, listHandler]);

  // ---- Resize handler
  const onWinResize = useCallback(() => {
    if (!inlineSlider) {
      updateSlider(false);
      return;
    }

    clearTimeout(resizeTimeoutRef.current);
    addClassname(itemsListWrapperRef.current, 'resizing');

    inlineSlider.updateDataStateOnResize(items.length, listHandler?.loadedAllItems());
    inlineSlider.scrollToCurrentSlide();

    resizeTimeoutRef.current = setTimeout(() => {
      inlineSlider.updateDataStateOnResize(items.length, listHandler?.loadedAllItems());
      inlineSlider.scrollToCurrentSlide();
      removeClassname(itemsListWrapperRef.current, 'resizing');
      resizeTimeoutRef.current = null;
    }, 200);
  }, [inlineSlider, items, listHandler, updateSlider]);

  // ---- Sidebar visibility change
  const onSidebarVisibilityChange = useCallback(() => {
    clearTimeout(sliderRecalTimeoutRef.current);
    sliderRecalTimeoutRef.current = setTimeout(() => {
      sliderRecalTimeoutRef.current = null;
      updateSlider();
    }, 150);
  }, [updateSlider]);

  // ---- Subscribe to layout context events
  useWindowResize(onWinResize);
  useSidebarVisibility(onSidebarVisibilityChange);

  // ---- Cleanup timeout refs on unmount
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      if (sliderRecalTimeoutRef.current) {
        clearTimeout(sliderRecalTimeoutRef.current);
        sliderRecalTimeoutRef.current = null;
      }
      pendingChangeSlideRef.current = true;
    };
  }, []);

  // ---- Effects
  useEffect(() => {
    // 🟡 Load items async with loader state
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        await addListItems();
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, []); // only run once at mount

  // Note: Both effects below depend on updateSlider which changes when inlineSlider/items/listHandler change.
  // This may cause redundant updateSlider calls, but updateSlider is idempotent and guards against
  // unnecessary work internally. A single combined effect could reduce calls but would require
  // tracking more state to determine the trigger reason.
  useEffect(() => {
    if (items.length > 0) {
      updateSlider(true);
    }
  }, [items, updateSlider]);

  useEffect(() => {
    updateSlider(true);
  }, [inlineSlider, updateSlider]);

  return [
    items,
    countedItems,
    listHandler,
    classname,
    setListHandler,
    onItemsCount,
    onItemsLoad,
    itemsListWrapperRef,
    itemsListRef,
    isLoading // 🟢 expose loading state
  ];
}
