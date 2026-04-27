import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const ApiUrlContext = React.createContext(mediacmsConfig(window.MediaCMS).api);

// export const ApiUrlProvider = ApiUrlContext.Provider;
export const ApiUrlConsumer = ApiUrlContext.Consumer;

export default ApiUrlContext;
