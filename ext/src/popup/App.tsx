import { useEffect, useMemo, useState } from 'react'
import {
	type ExtensionConfig,
	getExtensionConfig,
	updateExtensionConfig
} from '@/config/extensionConfig'
import './App.css'

type PopupTab = 'history' | 'options' | 'dev'
type AlertKind = 'info' | 'success' | 'error'

type PopupAlert = {
	kind: AlertKind
	message: string
}

type HistoryItem = {
	id: string
	createdAt: string
	message: string
}

const historyStorageKey = 'popup_history'
const requestTimeoutMs = 15_000

function normalizeApiBaseUrl(value: string) {
	return value.trim().replace(/\/+$/, '')
}

function createHistoryMessage(message: string): HistoryItem {
	return {
		id: crypto.randomUUID(),
		createdAt: new Date().toLocaleString(),
		message
	}
}

async function getHistory() {
	const stored = await chrome.storage.local.get(historyStorageKey)
	const history = stored[historyStorageKey]

	return Array.isArray(history) ? (history as HistoryItem[]) : []
}

async function addHistory(message: string) {
	const history = await getHistory()
	const nextHistory = [createHistoryMessage(message), ...history].slice(0, 30)
	await chrome.storage.local.set({ [historyStorageKey]: nextHistory })

	return nextHistory
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

async function postWithTimeout(url: string, init: RequestInit) {
	const controller = new AbortController()
	const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs)

	try {
		return await fetch(url, {
			...init,
			signal: controller.signal
		})
	} finally {
		window.clearTimeout(timeout)
	}
}

export default function App() {
	const [activeTab, setActiveTab] = useState<PopupTab>('history')
	const [config, setConfig] = useState<ExtensionConfig | null>(null)
	const [apiKeyInput, setApiKeyInput] = useState('')
	const [apiBaseUrlInput, setApiBaseUrlInput] = useState('')
	const [userIdInput, setUserIdInput] = useState('')
	const [history, setHistory] = useState<HistoryItem[]>([])
	const [alert, setAlert] = useState<PopupAlert | null>(null)
	const [isLoadingConfig, setIsLoadingConfig] = useState(true)
	const [isCheckingApiKey, setIsCheckingApiKey] = useState(false)

	const tabs = useMemo(() => {
		const baseTabs: Array<{ id: PopupTab; label: string }> = [
			{ id: 'history', label: 'History' },
			{ id: 'options', label: 'Options' }
		]

		if (config?.is_dev_mode) {
			baseTabs.push({ id: 'dev', label: 'Dev Mode' })
		}

		return baseTabs
	}, [config?.is_dev_mode])

	useEffect(() => {
		Promise.all([getExtensionConfig(), getHistory()])
			.then(([loadedConfig, loadedHistory]) => {
				setConfig(loadedConfig)
				setApiKeyInput(loadedConfig.API_KEY)
				setApiBaseUrlInput(loadedConfig.API_BASE_URL)
				setUserIdInput(loadedConfig.user_id)
				setHistory(loadedHistory)
			})
			.catch((error: unknown) => {
				setAlert({
					kind: 'error',
					message:
						error instanceof Error
							? error.message
							: 'Could not load extension config.'
				})
			})
			.finally(() => setIsLoadingConfig(false))
	}, [])

	async function recordHistory(message: string) {
		const nextHistory = await addHistory(message)
		setHistory(nextHistory)
	}

	async function saveApiKey() {
		const nextConfig = await updateExtensionConfig({ API_KEY: apiKeyInput.trim() })
		setConfig(nextConfig)
		setApiKeyInput(nextConfig.API_KEY)
		setAlert({ kind: 'success', message: 'API key was saved.' })
		await recordHistory('API key was updated in popup options.')
	}

	async function saveDevConfig() {
		const nextConfig = await updateExtensionConfig({
			API_BASE_URL: normalizeApiBaseUrl(apiBaseUrlInput),
			user_id: userIdInput.trim()
		})
		setConfig(nextConfig)
		setApiBaseUrlInput(nextConfig.API_BASE_URL)
		setUserIdInput(nextConfig.user_id)
		setAlert({ kind: 'success', message: 'Dev config was saved.' })
		await recordHistory('Dev config was updated from popup.')
	}

	async function checkApiKey() {
		if (!config) {
			setAlert({ kind: 'error', message: 'Config is not loaded yet.' })
			return
		}

		const apiKey = apiKeyInput.trim()
		const apiBaseUrl = normalizeApiBaseUrl(config.API_BASE_URL)

		if (!apiBaseUrl) {
			setAlert({
				kind: 'error',
				message: 'API base URL is empty. Set it in Dev Mode or extension defaults.'
			})
			return
		}

		if (!apiKey) {
			setAlert({ kind: 'error', message: 'Enter API key before checking it.' })
			return
		}

		setIsCheckingApiKey(true)
		setAlert({
			kind: 'info',
			message: 'Checking API key. Timeout is 15 seconds.'
		})

		try {
			const response = await postWithTimeout(
				`${apiBaseUrl}/v1/extension/api-key/check`,
				{
					method: 'POST',
					headers: {
						'content-type': 'application/json',
						'x-api-key': apiKey
					},
					body: JSON.stringify({ user_id: config.user_id })
				}
			)
			const payload = (await response.json().catch(() => null)) as unknown
			const message =
				getApiMessage(payload) ??
				`API responded with HTTP ${response.status}.`

			if (!response.ok) {
				setAlert({ kind: 'error', message })
				await recordHistory(`API key check failed: ${message}`)
				return
			}

			const nextConfig = await updateExtensionConfig({ API_KEY: apiKey })
			setConfig(nextConfig)
			setApiKeyInput(nextConfig.API_KEY)
			setAlert({ kind: 'success', message })
			await recordHistory(`API key check succeeded: ${message}`)
		} catch (error: unknown) {
			const message =
				error instanceof DOMException && error.name === 'AbortError'
					? 'API key check timed out after 15 seconds.'
					: error instanceof Error
						? error.message
						: 'API key check failed.'

			setAlert({ kind: 'error', message })
			await recordHistory(`API key check failed: ${message}`)
		} finally {
			setIsCheckingApiKey(false)
		}
	}

	if (isLoadingConfig) {
		return (
			<main className="popup-shell">
				<div className="popup-card popup-card--center">Loading config…</div>
			</main>
		)
	}

	return (
		<main className="popup-shell">
			<header className="popup-header">
				<div>
					<p className="popup-eyebrow">WB AI Helper</p>
					<h1>Extension assistant</h1>
				</div>
			</header>

			<nav className="popup-tabs" aria-label="Popup tabs">
				{tabs.map((tab) => (
					<button
						className={activeTab === tab.id ? 'popup-tab popup-tab--active' : 'popup-tab'}
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
					>
						{tab.label}
					</button>
				))}
			</nav>

			{alert ? (
				<section className={`popup-alert popup-alert--${alert.kind}`}>
					<p>{alert.message}</p>
					<button
						aria-label="Close alert"
						className="popup-alert__close"
						type="button"
						onClick={() => setAlert(null)}
					>
						×
					</button>
				</section>
			) : (
				<section className="popup-alert popup-alert--empty">
					<p>Messages from API and extension actions will appear here.</p>
				</section>
			)}

			{activeTab === 'history' ? (
				<section className="popup-card">
					<div className="popup-section-header">
						<h2>History</h2>
						<span>{history.length} items</span>
					</div>
					{history.length === 0 ? (
						<p className="popup-muted">No extension actions recorded yet.</p>
					) : (
						<ul className="history-list">
							{history.map((item) => (
								<li key={item.id}>
									<strong>{item.createdAt}</strong>
									<span>{item.message}</span>
								</li>
							))}
						</ul>
					)}
				</section>
			) : null}

			{activeTab === 'options' ? (
				<section className="popup-card">
					<div className="popup-section-header">
						<h2>Options</h2>
						<span>API access</span>
					</div>
					<label className="popup-field">
						<span>API key</span>
						<input
							autoComplete="off"
							placeholder="wbai_..."
							type="password"
							value={apiKeyInput}
							onChange={(event) => setApiKeyInput(event.currentTarget.value)}
						/>
					</label>
					<div className="popup-actions">
						<button type="button" onClick={saveApiKey}>
							Save
						</button>
						<button
							className="popup-primary"
							disabled={isCheckingApiKey}
							type="button"
							onClick={checkApiKey}
						>
							{isCheckingApiKey ? <span className="spinner" aria-hidden="true" /> : null}
							{isCheckingApiKey ? 'Checking…' : 'Check API key'}
						</button>
					</div>
				</section>
			) : null}

			{activeTab === 'dev' && config?.is_dev_mode ? (
				<section className="popup-card">
					<div className="popup-section-header">
						<h2>Dev Mode</h2>
						<span>Local config</span>
					</div>
					<label className="popup-field">
						<span>API_BASE_URL</span>
						<input
							placeholder="http://localhost:8181"
							type="text"
							value={apiBaseUrlInput}
							onChange={(event) => setApiBaseUrlInput(event.currentTarget.value)}
						/>
					</label>
					<label className="popup-field">
						<span>user_id</span>
						<input
							type="text"
							value={userIdInput}
							onChange={(event) => setUserIdInput(event.currentTarget.value)}
						/>
					</label>
					<div className="popup-actions">
						<button className="popup-primary" type="button" onClick={saveDevConfig}>
							Save Dev Config
						</button>
					</div>
				</section>
			) : null}
		</main>
	)
}
