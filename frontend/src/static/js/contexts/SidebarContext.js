import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const SidebarContext = React.createContext(mediacmsConfig(window.MediaCMS).sidebar);

export default SidebarContext;
