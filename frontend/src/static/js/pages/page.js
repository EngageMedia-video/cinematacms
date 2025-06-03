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
