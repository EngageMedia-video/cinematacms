import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const LinksContext = React.createContext(mediacmsConfig(window.MediaCMS).url);

// export const LinksProvider = LinksContext.Provider;
export const LinksConsumer = LinksContext.Consumer;

export default LinksContext;
