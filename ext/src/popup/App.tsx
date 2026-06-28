import { useEffect, useMemo, useState } from 'react'
import {
	type ExtensionConfig,
	getExtensionConfig,
	updateExtensionConfig
} from '@/config/extensionConfig'
import {
	type ExtensionLanguage,
	normalizeExtensionLanguage,
	t
} from '@/i18n'
import './App.css'

type PopupTab = 'history' | 'options' | 'dev'
type AlertKind = 'info' | 'success' | 'error'

type PopupAlert = {
	kind: AlertKind
	message: string
	createdAt?: string
}

type HistoryItem = {
	id: string
	createdAt: string
	message: string
}

const historyStorageKey = 'popup_history'
const popupAlertStorageKey = 'popup_last_alert'
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

function isPopupAlert(payload: unknown): payload is PopupAlert {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'kind' in payload &&
		(payload.kind === 'info' ||
			payload.kind === 'success' ||
			payload.kind === 'error') &&
		'message' in payload &&
		typeof payload.message === 'string'
	)
}

async function getStoredPopupAlert() {
	const stored = await chrome.storage.local.get(popupAlertStorageKey)
	const alert = stored[popupAlertStorageKey]

	return isPopupAlert(alert) ? alert : null
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
	const language = config?.language ?? 'ru'
	const tr = (key: Parameters<typeof t>[1], params?: Parameters<typeof t>[2]) =>
		t(language, key, params)

	const tabs = useMemo(() => {
		const baseTabs: Array<{ id: PopupTab; label: string }> = [
			{ id: 'history', label: t(language, 'history') },
			{ id: 'options', label: t(language, 'options') }
		]

		if (config?.is_dev_mode) {
			baseTabs.push({ id: 'dev', label: t(language, 'devMode') })
		}

		return baseTabs
	}, [config?.is_dev_mode, language])

	useEffect(() => {
		Promise.all([getExtensionConfig(), getHistory(), getStoredPopupAlert()])
			.then(([loadedConfig, loadedHistory, storedAlert]) => {
				setConfig(loadedConfig)
				setApiKeyInput(loadedConfig.API_KEY)
				setApiBaseUrlInput(loadedConfig.API_BASE_URL)
				setUserIdInput(loadedConfig.user_id)
				setHistory(loadedHistory)
				setAlert(storedAlert)
			})
			.catch((error: unknown) => {
				setAlert({
					kind: 'error',
					message:
						error instanceof Error
							? error.message
							: tr('configLoadFailed')
				})
			})
			.finally(() => setIsLoadingConfig(false))
	}, [])

	useEffect(() => {
		function handleStorageChange(
			changes: Record<string, chrome.storage.StorageChange>,
			areaName: string
		) {
			if (areaName === 'sync') {
				void getExtensionConfig().then((nextConfig) => {
					setConfig(nextConfig)
					setApiKeyInput(nextConfig.API_KEY)
					setApiBaseUrlInput(nextConfig.API_BASE_URL)
					setUserIdInput(nextConfig.user_id)
				})
				return
			}

			if (areaName === 'local') {
				const alertChange = changes[popupAlertStorageKey]
				const historyChange = changes[historyStorageKey]

				if (alertChange) {
					setAlert(isPopupAlert(alertChange.newValue) ? alertChange.newValue : null)
				}

				if (historyChange && Array.isArray(historyChange.newValue)) {
					setHistory(historyChange.newValue as HistoryItem[])
				}
			}
		}

		chrome.storage.onChanged.addListener(handleStorageChange)

		return () => chrome.storage.onChanged.removeListener(handleStorageChange)
	}, [])

	async function recordHistory(message: string) {
		const nextHistory = await addHistory(message)
		setHistory(nextHistory)
	}

	async function clearAlert() {
		setAlert(null)
		await chrome.storage.local.remove(popupAlertStorageKey)
	}

	async function copyAlert() {
		if (!alert?.message) {
			return
		}

		await navigator.clipboard.writeText(alert.message)
		setAlert({
			kind: 'success',
			message: tr('alertCopied')
		})
	}

	async function saveApiKey() {
		const nextConfig = await updateExtensionConfig({ API_KEY: apiKeyInput.trim() })
		setConfig(nextConfig)
		setApiKeyInput(nextConfig.API_KEY)
		setAlert({ kind: 'success', message: tr('apiKeySaved') })
		await recordHistory(tr('apiKeyUpdatedHistory'))
	}

	async function saveLanguage(nextLanguage: ExtensionLanguage) {
		const nextConfig = await updateExtensionConfig({ language: nextLanguage })
		setConfig(nextConfig)
	}

	async function saveDevConfig() {
		const nextConfig = await updateExtensionConfig({
			API_BASE_URL: normalizeApiBaseUrl(apiBaseUrlInput),
			user_id: userIdInput.trim()
		})
		setConfig(nextConfig)
		setApiBaseUrlInput(nextConfig.API_BASE_URL)
		setUserIdInput(nextConfig.user_id)
		setAlert({ kind: 'success', message: tr('devConfigSaved') })
		await recordHistory(tr('devConfigUpdatedHistory'))
	}

	async function checkApiKey() {
		if (!config) {
			setAlert({ kind: 'error', message: tr('configNotLoaded') })
			return
		}

		const apiKey = apiKeyInput.trim()
		const apiBaseUrl = normalizeApiBaseUrl(config.API_BASE_URL)

		if (!apiBaseUrl) {
			setAlert({
				kind: 'error',
				message: tr('apiBaseUrlEmpty')
			})
			return
		}

		if (!apiKey) {
			setAlert({ kind: 'error', message: tr('apiKeyEmpty') })
			return
		}

		setIsCheckingApiKey(true)
		setAlert({
			kind: 'info',
			message: tr('checkingApiKey')
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
				tr('apiRespondedWithStatus', { status: response.status })

			if (!response.ok) {
				setAlert({ kind: 'error', message })
				await recordHistory(tr('apiKeyCheckFailedWithMessage', { message }))
				return
			}

			const nextConfig = await updateExtensionConfig({ API_KEY: apiKey })
			setConfig(nextConfig)
			setApiKeyInput(nextConfig.API_KEY)
			setAlert({ kind: 'success', message })
			await recordHistory(tr('apiKeyCheckSucceededWithMessage', { message }))
		} catch (error: unknown) {
			const message =
				error instanceof DOMException && error.name === 'AbortError'
					? tr('apiKeyCheckTimedOut')
					: error instanceof Error
						? error.message
						: tr('apiKeyCheckFailed')

			setAlert({ kind: 'error', message })
			await recordHistory(tr('apiKeyCheckFailedWithMessage', { message }))
		} finally {
			setIsCheckingApiKey(false)
		}
	}

	if (isLoadingConfig) {
		return (
			<main className="popup-shell">
				<div className="popup-card popup-card--center">{tr('loadingConfig')}</div>
			</main>
		)
	}

	return (
		<main className="popup-shell">
			<header className="popup-header">
				<div>
					<p className="popup-eyebrow">WB AI Helper</p>
					<h1>{tr('extensionAssistant')}</h1>
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
						aria-label={tr('closeAlert')}
						className="popup-alert__close"
						type="button"
						onClick={clearAlert}
					>
						×
					</button>
					<button className="popup-alert__copy" type="button" onClick={copyAlert}>
						{tr('copy')}
					</button>
				</section>
			) : (
				<section className="popup-alert popup-alert--empty">
					<p>{tr('alertEmpty')}</p>
				</section>
			)}

			{activeTab === 'history' ? (
				<section className="popup-card popup-card--history">
					<div className="popup-section-header">
						<h2>{tr('history')}</h2>
						<span>{tr('items', { count: history.length })}</span>
					</div>
					{history.length === 0 ? (
						<p className="popup-muted">{tr('noHistory')}</p>
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
						<h2>{tr('options')}</h2>
						<span>{tr('apiAccess')}</span>
					</div>
					<label className="popup-field">
						<span>{tr('language')}</span>
						<select
							value={language}
							onChange={(event) => {
								void saveLanguage(
									normalizeExtensionLanguage(event.currentTarget.value)
								)
							}}
						>
							<option value="ru">{tr('languageRussian')}</option>
							<option value="en">{tr('languageEnglish')}</option>
						</select>
					</label>
					<label className="popup-field">
						<span>{tr('apiKey')}</span>
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
							{tr('save')}
						</button>
						<button
							className="popup-primary"
							disabled={isCheckingApiKey}
							type="button"
							onClick={checkApiKey}
						>
							{isCheckingApiKey ? <span className="spinner" aria-hidden="true" /> : null}
							{isCheckingApiKey ? tr('checking') : tr('checkApiKey')}
						</button>
					</div>
				</section>
			) : null}

			{activeTab === 'dev' && config?.is_dev_mode ? (
				<section className="popup-card">
					<div className="popup-section-header">
						<h2>{tr('devMode')}</h2>
						<span>{tr('localConfig')}</span>
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
							{tr('saveDevConfig')}
						</button>
					</div>
				</section>
			) : null}
		</main>
	)
}
