import React, { useEffect } from 'react';
import PropTypes from 'prop-types';

import { useItemListLazyLoad } from './hooks/useItemListLazyLoad';

import PageStore from '../../pages/_PageStore.js';

import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from './ListItem';

import { ItemListAsync } from './ItemListAsync';

import { ItemsListHandler } from "./includes/itemLists/ItemsListHandler";
import { MediaListWrapper } from '../../pages/components/MediaListWrapper';
export function LazyLoadItemListAsync(props){
    props = { ...LazyLoadItemListAsync.defaults, ...props };

    const [ items, countedItems, listHandler, setListHandler, classname, onItemsCount, onItemsLoad, onWindowScroll, onDocumentVisibilityChange, itemsListWrapperRef, itemsListRef, renderBeforeListWrap, renderAfterListWrap ] = useItemListLazyLoad(props);

    useEffect(() => {

    	setListHandler( new ItemsListHandler( props.pageItems, props.maxItems, props.firstItemRequestUrl, props.requestUrl, onItemsCount, onItemsLoad ) );

        if (!props.forceDisableInfiniteScroll) {
            PageStore.on( 'window_scroll', onWindowScroll );
            PageStore.on( 'document_visibility_change', onDocumentVisibilityChange );

            onWindowScroll();
        }

        return () => {

            if (!props.forceDisableInfiniteScroll)
            {
                PageStore.removeListener( 'window_scroll', onWindowScroll );
                PageStore.removeListener( 'document_visibility_change', onDocumentVisibilityChange );
            }

            if( listHandler ){
                listHandler.cancelAll();
                setListHandler(null);
            }
        };
    }, []);

    return ( ! countedItems ?
            <PendingItemsList className={ classname.listOuter } /> :
            ( ! items.length ? null : <div className={ classname.listOuter }>

                { renderBeforeListWrap() }

                <div ref={ itemsListWrapperRef } className="items-list-wrap">
                    <div ref={ itemsListRef } className={ classname.list }>

                        { items.map( ( itm, index ) => {
                            
                            if(props.headingText === 'Recent videos' && index === 0) {
                                return (
                                    <section className="hw-recent-videos-section" key={index}>
                                        <h1>{props.headingText}</h1>
                                        <ListItem key={ index } { ...listItemProps( props, itm, index ) } />
                                    </section>)
                            }

                            if(props.firstItemViewer && index === 1) {
                                return (
                                    <section className="hw-recent-videos-section" key={index}>
                                        <h1>{props.headingText}</h1>
                                        <ListItem key={ index } { ...listItemProps( props, itm, index ) } />
                                    </section>)
                            }

                            return <ListItem key={ index } { ...listItemProps( props, itm, index ) } />

                        } ) }
                    </div>
                </div>

                { renderAfterListWrap() }

            </div> )
           );
}

LazyLoadItemListAsync.propTypes = {
    ...ItemListAsync.propTypes,
};

LazyLoadItemListAsync.defaults = {
    ...ItemListAsync.defaults,
    pageItems: 2,
};
