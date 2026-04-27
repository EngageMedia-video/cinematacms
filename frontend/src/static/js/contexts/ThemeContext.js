import React from 'react';

import { config as mediacmsConfig } from '../mediacms/config.js';

const config = mediacmsConfig(window.MediaCMS);

const theme = {
	switch: config.theme.switch,
};

const ThemeContext = React.createContext(theme);

export const ThemeProvider = ThemeContext.Provider;
export const ThemeConsumer = ThemeContext.Consumer;

export default ThemeContext;
