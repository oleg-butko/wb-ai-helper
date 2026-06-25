export type ExtensionConfig = {
	API_BASE_URL: string
	API_KEY: string
	user_id: string
	is_dev_mode?: true
}

const developApiBaseUrl = 'http://localhost:8181'
const productionApiBaseUrl = ''

function generateUuidV7() {
	const bytes = new Uint8Array(16)
	crypto.getRandomValues(bytes)

	const timestamp = BigInt(Date.now())

	bytes[0] = Number((timestamp >> 40n) & 0xffn)
	bytes[1] = Number((timestamp >> 32n) & 0xffn)
	bytes[2] = Number((timestamp >> 24n) & 0xffn)
	bytes[3] = Number((timestamp >> 16n) & 0xffn)
	bytes[4] = Number((timestamp >> 8n) & 0xffn)
	bytes[5] = Number(timestamp & 0xffn)
	bytes[6] = (bytes[6] & 0x0f) | 0x70
	bytes[8] = (bytes[8] & 0x3f) | 0x80

	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('')

	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20)
	].join('-')
}

function resolveApiBaseUrl(fallback: string) {
	return import.meta.env.VITE_EXTENSION_API_BASE_URL ?? fallback
}

export function createDefaultExtensionConfig(): ExtensionConfig {
	if (import.meta.env.MODE === 'develop') {
		return {
			API_BASE_URL: resolveApiBaseUrl(developApiBaseUrl),
			API_KEY: '',
			user_id: generateUuidV7(),
			is_dev_mode: true
		}
	}

	return {
		API_BASE_URL: resolveApiBaseUrl(productionApiBaseUrl),
		API_KEY: '',
		user_id: generateUuidV7()
	}
}

export async function resetExtensionConfig() {
	const config = createDefaultExtensionConfig()
	const keysToRemove: Array<keyof ExtensionConfig> = [
		'API_BASE_URL',
		'API_KEY',
		'user_id',
		'is_dev_mode'
	]

	await chrome.storage.sync.remove(keysToRemove)
	await chrome.storage.sync.set(config)

	return config
}

export async function getExtensionConfig() {
	const stored = await chrome.storage.sync.get([
		'API_BASE_URL',
		'API_KEY',
		'user_id',
		'is_dev_mode'
	])

	if (
		typeof stored.API_BASE_URL === 'string' &&
		typeof stored.API_KEY === 'string' &&
		typeof stored.user_id === 'string'
	) {
		return {
			API_BASE_URL: stored.API_BASE_URL,
			API_KEY: stored.API_KEY,
			user_id: stored.user_id,
			...(stored.is_dev_mode === true ? { is_dev_mode: true as const } : {})
		}
	}

	return resetExtensionConfig()
}

export async function updateExtensionConfig(
	patch: Partial<Pick<ExtensionConfig, 'API_BASE_URL' | 'API_KEY' | 'user_id'>>
) {
	await chrome.storage.sync.set(patch)

	return getExtensionConfig()
}
