import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const ShareOptionsContext = React.createContext(mediacmsConfig(window.MediaCMS).media.share.options);

// export const ShareOptionsProvider = ShareOptionsContext.Provider;
// export const ShareOptionsConsumer = ShareOptionsContext.Consumer;

export default ShareOptionsContext;
