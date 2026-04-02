import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.js'),
			name: 'MediaCmsVjsPlugin',
			formats: ['es', 'umd'],
			fileName: (format) => (format === 'es' ? 'mediacms-vjs-plugin.mjs' : 'mediacms-vjs-plugin.js'),
		},
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			output: {
				assetFileNames: 'mediacms-vjs-plugin.[ext]',
			},
		},
	},
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler',
			},
		},
	},
});
