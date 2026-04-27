import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const SiteContext = React.createContext(mediacmsConfig(window.MediaCMS).site);

// export const SiteProvider = SiteContext.Provider;
export const SiteConsumer = SiteContext.Consumer;

export default SiteContext;
