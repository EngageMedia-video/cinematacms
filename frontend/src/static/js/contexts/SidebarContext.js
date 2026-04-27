import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const SidebarContext = React.createContext(mediacmsConfig(window.MediaCMS).sidebar);

// export const SidebarProvider = SidebarContext.Provider;
export const SidebarConsumer = SidebarContext.Consumer;

export default SidebarContext;
