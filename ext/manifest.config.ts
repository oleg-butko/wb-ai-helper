import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export function createManifest(mode: string) {
	const isDevelop = mode === 'develop'

	return defineManifest({
		manifest_version: 3,
		name: isDevelop ? `${pkg.name} Develop` : pkg.name,
		version: pkg.version,
		icons: {
			48: 'public/logo.png'
		},
		permissions: ['storage'],
		host_permissions: [
			'https://soberly-brave-rabbitfish.cloudpub.ru/*/*',
			'https://seller.wildberries.ru/feedbacks/feedbacks-tab/not-answered/*/*'
		],
		action: {
			default_icon: {
				48: 'public/logo.png'
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
		]
	})
}

export default createManifest('production')
