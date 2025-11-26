import React, { useState, useEffect, useCallback, useRef } from 'react';

import initItemsList from '../includes/itemLists/initItemsList';

import stylesheet from "../../styles/ItemList.scss";

export function useItemList( props, itemsListRef ){

    const previousItemsLengthRef = useRef(0);
    const itemsListInstanceRef = useRef(null);
    const lastNotifiedItemsLengthRef = useRef(0);

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

    // Notify parent when items have loaded, but guard against infinite loops
    // by only calling when items.length actually changes
    useEffect(() => {
        if (void 0 !== props.itemsLoadCallback && items.length !== lastNotifiedItemsLengthRef.current) {
            lastNotifiedItemsLengthRef.current = items.length;
            props.itemsLoadCallback();
        }
    }, [items.length, props.itemsLoadCallback]);

    return [ items, countedItems, listHandler, setListHandler, onItemsLoad, onItemsCount, addListItems ];
}