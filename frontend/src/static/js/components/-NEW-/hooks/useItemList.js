import React, { useState, useEffect, useCallback, useRef } from 'react';

import initItemsList from '../includes/itemLists/initItemsList';

import stylesheet from "../../styles/ItemList.scss";

export function useItemList( props, itemsListRef ){

    const previousItemsLengthRef = useRef(0);
    const itemsListInstanceRef = useRef(null);
    const lastNotifiedItemsLengthRef = useRef(0);
    const itemsLoadCallbackRef = useRef(props.itemsLoadCallback);

    const [ items, setItems ] = useState([]);

    const [ countedItems, setCountedItems ] = useState(false);
    const [ listHandler, setListHandler ] = useState(null);

    // Memoize callbacks to prevent infinite re-render loops
    const onItemsLoad = useCallback((itemsArray) => {
        setItems([...itemsArray]);
    }, []);

    const onItemsCount = useCallback((totalItems) => {
        setCountedItems(true);
        if (void 0 !== props.itemsCountCallback) {
            props.itemsCountCallback(totalItems);
        }
    }, [props.itemsCountCallback]);

    const addListItems = useCallback(() => {
        if (previousItemsLengthRef.current < items.length) {

            if (null === itemsListInstanceRef.current) {
                itemsListInstanceRef.current = initItemsList([itemsListRef.current])[0];
            }

            // TODO: Should get item elements from children components.
            const itemsElem = itemsListRef.current.querySelectorAll('.item');

            if( ! itemsElem || ! itemsElem.length ){
                return;
            }

            let i = previousItemsLengthRef.current;

            while (i < items.length) {
                itemsListInstanceRef.current.appendItems(itemsElem[i]);
                i += 1;
            }

            previousItemsLengthRef.current = items.length;
        }
    }, [items, itemsListRef]);

    // Keep callback ref updated when prop changes
    useEffect(() => {
        itemsLoadCallbackRef.current = props.itemsLoadCallback;
    }, [props.itemsLoadCallback]);

    // Notify parent when items have loaded, driven only by items.length
    // Uses ref to always call the latest callback without re-running on callback identity changes
    useEffect(() => {
        if (void 0 !== itemsLoadCallbackRef.current && items.length !== lastNotifiedItemsLengthRef.current) {
            lastNotifiedItemsLengthRef.current = items.length;
            itemsLoadCallbackRef.current();
        }
    }, [items.length]);

    return [ items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems ];
}