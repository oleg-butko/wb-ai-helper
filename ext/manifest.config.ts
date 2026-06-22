import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
	manifest_version: 3,
	name: pkg.name,
	version: pkg.version,
	icons: {
		48: 'public/logo.png'
	},
	action: {
		default_icon: {
			48: 'public/logo.png'
		},
		default_popup: 'src/popup/index.html'
	},
	content_scripts: [
		{
			js: ['src/content/main.tsx'],
			all_frames: false,
			matches: [
				'https://seller.wildberries.ru/feedbacks/feedbacks-tab/*'
			],
			world: 'ISOLATED' // 'MAIN'
			// run_at: 'document_idle'
		}
	]
})
