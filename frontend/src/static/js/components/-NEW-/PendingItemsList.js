import React from 'react';

import { SpinnerLoader } from './SpinnerLoader';

export function PendingItemsList(props) {
  return (
    <div className={props.className}>
      <div className="items-list-wrap items-list-wrap-waiting">
        <SpinnerLoader />
      </div>
    </div>
  );
}
