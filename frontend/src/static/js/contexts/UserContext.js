import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const UserContext = React.createContext(mediacmsConfig(window.MediaCMS).member);

// export const UserProvider = UserContext.Provider;
export const UserConsumer = UserContext.Consumer;

export default UserContext;
