import React, { useState } from 'react';
import PropTypes from 'prop-types';

import PageStore from './_PageStore';
import { usePage, PageLayout } from './page';
import DemoComponent from '../components/DemoComponent';

// Import styles
import './styles/DemoPage.scss';

/**
 * DemoPage component using hook pattern instead of HOC
 */
export const DemoPage = ({ pageTitle = 'Demo Page' }) => {
  // Initialize the page
  usePage('demo');

  // Get config values if available
  const { defaultCounterValue = 0, maxCounters = 5 } =
    PageStore.get('window-MediaCMS')?.demoOptions || {};

  const [lastCountValue, setLastCountValue] = useState(defaultCounterValue);
  const [componentInstances, setComponentInstances] = useState(1);

  const handleCountChange = value => setLastCountValue(value);

  const addComponent = () =>
    setComponentInstances(prev => prev < maxCounters ? prev + 1 : prev);

  const content = (
    <div className="demo-page">
      <h1 className="demo-page__title">{pageTitle}</h1>

      <div className="demo-page__info">
        <p>This is a demo page showcasing a simple counter component.</p>
        <p>Current count from first component: <strong>{lastCountValue}</strong></p>

        <button
          className="demo-page__add-button"
          onClick={addComponent}
          disabled={componentInstances >= maxCounters}
        >
          Add Another Counter ({componentInstances}/{maxCounters})
        </button>
      </div>

      <div className="demo-page__components">
        {[...Array(componentInstances)].map((_, i) => (
          <div key={i} className="demo-page__component-wrapper">
            <DemoComponent
              initialValue={i}
              title={`Demo Counter ${i + 1}`}
              onCountChange={i === 0 ? handleCountChange : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <PageLayout>
      {content}
    </PageLayout>
  );
};

DemoPage.propTypes = {
  pageTitle: PropTypes.string
};

export default DemoPage;
