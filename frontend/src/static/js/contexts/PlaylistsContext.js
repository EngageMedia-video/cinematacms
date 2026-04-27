import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const PlaylistsContext = React.createContext(mediacmsConfig(window.MediaCMS).playlists);

// export const PlaylistsProvider = PlaylistsContext.Provider;
// export const PlaylistsConsumer = PlaylistsContext.Consumer;

export default PlaylistsContext;
