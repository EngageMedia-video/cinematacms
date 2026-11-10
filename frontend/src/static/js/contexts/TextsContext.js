import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

// TODO: Continue here.

const notifications = mediacmsConfig(window.MediaCMS).notifications.messages;

const texts = {
	notifications,
};

const TextsContext = React.createContext(texts);

export default TextsContext;
