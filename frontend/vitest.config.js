import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
	viteConfig,
	defineConfig({
		test: {
			environment: 'jsdom',
			globals: true,
			setupFiles: ['./src/test/setup.js'],
			include: ['src/**/*.test.{js,jsx}'],
			css: true,
			testTimeout: 10000,
			coverage: {
				provider: 'v8',
				reporter: ['text-summary', 'json-summary'],
				reportsDirectory: 'coverage',
				include: ['src/features/**/*.{js,jsx}', 'src/static/js/**/*.{js,jsx}'],
				exclude: [
					'src/**/*.test.{js,jsx}',
					'src/test/**',
					// V8 cannot remap this uncovered JSX file while it uses a .js extension.
					'src/static/js/components/-NEW-/InlineSliderItemListAsync.js',
				],
			},
		},
	})
);
