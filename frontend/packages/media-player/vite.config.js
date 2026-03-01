import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, 'src/index.js'),
			name: 'MediaPlayer',
			formats: ['umd'],
			fileName: () => 'mediacms-media-player.js',
		},
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			output: {
				assetFileNames: 'mediacms-media-player.[ext]',
			},
		},
	},
});
