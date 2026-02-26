import React, { useEffect, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

import { useItemListLazyLoad } from './hooks/useItemListLazyLoad';

import PageStore from '../../pages/_PageStore.js';

import { PendingItemsList } from './PendingItemsList';
import { ListItem, listItemProps } from './ListItem';

import { ItemListAsync } from './ItemListAsync';

import { ItemsListHandler } from "./includes/itemLists/ItemsListHandler";

export function LazyLoadItemListSplit(props){
    props = { ...LazyLoadItemListSplit.defaults, ...props };

    const [ items, countedItems, listHandler, setListHandler, classname, onItemsCount, onItemsLoad, onWindowScroll, onDocumentVisibilityChange, itemsListWrapperRef, itemsListRef, renderBeforeListWrap, renderAfterListWrap ] = useItemListLazyLoad(props);

    const [sameCountryItems, setSameCountryItems] = useState([]);
    const [otherCountryItems, setOtherCountryItems] = useState([]);
    const [error, setError] = useState(null);
    const [userCountry, setUserCountry] = useState(null);

    // Error callback for ItemsListHandler - using useCallback to prevent recreating on every render
    const onError = useCallback((err) => {
        setError(err);
    }, []);

    // Retry function
    const handleRetry = () => {
        setError(null);
        setListHandler(new ItemsListHandler(props.pageItems, props.maxItems, props.firstItemRequestUrl, props.requestUrl, onItemsCount, onItemsLoad, onError));
    };

    // Get current user's country for comparison - only on client after mount
    useEffect(() => {
        if (typeof window !== 'undefined' && window.MediaCMS && window.MediaCMS.user) {
            setUserCountry(window.MediaCMS.user.location_country);
        }
    }, []);

    useEffect(() => {
        const handler = new ItemsListHandler(
            props.pageItems,
            props.maxItems,
            props.firstItemRequestUrl,
            props.requestUrl,
            onItemsCount,
            onItemsLoad,
            onError
        );
        setListHandler(handler);

        if (!props.forceDisableInfiniteScroll) {
            PageStore.on( 'window_scroll', onWindowScroll );
            PageStore.on( 'document_visibility_change', onDocumentVisibilityChange );

            onWindowScroll();
        }

        return () => {
            if (!props.forceDisableInfiniteScroll) {
                PageStore.removeListener( 'window_scroll', onWindowScroll );
                PageStore.removeListener( 'document_visibility_change', onDocumentVisibilityChange );
            }

            handler.cancelAll();
            setListHandler(null);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Clear error when data successfully loads
    useEffect(() => {
        if (countedItems && error) {
            setError(null);
        }
    }, [countedItems, error]);

    // Split items into same country and other country whenever items change
    useEffect(() => {
        if (!items || !items.length) {
            setSameCountryItems([]);
            setOtherCountryItems([]);
            return;
        }

        const sameCountry = [];
        const otherCountry = [];

        items.forEach(item => {
            // Check if item is from same country as current user
            const itemCountry = item.location_country;

            if (userCountry && itemCountry && userCountry === itemCountry) {
                sameCountry.push(item);
            } else {
                otherCountry.push(item);
            }
        });

        setSameCountryItems(sameCountry);
        setOtherCountryItems(otherCountry);
    }, [items, userCountry]);

    // Error state: Display error with retry button
    if (error) {
        return (
            <div className={classname.listOuter}>
                <div className="error-state">
                    <svg className="error-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>Failed to load members</h3>
                    <p>Unable to retrieve the members list. Please check your connection and try again.</p>
                    <button className="retry-button" onClick={handleRetry}>
                        Retry
                    </button>
                    <style jsx>{`
                        .error-state {
                            text-align: center;
                            padding: 4rem 2rem;
                            color: var(--body-text-color);
                        }

                        .error-icon {
                            margin-bottom: 1.5rem;
                            color: #e74c3c;
                            opacity: 0.8;
                        }

                        .error-state h3 {
                            font-size: 1.5rem;
                            color: var(--body-text-color);
                            margin-bottom: 0.5rem;
                        }

                        .error-state p {
                            font-size: 1rem;
                            color: var(--body-text-color);
                            opacity: 0.8;
                            margin-bottom: 1.5rem;
                        }

                        .retry-button {
                            padding: 0.75rem 1.5rem;
                            font-size: 1rem;
                            color: #fff;
                            background-color: var(--popup-submit-button-bg, #3498db);
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            transition: background-color 0.2s;
                        }

                        .retry-button:hover {
                            background-color: var(--popup-submit-button-bg-hover, #2980b9);
                        }

                        .retry-button:active {
                            transform: translateY(1px);
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // Loading state: Waiting for API response
    if (!countedItems) {
        return <PendingItemsList className={classname.listOuter} />;
    }

    // Empty state: No members found
    if (!items.length) {
        return (
            <div className={classname.listOuter}>
                <div className="empty-state">
                    <svg className="empty-icon" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        <line x1="23" y1="23" x2="1" y2="1"></line>
                    </svg>
                    <h3>No members found</h3>
                    <p>Try adjusting your search or filters to find more members</p>
                    <style jsx>{`
                        .empty-state {
                            text-align: center;
                            padding: 4rem 2rem;
                            color: var(--body-text-color);
                            opacity: 0.7;
                        }

                        .empty-icon {
                            margin-bottom: 1.5rem;
                            opacity: 0.5;
                        }

                        .empty-state h3 {
                            font-size: 1.5rem;
                            color: var(--body-text-color);
                            margin-bottom: 0.5rem;
                        }

                        .empty-state p {
                            font-size: 1rem;
                            color: var(--body-text-color);
                            opacity: 0.8;
                        }
                    `}</style>
                </div>
            </div>
        );
    }

    // Determine if user has a country set
    const hasUserCountry = userCountry && userCountry !== 'XX';

    return (
        <div className={classname.listOuter}>
            {renderBeforeListWrap()}

            <div ref={itemsListWrapperRef} className="items-list-wrap">
                <div ref={itemsListRef}>
                    {/* Same Country Section */}
                    {sameCountryItems.length > 0 && hasUserCountry && (
                        <div className="members-section">
                            <div className="section-header">
                                <h2>Members from Your Country</h2>
                                <p>Connect with filmmakers near you</p>
                            </div>
                            <div className={classname.list}>
                                {sameCountryItems.map((itm, index) => (
                                    <ListItem key={index} {...listItemProps(props, itm, index)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other Members Section */}
                    {otherCountryItems.length > 0 && (
                        <div className="members-section">
                            <div className="section-header">
                                <h2>{hasUserCountry ? 'Other Active Members' : 'Active Members'}</h2>
                                <p>{hasUserCountry ? 'Discover filmmakers from around the region' : 'Discover filmmakers from around the world'}</p>
                            </div>
                            <div className={classname.list}>
                                {otherCountryItems.map((itm, index) => (
                                    <ListItem key={index + sameCountryItems.length} {...listItemProps(props, itm, index + sameCountryItems.length)} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {renderAfterListWrap()}

            <style jsx>{`
                .members-section {
                    margin-bottom: 3rem;
                }

                .section-header {
                    margin: 2rem 0 1.5rem;
                }

                .section-header h2 {
                    font-size: 1.5rem;
                    color: var(--body-text-color);
                    margin-bottom: 0.25rem;
                    font-weight: 600;
                }

                .section-header p {
                    color: var(--body-text-color);
                    opacity: 0.7;
                    font-size: 0.95rem;
                }

                @media (max-width: 768px) {
                    .section-header h2 {
                        font-size: 1.25rem;
                    }

                    .section-header p {
                        font-size: 0.875rem;
                    }

                    .members-section {
                        margin-bottom: 2rem;
                    }
                }
            `}</style>
        </div>
    );
}

LazyLoadItemListSplit.propTypes = {
    ...ItemListAsync.propTypes,
};

LazyLoadItemListSplit.defaults = {
    ...ItemListAsync.defaults,
    pageItems: 2,
};
