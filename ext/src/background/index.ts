import { resetExtensionConfig } from '../config/extensionConfig'

const workerGlobal = self as typeof self & {
	resetConfig: () => Promise<void>
}

async function resetConfig() {
	const config = await resetExtensionConfig()
	console.info('[wb-ai-helper] Extension config reset', config)
}

workerGlobal.resetConfig = resetConfig

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) {
		return
	}

	resetConfig().catch((error: unknown) => {
		console.error('[wb-ai-helper] Failed to initialize extension config', error)
	})
})
