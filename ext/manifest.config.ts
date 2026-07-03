import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export function createManifest(mode: string) {
	const isDevelop = mode === 'develop'

	return defineManifest({
		manifest_version: 3,
		name: isDevelop ? `${pkg.name} Develop` : pkg.name,
		version: pkg.version,
		icons: {
      16: 'public/logo-128x128.png',
      48: 'public/logo-128x128.png',
			128: 'public/logo-128x128.png'
		},
		permissions: ['storage'],
		host_permissions: [
			'https://*.jocs.ru/*/*',
			'https://seller.wildberries.ru/feedbacks/feedbacks-tab/not-answered/*/*'
		],
		action: {
			default_icon: {
				128: 'public/logo-128x128.png'
			},
			default_popup: 'src/popup/index.html'
		},
		background: {
			service_worker: 'src/background/index.ts',
			type: 'module'
		},
		content_scripts: [
			{
				js: ['src/content/main.tsx'],
				all_frames: false,
				matches: [
					'https://seller.wildberries.ru/feedbacks/feedbacks-tab/not-answered/*'
				],
				world: 'ISOLATED' // 'MAIN'
				// run_at: 'document_idle'
			}
		],
		web_accessible_resources: [
			{
				resources: ['button1.svg'],
				matches: ['https://seller.wildberries.ru/*']
			}
		]
	})
}

export default createManifest('production')
