# Cinemata Frontend Development Guide

This document provides instructions for setting up and working with the Cinemata frontend codebase.

## Prerequisites

- Node.js version **20.19.1** (as specified in `.nvmrc`)
- npm or pnpm (the project uses pnpm workspace as indicated by `pnpm-workspace.yaml`)

## Project Structure

The frontend is structured as follows:

```tree
frontend/
├── build/              # Build output
├── config/             # Build configurations
├── node_modules/       # Dependencies
├── packages/           # Local packages
│   ├── media-player/   # Custom media player package
│   ├── vjs-plugin/     # Video.js plugins
│   ├── vjs-plugin-font-icons/
│   └── ejs-compiled-loader/
├── scripts/            # Helper scripts
├── src/                # Source code
│   ├── config/         # Frontend configuration
│   └── static/         # Static assets
│       ├── css/        # Stylesheets
│       ├── js/         # JavaScript files
│       │   ├── actions/
│       │   ├── classes/
│       │   ├── components/
│       │   ├── contexts/
│       │   ├── functions/
│       │   ├── mediacms/
│       │   ├── pages/
│       │   └── stores/
│       └── images/     # Image assets
└── cli.js              # Command line interface script
```

## Initial Setup

### 1. Install Dependencies for Local Packages

Before installing the main project dependencies, you need to install and build the dependencies for the local packages:

```bash
# Navigate to each package and install dependencies
cd frontend/packages/media-player
npm install
npm run build

cd ../vjs-plugin
npm install
npm run build

cd ../vjs-plugin-font-icons
npm install
npm run build

cd ../ejs-compiled-loader
npm install
npm run build

# Return to the frontend directory
cd ../../
```

> **Important**: Make sure that the `/dist` folders for all packages have their respective `.css` and `.js` files. This is necessary for the main project to work correctly.

### 2. Install Main Project Dependencies

```bash
# From the frontend directory
npm install
```

## Development

To start the development server:

```bash
npm run start
```

This will start the development server at [http://localhost:8088](http://localhost:8088).

- You can access the sitemap at [http://localhost:8088/sitemap.html](http://localhost:8088/sitemap.html)

## Building for Production

To build the project for production:

```bash
npm run build
```

This generates the production-ready files in the `build/production/` directory.

## Deploying to the Backend

After building, you need to transfer the built files to the Django backend:

Option 1: Manually copy the files from `build/production/` to the Django `static/` directory.

Option 2: Use Django's collectstatic command:

```bash
python manage.py collectstatic --noinput
# or with uv:
uv run manage.py collectstatic --noinput
```

## Technology Stack

The frontend uses:

- React 17
- Flux for state management
- Sass for styling
- webpack for building
- Custom media player built on Video.js

## Configuration

The project configuration is defined in `config/cinemata.config.js`, which references other configuration files in the `config/cinemata/` directory.

## Available Scripts

- `npm run start` - Start the development server
- `npm run build` - Build the project for production
- `npm run clean-build` - Clean the build directory
- `npm run serve-build` - Serve the built files locally

## Creating New Components and Pages

### Creating a New Component

Components in this project follow a React-based structure. While the existing codebase uses class components, it's recommended to use functional components with hooks for new development.

1. Create a new directory or file in `src/static/js/components/` based on the component's complexity:
   - For simple components, create a single JSX file (e.g., `MyComponent.jsx`)
   - For complex components, create a directory with related files (e.g., `MyComponent/index.jsx`, `MyComponent/SubComponent.jsx`)

2. Structure your component file using functional components:

```jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Import any required dependencies
// import { SomeOtherComponent } from '../SomeOtherComponent';

export const MyComponent = ({ someProp, optionalProp = 0 }) => {
  // Initialize state with useState hook
  const [someState, setSomeState] = useState(initialValue);

  // Use useEffect for lifecycle operations
  useEffect(() => {
    // Component did mount logic

    return () => {
      // Component will unmount cleanup
    };
  }, []);

  // Component methods as regular functions
  const handleSomeAction = () => {
    setSomeState(newValue);
  };

  return (
    <div className="my-component">
      <h2>{someProp}</h2>
      <p>Optional value: {optionalProp}</p>
      {/* Component JSX */}
      <button onClick={handleSomeAction}>Click me</button>
    </div>
  );
};

// Define prop types for type checking
MyComponent.propTypes = {
  someProp: PropTypes.string.isRequired,
  optionalProp: PropTypes.number,
};
```

3. If your component needs styling, add a corresponding CSS/SCSS file in `src/static/js/components/styles/` or within your component's directory.

#### Example: DemoComponent

The project includes a `DemoComponent` as an example of a reusable component:

```jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';

// Import styles if needed
import './styles/DemoComponent.scss';

const DemoComponent = ({ initialValue, title, onCountChange }) => {
  const [count, setCount] = useState(initialValue || 0);

  const handleIncrement = () => {
    const newCount = count + 1;
    setCount(newCount);
    if (onCountChange) {
      onCountChange(newCount);
    }
  };

  const handleDecrement = () => {
    const newCount = count - 1;
    setCount(newCount);
    if (onCountChange) {
      onCountChange(newCount);
    }
  };

  return (
    <div className="demo-component">
      <h3 className="demo-component__title">{title}</h3>
      <div className="demo-component__counter">
        <button
          className="demo-component__btn demo-component__btn--decrement"
          onClick={handleDecrement}
        >
          -
        </button>
        <span className="demo-component__count">{count}</span>
        <button
          className="demo-component__btn demo-component__btn--increment"
          onClick={handleIncrement}
        >
          +
        </button>
      </div>
    </div>
  );
};

DemoComponent.propTypes = {
  initialValue: PropTypes.number,
  title: PropTypes.string.isRequired,
  onCountChange: PropTypes.func
};

DemoComponent.defaultProps = {
  initialValue: 0,
  title: 'Counter'
};

export default DemoComponent;
```

This component demonstrates:
- Using function components with hooks
- Handling props with PropTypes
- Using callback functions to communicate with parent components
- Simple state management with useState

### Creating a New Page

Pages are special components that represent entire views. While existing pages use class components extending `Page`, for new pages you can use a functional approach with React hooks:

1. Create a new file in `src/static/js/pages/` (e.g., `MyNewPage.jsx`) or a new directory for more complex pages.

2. Use a functional component with the `usePage` hook and `PageLayout` component:

```jsx
import React from 'react';
import PropTypes from 'prop-types';

import { usePage, PageLayout } from './page';

// Import any components needed for your page
// import { SomeComponent } from '../components/SomeComponent';

// The page component using hooks
const MyNewPage = ({ title = 'My New Page' }) => {
  // Initialize the page with its ID
  usePage('my-new-page');

  return (
    <PageLayout>
      <div className="my-new-page-container">
        <h1>{title}</h1>
        {/* Your page content here */}
      </div>
    </PageLayout>
  );
};

// Define prop types
MyNewPage.propTypes = {
  title: PropTypes.string
};

export default MyNewPage;
```

#### Example: DemoPage

The project includes a `DemoPage` component that uses the hooks approach:

```jsx
import React, { useState } from 'react';
import PropTypes from 'prop-types';

import PageStore from './_PageStore';
import { usePage, PageLayout } from './page';
import DemoComponent from '../components/DemoComponent';

// Import styles
import './styles/DemoPage.scss';

/**
 * DemoPage component using hook pattern
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

  return (
    <PageLayout>
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
    </PageLayout>
  );
};

DemoPage.propTypes = {
  pageTitle: PropTypes.string
};

export default DemoPage;
```

This example demonstrates:
- Using the hooks pattern for page initialization
- Using composition with the PageLayout component
- Using hooks for state management (useState)
- Creating multiple instances of a component dynamically
- Proper structure to match the Page component rendering pattern
- Communication between parent and child components via callbacks

> **Note about implementation approach:** The hooks approach has several advantages:
> 1. Follows modern React patterns (hooks over HOCs)
> 2. Provides clear separation of concerns
> 3. Avoids the wrapper hell problem that can occur with HOCs
> 4. Makes component reuse and testing simpler
> 5. Improves readability and maintainability

### The Page Utilities

The `page.js` utility file contains hooks and components that simplify page creation:

```jsx
// frontend/src/static/js/pages/page.js
import React, { useEffect } from 'react';
import PageMain from '../components/-NEW-/PageMain';
import { Notifications } from '../components/-NEW-/Notifications';
import * as PageActions from './_PageActions';

/**
 * A custom hook that handles page initialization
 *
 * @param {string} pageId - The unique ID for the page
 */
export const usePage = (pageId) => {
  useEffect(() => {
    PageActions.initPage(pageId);
  }, [pageId]);
};

/**
 * A component that provides the standard page layout structure
 *
 * @param {object} props - The component props
 * @param {React.ReactNode} props.children - The page content
 */
export const PageLayout = ({ children }) => (
  <>
    <PageMain>{children}</PageMain>
    <Notifications />
  </>
);

export default {
  usePage,
  PageLayout
};
```

To use these utilities in your page components:

1. Import them at the top of your page file: `import { usePage, PageLayout } from './page';`
2. Call the usePage hook in your component: `usePage('page-id');`
3. Wrap your content with the PageLayout component: `<PageLayout>{content}</PageLayout>`

This approach ensures all pages follow the same structure and initialization pattern, while using modern React patterns.

3. Register the page in the application configuration. To do this, add your page to `config/cinemata/cinemata.mediacms.pages.config.js`:

```javascript
// Import the necessary helper functions
const { mediacmsDefaultPages } = require("../__default/mediacms.pages.config.js");

// Add your page to the 'pages' object
pages['my-new-page'] = mediacmsDefaultPages(
  'my-new-page',        // Page ID
  'My New Page',        // Page title
  'MyNewPage',          // Component name (the class you created)
  {
    // Additional configuration options, if needed
    // window: { MediaCMS: { /* page-specific data */ } }
  }
);
```

For the DemoPage example, the configuration might look like:

```javascript
pages['demo'] = mediacmsDefaultPages(
  'demo',                 // Page ID
  'Demo Page',            // Page title
  'DemoPage',             // Component name
  {
    window: {
      MediaCMS: {
        demoOptions: {
          defaultCounterValue: 0,
          maxCounters: 5
        }
      }
    }
  }
);
```

> **Note**: When working with an existing codebase that uses class components, you might need to adapt your functional components to match the expected patterns. The examples above show how to use modern React practices while maintaining compatibility with the existing code.

### Best Practices

1. Follow the existing project's patterns and conventions.
2. Use React hooks for state management and side effects in functional components:
   - `useState` for component state
   - `useEffect` for lifecycle operations
   - `useContext` for accessing context values
   - `useCallback` and `useMemo` for performance optimizations
3. Reuse existing components when possible.
4. For complex data handling, you can still interact with the Flux stores:
   - Use the hooks pattern to connect to stores
   - Create custom hooks that subscribe to store changes
   - Dispatch actions through the existing action methods

5. Consider using React contexts (like `ApiUrlContext`) for dependency injection.