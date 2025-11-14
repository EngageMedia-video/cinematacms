import React, { useState, useEffect, useRef } from 'react';
import { useItemList } from './useItemList';
import ItemsInlineSlider from "../includes/itemLists/ItemsInlineSlider";
import { addClassname, removeClassname } from '../functions/dom';

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
  const [resizeDate, setResizeDate] = useState(null);
  const [sidebarVisibilityChangeDate, setSidebarVisibilityChangeDate] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // 🟢 Loader state

  // ---- Helper classnames
  const classname = {
    list: 'items-list',
    listOuter: `items-list-outer list-inline list-slider${props.className ? ' ' + props.className : ''}`,
  };

  let resizeTimeout = null;
  let sliderRecalTimeout = null;
  let pendingChangeSlide = true;

  // ---- Event listeners
  function winResizeListener() {
    setResizeDate(new Date());
  }

  function sidebarVisibilityChangeListener() {
    setSidebarVisibilityChangeDate(new Date());
  }

  // ---- Slider initialization
  function initSlider() {
    if (!itemsListWrapperRef.current) return;
    setInlineSlider(new ItemsInlineSlider(itemsListWrapperRef.current, '.item'));
  }

  // ---- Update slider state after items load
  function updateSlider(afterItemsUpdate = false) {
    if (!inlineSlider) {
      initSlider();
      return;
    }

    inlineSlider.updateDataState(items.length, listHandler.loadedAllItems(), !afterItemsUpdate);

    if (!listHandler.loadedAllItems() && inlineSlider.loadItemsToFit()) {
      listHandler.loadItems(inlineSlider.itemsFit());
    } else {
      if (pendingChangeSlide) {
        pendingChangeSlide = false;
        inlineSlider.scrollToCurrentSlide();
      }
    }
  }

  // ---- Resize handler
  function onWinResize() {
    if (!inlineSlider) {
      updateSlider(false);
      return;
    }

    clearTimeout(resizeTimeout);
    addClassname(itemsListWrapperRef.current, 'resizing');

    inlineSlider.updateDataStateOnResize(items.length, listHandler.loadedAllItems());
    inlineSlider.scrollToCurrentSlide();

    resizeTimeout = setTimeout(() => {
      inlineSlider.updateDataStateOnResize(items.length, listHandler.loadedAllItems());
      inlineSlider.scrollToCurrentSlide();
      removeClassname(itemsListWrapperRef.current, 'resizing');
      resizeTimeout = null;
    }, 200);
  }

  // ---- Sidebar visibility change
  function onSidebarVisibilityChange() {
    clearTimeout(sliderRecalTimeout);
    sliderRecalTimeout = setTimeout(() => {
      sliderRecalTimeout = setTimeout(() => {
        sliderRecalTimeout = null;
        updateSlider();
      }, 50);
    }, 150);
  }

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

  useEffect(() => {
    if (items.length > 0) {
      updateSlider(true);
    }
  }, [items]);

  useEffect(() => {
    updateSlider(true);
  }, [inlineSlider]);

  useEffect(() => {
    onWinResize();
  }, [resizeDate]);

  useEffect(() => {
    onSidebarVisibilityChange();
  }, [sidebarVisibilityChangeDate]);

  return [
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
    isLoading // 🟢 expose loading state
  ];
}
