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
  className,
  maxItems = 20
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const res = await fetch(requestUrl, { cache: 'no-store' });
        const data = await res.json();
        if (!isMounted) return;

        const parsedResults = Array.isArray(data) ? data : data.results || [];
        const limitedResults = parsedResults.slice(0, maxItems);
        setItems(limitedResults);
        itemsCountCallback(limitedResults.length);
      } catch (error) {
        console.error('❌ InlineSliderItemListAsync fetch error:', error);
        itemsCountCallback(0);
      } finally {
        if (isMounted) {
          requestAnimationFrame(() => {
            setLoading(false);
          });
        }
      }
    }

    fetchData();
    return () => (isMounted = false);
  }, [requestUrl]);

  if (loading) {

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
  className: PropTypes.string,
  maxItems: PropTypes.number
};
