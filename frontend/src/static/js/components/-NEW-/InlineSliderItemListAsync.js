import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { PendingItemsList } from '../PendingItemsList';
import { ListItem } from '../ListItem';

export function InlineSliderItemListAsync({
  requestUrl,
  itemsCountCallback,
  hideViews,
  hideAuthor,
  hideDate,
  className
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const res = await fetch(requestUrl, { cache: 'no-store' }); // prevent instant cache response
        const data = await res.json();
        if (!isMounted) return;

        setItems(data.results || []);
        itemsCountCallback(data.results?.length || 0);
      } catch (error) {
        console.error('❌ InlineSliderItemListAsync fetch error:', error);
        itemsCountCallback(0);
      } finally {
        if (isMounted) {
          requestAnimationFrame(() => {
            console.log('🌀 Showing loader frame before hiding');
            setLoading(false);
          });
        }
      }
    }

    fetchData();
    return () => (isMounted = false);
  }, [requestUrl]);

  if (loading) {
    console.log('🌀 Rendering PendingItemsList loader');
    return (
      <PendingItemsList className={`featured-carousel ${className || ''}`} />
    );
  }

  if (!items.length) return null;

  return (
    <div className={`featured-carousel ${className || ''}`}>
      <div className="featured-items-wrap">
        {items.map((item) => (
          <ListItem
            key={item.id}
            item={item}
            hideViews={hideViews}
            hideAuthor={hideAuthor}
            hideDate={hideDate}
          />
        ))}
      </div>
    </div>
  );
}

InlineSliderItemListAsync.propTypes = {
  requestUrl: PropTypes.string.isRequired,
  itemsCountCallback: PropTypes.func.isRequired,
  hideViews: PropTypes.bool,
  hideAuthor: PropTypes.bool,
  hideDate: PropTypes.bool,
  className: PropTypes.string
};
