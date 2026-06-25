import {
	getExtensionConfig,
	resetExtensionConfig
} from '../config/extensionConfig'

const workerGlobal = self as typeof self & {
	resetConfig: () => Promise<void>
}

const generationTimeoutMs = 60_000

type ExtensionReviewPayload = {
	name: string
	product_details: string[]
	feedback_reasons: string[]
	rating: number
	product_name: string
	product_url: string
	vendor_code_1: string
	vendor_code_2: string
	colors: string
	size: string
}

type GenerateReviewResponseMessage = {
	type: 'wb-ai-helper/generate-review-response'
	review: ExtensionReviewPayload
}

type GenerateReviewResponseResult =
	| {
			ok: true
			payload: unknown
	  }
	| {
			ok: false
			message: string
	  }

async function resetConfig() {
	const config = await resetExtensionConfig()
	console.info('[wb-ai-helper] Extension config reset', config)
}

workerGlobal.resetConfig = resetConfig

function normalizeApiBaseUrl(value: string) {
	return value.trim().replace(/\/+$/, '')
}

function getApiMessage(payload: unknown) {
	if (
		typeof payload === 'object' &&
		payload !== null &&
		'message' in payload &&
		typeof payload.message === 'string'
	) {
		return payload.message
	}

	return null
}

function getApiDetails(payload: unknown) {
	if (
		typeof payload === 'object' &&
		payload !== null &&
		'details' in payload &&
		typeof payload.details === 'object' &&
		payload.details !== null
	) {
		return JSON.stringify(payload.details)
	}

	return null
}

function isGenerateReviewResponseMessage(
	message: unknown
): message is GenerateReviewResponseMessage {
	return (
		typeof message === 'object' &&
		message !== null &&
		'type' in message &&
		message.type === 'wb-ai-helper/generate-review-response' &&
		'review' in message &&
		typeof message.review === 'object' &&
		message.review !== null
	)
}

async function fetchWithTimeout(url: string, init: RequestInit) {
	const controller = new AbortController()
	const timeout = self.setTimeout(() => controller.abort(), generationTimeoutMs)

	try {
		return await fetch(url, {
			...init,
			signal: controller.signal
		})
	} finally {
		self.clearTimeout(timeout)
	}
}

async function generateReviewResponse(
	review: ExtensionReviewPayload
): Promise<GenerateReviewResponseResult> {
	try {
		const config = await getExtensionConfig()
		const apiBaseUrl = normalizeApiBaseUrl(config.API_BASE_URL)
		const apiKey = config.API_KEY.trim()

		if (!apiBaseUrl) {
			return {
				ok: false,
				message:
					'API_BASE_URL is empty. Open extension popup and set it in Dev Mode.'
			}
		}

		if (!apiKey) {
			return {
				ok: false,
				message: 'API key is empty. Open extension popup and enter API key in Options.'
			}
		}

		const response = await fetchWithTimeout(
			`${apiBaseUrl}/v1/extension/review-response`,
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					'x-api-key': apiKey
				},
				body: JSON.stringify({
					user_id: config.user_id,
					review
				})
			}
		)
		const payload = (await response.json().catch(() => null)) as unknown

		if (!response.ok) {
			const details = getApiDetails(payload)
			const message =
				getApiMessage(payload) ??
				`Generation request failed with HTTP ${response.status}.`

			return {
				ok: false,
				message: details ? `${message}\nDetails: ${details}` : message
			}
		}

		return {
			ok: true,
			payload
		}
	} catch (error: unknown) {
		return {
			ok: false,
			message:
				error instanceof DOMException && error.name === 'AbortError'
					? 'Generation request timed out after 60 seconds.'
					: error instanceof Error
						? error.message
						: 'Generation request failed.'
		}
	}
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (!isGenerateReviewResponseMessage(message)) {
		return false
	}

	void generateReviewResponse(message.review).then(sendResponse)

	return true
})

chrome.runtime.onInstalled.addListener((details) => {
	if (details.reason !== chrome.runtime.OnInstalledReason.INSTALL) {
		return
	}

	resetConfig().catch((error: unknown) => {
		console.error('[wb-ai-helper] Failed to initialize extension config', error)
	})
})
