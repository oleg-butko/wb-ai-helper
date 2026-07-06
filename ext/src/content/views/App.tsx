import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getExtensionConfig } from '@/config/extensionConfig'
import {
  defaultExtensionLanguage,
  getDateTimeLocale,
  type ExtensionLanguage,
  t
} from '@/i18n'
import { waitForElement } from '../utils/waitForElement'
import './App.css'

const helperButtonId = 'crxjs-helper-button'
const helperPageAlertHostId = 'crxjs-helper-page-alert-host'
const helperButtonLoadingText = 'Генерируем...'
const popupAlertStorageKey = 'popup_last_alert'
const popupHistoryStorageKey = 'popup_history'
const portalMutationBurstLimit = 250
const portalMutationBurstWindowMs = 2_000
const portalMutationPauseMs = 1_000

type HelperButtonWarning = {
  title: string
  message: string
}

type HelperPageAlert = {
  message: string
}

type ParsedInfo = {
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

type PopupAlert = {
  kind: 'info' | 'success' | 'error'
  message: string
  createdAt: string
}

type HistoryItem = {
  id: string
  createdAt: string
  message: string
}

type GenerationDiagnostics = {
  backend?: string
  backendVersion?: string
  mode?: string
  requestId?: string
  apiKeyId?: string
  userId?: string
  quotaRemaining?: number
  providerProfileId?: string
  promptProfileId?: string
  model?: string
}

type GenerationResult = {
  text: string
  diagnostics: GenerationDiagnostics | null
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

type GenerationStatus = 'idle' | 'loading' | 'succeeded' | 'failed'
type HelperButtonState = 'idle' | 'loading' | 'done'

const buttonsRootSelector =
  '#Portal-modal-extend-info > div > div > div > div > div > div > div > div > div > div > form > div:nth-child(2) > div'

const buttonGenSelector =
  '#Portal-modal-extend-info > div > div > div > div > div > div > div > div > div > div > form > div > div > div:nth-child(3) > div > div > button'

const textSelector = 'span[data-name="Text"]'

function getText(element: Element) {
  return element.textContent?.trim() ?? ''
}

function formatDiagnostics(
  diagnostics: GenerationDiagnostics | null,
  language: ExtensionLanguage
) {
  if (!diagnostics) {
    return t(language, 'noDiagnostics')
  }

  return [
    `backend: ${diagnostics.backend ?? '—'} ${diagnostics.backendVersion ?? ''}`.trim(),
    `mode: ${diagnostics.mode ?? '—'}`,
    `model: ${diagnostics.model ?? '—'}`,
    `quotaRemaining: ${diagnostics.quotaRemaining ?? '—'}`,
    `requestId: ${diagnostics.requestId ?? '—'}`,
    `providerProfileId: ${diagnostics.providerProfileId ?? '—'}`,
    `promptProfileId: ${diagnostics.promptProfileId ?? '—'}`
  ].join('\n')
}

async function addPopupHistory(message: string, language: ExtensionLanguage) {
  const stored = await chrome.storage.local.get(popupHistoryStorageKey)
  const history = Array.isArray(stored[popupHistoryStorageKey])
    ? (stored[popupHistoryStorageKey] as HistoryItem[])
    : []
  const nextHistory = [
    {
      id: crypto.randomUUID(),
      createdAt: new Date().toLocaleString(getDateTimeLocale(language)),
      message
    },
    ...history
  ].slice(0, 30)

  await chrome.storage.local.set({ [popupHistoryStorageKey]: nextHistory })
}

async function savePopupAlert(message: string, language: ExtensionLanguage) {
  const alert: PopupAlert = {
    kind: 'error',
    message,
    createdAt: new Date().toISOString()
  }

  await chrome.storage.local.set({ [popupAlertStorageKey]: alert })
  await addPopupHistory(t(language, 'generationFailedHistory', { message }), language)
}

function formatGenerationSuccessHistory(
  result: GenerationResult,
  language: ExtensionLanguage
) {
  const quotaRemaining = result.diagnostics?.quotaRemaining

  if (typeof quotaRemaining === 'number' && Number.isFinite(quotaRemaining)) {
    return t(language, 'generationRequestSucceededWithQuota', {
      count: quotaRemaining
    })
  }

  return t(language, 'generationRequestSucceededWithUnknownQuota')
}

function parseGenerationPayload(payload: unknown): GenerationResult | null {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('response' in payload) ||
    typeof payload.response !== 'object' ||
    payload.response === null ||
    !('text' in payload.response) ||
    typeof payload.response.text !== 'string'
  ) {
    return null
  }

  const diagnostics =
    'diagnostics' in payload.response &&
    typeof payload.response.diagnostics === 'object' &&
    payload.response.diagnostics !== null
      ? (payload.response.diagnostics as GenerationDiagnostics)
      : null

  return {
    text: payload.response.text,
    diagnostics
  }
}

async function requestGeneration(
  review: ParsedInfo,
  language: ExtensionLanguage
): Promise<GenerationResult> {
  const result = (await chrome.runtime.sendMessage({
    type: 'wb-ai-helper/generate-review-response',
    review
  })) as GenerateReviewResponseResult | undefined

  if (!result) {
    throw new Error(t(language, 'generationRequestFailed'))
  }

  if (!result.ok) {
    throw new Error(result.message)
  }

  const generationResult = parseGenerationPayload(result.payload)

  if (!generationResult) {
    throw new Error(t(language, 'unexpectedGenerationResponse'))
  }

  await chrome.storage.local.remove(popupAlertStorageKey)
  await addPopupHistory(
    formatGenerationSuccessHistory(generationResult, language),
    language
  )

  return generationResult
}

function findAnswerTextarea() {
  return document.querySelector<HTMLTextAreaElement>(
    'textarea#answerText[name="answerText"], textarea#answerText, textarea[name="answerText"]'
  )
}

function insertGeneratedText(text: string, language: ExtensionLanguage) {
  const textarea = findAnswerTextarea()

  if (!textarea) {
    throw new Error(t(language, 'answerTextareaMissing'))
  }

  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  )?.set

  if (valueSetter) {
    valueSetter.call(textarea, text)
  } else {
    textarea.value = text
  }

  textarea.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: 'insertText'
    })
  )
  textarea.dispatchEvent(new Event('change', { bubbles: true }))
  textarea.focus()
}

function getTextValues(root: ParentNode) {
  return Array.from(root.querySelectorAll(textSelector)).map(getText).filter(Boolean)
}

function getChipValues(root: ParentNode) {
  return Array.from(root.querySelectorAll('div[data-name="Chips"]'))
    .map(getText)
    .filter(Boolean)
}

function isProductDetailsNoise(value: string) {
  return (
    value === 'Ещё' ||
    /^\d{2}\.\d{2}\.\d{4}\s+в\s+\d{2}:\d{2}$/.test(value)
  )
}

function parsePurchaseDetails(root: ParentNode) {
  const productDetailsRoot = root.querySelector(
    'div[data-testid="Product-item-details"]'
  )

  return productDetailsRoot
    ? getTextValues(productDetailsRoot).filter((value) => !isProductDetailsNoise(value))
    : []
}

function findAncestorByClassPrefix(element: Element, prefix: string) {
  let ancestor = element.parentElement

  while (ancestor) {
    if (hasClassPrefix(ancestor, prefix)) {
      return ancestor
    }

    ancestor = ancestor.parentElement
  }

  return null
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function parseFeedbackDetailLines(root: ParentNode) {
  const labels = new Set(['Плюсы', 'Минусы', 'Комментарий'])

  return Array.from(root.querySelectorAll('div[data-testid="text-ellipse"]')).flatMap(
    (textBlock) => {
      const textValues = Array.from(textBlock.querySelectorAll(textSelector)).map(getText)
      const rawLabel = textValues[0] ?? ''
      const labelMatch = rawLabel.match(/^(Плюсы|Минусы|Комментарий):\s*(.*)$/)

      if (!labelMatch || !labels.has(labelMatch[1])) {
        return []
      }

      const label = labelMatch[1]
      const valueFromLabel = labelMatch[2]
      const textWrapper =
        findAncestorByClassPrefix(textBlock, 'Feedback-text-block__text-wrapper__') ??
        textBlock
      const values = uniqueValues([
        valueFromLabel,
        ...textValues.slice(1),
        ...getChipValues(textWrapper)
      ])

      if (values.length === 0) {
        return []
      }

      return [`${label}: ${values.join(', ')}`]
    }
  )
}

function findReasonsRoot(root: ParentNode) {
  return Array.from(root.querySelectorAll('div')).find((element) =>
    Array.from(element.classList).some((className) =>
      className.startsWith('Extended-feedback-item-info-content__reasons-block__')
    )
  )
}

function findFeedbackInfoRoot(root: ParentNode) {
  return (
    Array.from(root.querySelectorAll('div')).find((element) =>
      Array.from(element.classList).some((className) =>
        className.startsWith('Extended-feedback-item-info-content__feedback-info-block__')
      )
    ) ?? root
  )
}

function findElementByClassPrefix(root: ParentNode, prefix: string) {
  if (root instanceof Element && hasClassPrefix(root, prefix)) {
    return root
  }

  return Array.from(root.querySelectorAll('div')).find((element) =>
    hasClassPrefix(element, prefix)
  )
}

function hasClassPrefix(element: Element, prefix: string) {
  return Array.from(element.classList).some((className) => className.startsWith(prefix))
}

function hasAncestorWithClassPrefix(element: Element, prefix: string) {
  let ancestor = element.parentElement

  while (ancestor) {
    if (hasClassPrefix(ancestor, prefix)) {
      return true
    }

    ancestor = ancestor.parentElement
  }

  return false
}

function parseProductInfo(root: ParentNode) {
  const productRoot = findElementByClassPrefix(root, 'Extended-article-info-card__info__')

  if (!productRoot) {
    return {
      product_name: '',
      product_url: '',
      vendor_code_1: '',
      vendor_code_2: '',
      colors: '',
      size: ''
    }
  }

  const productLink = productRoot.querySelector<HTMLAnchorElement>('a[href]')
  const vendorCodeElements = Array.from(productRoot.querySelectorAll('div')).filter(
    (element) =>
      hasClassPrefix(element, 'Extended-article-info-card__vendor-code-container-item__')
  )
  const vendorCodes = vendorCodeElements.map(getText)

  const dividerElements = Array.from(productRoot.querySelectorAll('div')).filter(
    (element) => hasClassPrefix(element, 'Extended-article-info-card__divider__')
  )
  const externalDividerElements = dividerElements.filter(
    (element) =>
      !hasAncestorWithClassPrefix(
        element,
        'Extended-article-info-card__vendor-code-container-item__'
      )
  )
  const dividerValues = externalDividerElements.map((divider) =>
    divider.nextElementSibling ? getText(divider.nextElementSibling) : ''
  )

  return {
    product_name: productLink ? getText(productLink) : '',
    product_url: productLink?.getAttribute('href')?.trim() ?? '',
    vendor_code_1: vendorCodes[0] ?? '',
    vendor_code_2: vendorCodes[1] ?? '',
    colors: dividerValues[0] ?? '',
    size: dividerValues[1] ?? ''
  }
}

function parseRating(root: ParentNode) {
  const ratingRoot = findElementByClassPrefix(root, 'Rating__')

  if (!ratingRoot) {
    return 0
  }

  return Array.from(ratingRoot.children)
    .slice(0, 5)
    .reduce((rating, star) => {
      const classes = Array.from(star.classList)

      if (classes.some((className) => className.startsWith('Rating--active__'))) {
        return rating + 1
      }

      if (classes.some((className) => className.startsWith('Rating--not-active__'))) {
        return rating
      }

      return rating
    }, 0)
}

function parseFeedbackInfo(root: ParentNode): ParsedInfo {
  const infoRoot = findFeedbackInfoRoot(root)
  const firstText = infoRoot.querySelector(textSelector)
  const reasonsRoot = findReasonsRoot(infoRoot)
  const feedbackReasons = reasonsRoot ? getTextValues(reasonsRoot) : []

  if (reasonsRoot) {
    Array.from(reasonsRoot.querySelectorAll('div[data-name="Chips"]'))
      .map(getText)
      .filter(Boolean)
      .forEach((value) => {
        feedbackReasons.push(`Тэг:${value}`)
      })
  }

  const parsedInfo: ParsedInfo = {
    name: firstText ? getText(firstText) : '',
    product_details: [
      ...parsePurchaseDetails(infoRoot),
      ...parseFeedbackDetailLines(infoRoot)
    ],
    feedback_reasons: feedbackReasons,
    rating: parseRating(infoRoot),
    ...parseProductInfo(root)
  }
  const optionalMissingFields = new Set(['colors', 'size'])
  const missingFields = Object.entries(parsedInfo).flatMap(([field, value]) => {
    if (optionalMissingFields.has(field)) {
      return []
    }

    if (typeof value === 'string' && value.trim() === '') {
      return [field]
    }

    if (Array.isArray(value) && value.length === 0) {
      return [field]
    }

    return []
  })

  if (missingFields.length > 0) {
    console.warn('[CRXJS][feedback-parser] Parsed fields not found', {
      fields: missingFields
    })
  }

  return parsedInfo
}

function removeHelperButton() {
  document.getElementById(helperButtonId)?.remove()
}

function isHelperOwnedNode(node: Node) {
  const element =
    node instanceof Element
      ? node
      : node.parentElement instanceof Element
        ? node.parentElement
        : null

  return Boolean(
    element?.closest(`#${helperButtonId}, #${helperPageAlertHostId}, .helper-page-alert`)
  )
}

function hasNonHelperMutation(mutations: MutationRecord[]) {
  return mutations.some((mutation) => {
    if (!isHelperOwnedNode(mutation.target)) {
      return true
    }

    return [...mutation.addedNodes, ...mutation.removedNodes].some(
      (node) => !isHelperOwnedNode(node)
    )
  })
}

function ensureHelperPageAlertHost(buttonsRoot: HTMLElement) {
  const existingHost = document.getElementById(helperPageAlertHostId)

  if (existingHost) {
    return existingHost
  }

  const host = document.createElement('div')
  host.id = helperPageAlertHostId
  host.className = 'helper-page-alert-host'

  const controlWrapper = buttonsRoot.parentElement
  controlWrapper?.parentElement?.insertBefore(host, controlWrapper)

  return host
}

function setHelperButtonLabel(button: HTMLButtonElement, text: string) {
  const label = button.querySelector<HTMLElement>('.crxjs-ai-reply-button-label')

  if (label) {
    label.textContent = text
    return
  }

  button.textContent = text
}

function setHelperButtonContent(button: HTMLButtonElement, text: string) {
  button.textContent = ''

  const icon = document.createElement('img')
  icon.className = 'crxjs-ai-reply-button-icon'
  icon.src = chrome.runtime.getURL('button1.svg')
  icon.alt = ''
  icon.setAttribute('aria-hidden', 'true')

  const label = document.createElement('span')
  label.className = 'crxjs-ai-reply-button-label'
  label.textContent = text

  button.append(icon, label)
}

function setHelperButtonState(state: HelperButtonState) {
  const wrapper = document.getElementById(helperButtonId)
  const button = wrapper?.querySelector<HTMLButtonElement>('button')
  const language = button?.dataset.helperLanguage as ExtensionLanguage | undefined

  if (!wrapper || !button) {
    return
  }

  wrapper.dataset.helperState = state
  button.disabled = state === 'loading'
  button.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false')
  button.classList.add('crxjs-ai-reply-button')

  if (state === 'loading') {
    setHelperButtonLabel(button, helperButtonLoadingText)
    return
  }

  setHelperButtonLabel(
    button,
    t(language ?? defaultExtensionLanguage, 'createReplyButton')
  )
}

function findGenerateButton(buttonsRoot: HTMLElement) {
  const previousSelectorButton =
    document.querySelector<HTMLButtonElement>(buttonGenSelector)

  if (previousSelectorButton && buttonsRoot.contains(previousSelectorButton)) {
    return previousSelectorButton
  }

  const generationButtonsRoot =
    findElementByClassPrefix(buttonsRoot, 'Generation-buttons-block__') ?? buttonsRoot

  return Array.from(
    generationButtonsRoot.querySelectorAll<HTMLButtonElement>('button')
  ).find((button) => getText(button) === 'Сгенерировать')
}

function createHelperButton(
  buttonGenWrapper: Element,
  onHelperClick: () => void,
  language: ExtensionLanguage
) {
  const wrapper = buttonGenWrapper.cloneNode(true) as HTMLElement
  wrapper.id = helperButtonId
  wrapper.classList.add('crxjs-ai-reply-button-wrapper')
  wrapper.dataset.helperState = 'idle'

  wrapper.querySelectorAll('[id]').forEach((element) => {
    element.removeAttribute('id')
  })
  wrapper.querySelectorAll('[role="img"]').forEach((element) => {
    element.remove()
  })

  const button = wrapper.querySelector('button')

  if (button) {
    button.type = 'button'
    button.disabled = false
    button.removeAttribute('aria-disabled')
    button.setAttribute('aria-busy', 'false')
    button.dataset.helperLanguage = language
    button.classList.add('crxjs-ai-reply-button')
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      onHelperClick()
    })
    setHelperButtonContent(button, t(language, 'createReplyButton'))
  }

  return wrapper
}

function createFallbackHelperButton(
  onHelperClick: () => void,
  language: ExtensionLanguage
) {
  const wrapper = document.createElement('div')
  wrapper.id = helperButtonId
  wrapper.className = 'helper-fallback-button-wrapper'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'helper-fallback-button crxjs-ai-reply-button'
  button.setAttribute('aria-busy', 'false')
  button.dataset.helperLanguage = language
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    onHelperClick()
  })
  setHelperButtonContent(button, t(language, 'createReplyButton'))

  wrapper.append(button)

  return wrapper
}

function isDrawerOpened(portal: HTMLElement) {
  return portal.textContent?.trim() !== ''
}

function syncHelperButton(
  portal: HTMLElement,
  onHelperClick: () => void,
  onWarning: (warning: HelperButtonWarning) => void,
  onPageAlertHost: (host: HTMLElement | null) => void,
  language: ExtensionLanguage
) {
  const buttonsRoot = document.querySelector<HTMLElement>(buttonsRootSelector)

  if (!buttonsRoot) {
    if (!isDrawerOpened(portal)) {
      removeHelperButton()
      document.getElementById(helperPageAlertHostId)?.remove()
      onPageAlertHost(null)
      return
    }

    return
  }

  onPageAlertHost(ensureHelperPageAlertHost(buttonsRoot))

  if (document.getElementById(helperButtonId)) {
    const button = document.querySelector<HTMLButtonElement>(`#${helperButtonId} button`)

    if (
      button &&
      button.dataset.helperLanguage !== language &&
      button.getAttribute('aria-busy') !== 'true'
    ) {
      button.dataset.helperLanguage = language
      setHelperButtonLabel(button, t(language, 'createReplyButton'))
    }

    return
  }

  const buttonGen = findGenerateButton(buttonsRoot)

  if (!buttonGen) {
    buttonsRoot.append(createFallbackHelperButton(onHelperClick, language))
    onWarning({
      title: t(language, 'warningFallbackButtonTitle'),
      message: t(language, 'warningGenerateButtonMissing')
    })
    return
  }

  const buttonGenWrapper = Array.from(buttonsRoot.children).find((child) =>
    child.contains(buttonGen)
  )

  if (!buttonGenWrapper) {
    buttonsRoot.append(createFallbackHelperButton(onHelperClick, language))
    onWarning({
      title: t(language, 'warningFallbackButtonTitle'),
      message: t(language, 'warningGenerateWrapperMissing')
    })
    return
  }

  buttonGenWrapper.after(createHelperButton(buttonGenWrapper, onHelperClick, language))
}

function App() {
  const [parsedInfo, setParsedInfo] = useState<ParsedInfo | null>(null)
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>('idle')
  const [generationText, setGenerationText] = useState('')
  const [generationMessage, setGenerationMessage] = useState('')
  const [generationDiagnostics, setGenerationDiagnostics] = useState('')
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [generationSeconds, setGenerationSeconds] = useState(0)
  const [helperButtonWarning, setHelperButtonWarning] =
    useState<HelperButtonWarning | null>(null)
  const [helperPageAlert, setHelperPageAlert] = useState<HelperPageAlert | null>(null)
  const [helperPageAlertHost, setHelperPageAlertHost] = useState<HTMLElement | null>(null)
  const [language, setLanguage] = useState<ExtensionLanguage>(defaultExtensionLanguage)
  const tr = (key: Parameters<typeof t>[1], params?: Parameters<typeof t>[2]) =>
    t(language, key, params)

  useEffect(() => {
    let isMounted = true

    void getExtensionConfig().then((config) => {
      if (isMounted) {
        setLanguage(config.language)
      }
    })

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) {
      if (areaName === 'sync' && changes.language) {
        void getExtensionConfig().then((config) => {
          setLanguage(config.language)
        })
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      isMounted = false
      chrome.storage.onChanged.removeListener(handleStorageChange)
    }
  }, [])

  useEffect(() => {
    if (generationStatus !== 'loading' || generationStartedAt === null) {
      return
    }

    const updateSeconds = () => {
      setGenerationSeconds(
        Math.max(0, Math.floor((Date.now() - generationStartedAt) / 1000))
      )
    }
    const interval = window.setInterval(updateSeconds, 1000)
    updateSeconds()

    return () => window.clearInterval(interval)
  }, [generationStartedAt, generationStatus])

  function resetGenerationState() {
    setGenerationStatus('idle')
    setGenerationText('')
    setGenerationMessage('')
    setGenerationDiagnostics('')
    setGenerationStartedAt(null)
    setGenerationSeconds(0)
    setHelperButtonState('idle')
  }

  function showPageAlert(message: string) {
    setHelperPageAlert({ message })
  }

  async function copyPageAlertMessage() {
    if (!helperPageAlert?.message) {
      return
    }

    await navigator.clipboard.writeText(helperPageAlert.message)
  }

  async function sendGeneration(review: ParsedInfo) {
    const startedAt = Date.now()

    setHelperPageAlert(null)
    setHelperButtonState('loading')
    setGenerationStatus('loading')
    setGenerationText('')
    setGenerationMessage('')
    setGenerationDiagnostics('')
    setGenerationStartedAt(startedAt)
    setGenerationSeconds(0)

    try {
      const result = await requestGeneration(review, language)
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))

      setGenerationStatus('succeeded')
      setGenerationText(result.text)
      setGenerationMessage(tr('generationFinished', { seconds }))
      setGenerationDiagnostics(formatDiagnostics(result.diagnostics, language))
      setGenerationSeconds(seconds)
      setGenerationStartedAt(null)
      setHelperButtonState('done')
      setHelperPageAlert(null)

      return result
    } catch (error: unknown) {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      const message =
        error instanceof DOMException && error.name === 'AbortError'
          ? tr('generationRequestTimedOut')
          : error instanceof Error
            ? error.message
            : tr('generationRequestFailed')

      setGenerationStatus('failed')
      setGenerationMessage(tr('generationFailedAfter', { seconds, message }))
      setGenerationDiagnostics('')
      setGenerationSeconds(seconds)
      setGenerationStartedAt(null)
      setHelperButtonState('idle')
      await savePopupAlert(message, language)
      showPageAlert(message)

      throw error
    }
  }

  async function handleDevSend() {
    if (!parsedInfo || generationStatus === 'loading') {
      return
    }

    await sendGeneration(parsedInfo).catch(() => undefined)
  }

  async function handleInsert() {
    if (!generationText) {
      setGenerationStatus('failed')
      setGenerationMessage(tr('noGeneratedText'))
      return
    }

    try {
      insertGeneratedText(generationText, language)
      setHelperButtonState('done')
      setGenerationMessage((currentMessage) =>
        [currentMessage, tr('generatedTextInserted')].filter(Boolean).join('\n')
      )
      setParsedInfo(null)
      resetGenerationState()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : tr('unknownInsertError')
      setGenerationStatus('failed')
      setGenerationMessage(message)
      setHelperButtonState('idle')
      await savePopupAlert(message, language)
      showPageAlert(message)
    }
  }

  useEffect(() => {
    const abortController = new AbortController()

    async function run() {
      try {
        console.log('[CRXJS] Waiting for #Portal-modal-extend-info...')

        const portal = await waitForElement<HTMLElement>('#Portal-modal-extend-info', {
          observeRoot: document.documentElement,
          timeoutMs: 45_000,
          signal: abortController.signal
        })

        console.log('[CRXJS] Portal found') // portal

        const handleHelperClick = () => {
          void (async () => {
            try {
              const parsed = parseFeedbackInfo(portal)
              const config = await getExtensionConfig()

              if (config.is_dev_mode) {
                resetGenerationState()
                setParsedInfo(parsed)
                return
              }

              setHelperPageAlert(null)
              setHelperButtonState('loading')
              const result = await requestGeneration(parsed, language)
              insertGeneratedText(result.text, language)
              setHelperButtonState('done')
              setHelperPageAlert(null)
            } catch (error: unknown) {
              const message =
                error instanceof DOMException && error.name === 'AbortError'
                  ? tr('generationRequestTimedOut')
                  : error instanceof Error
                    ? error.message
                    : tr('generationRequestFailed')
              setHelperButtonState('idle')
              await savePopupAlert(message, language)
              showPageAlert(message)
            }
          })()
        }

        const handleWarning = (warning: HelperButtonWarning) => {
          setHelperButtonWarning((currentWarning) => currentWarning ?? warning)
        }
        const handlePageAlertHost = (host: HTMLElement | null) => {
          setHelperPageAlertHost(host)

          if (!host) {
            setHelperPageAlert(null)
          }
        }
        let syncAnimationFrame: number | null = null
        let resumeObserverTimeout: number | null = null
        let mutationWindowStartedAt = Date.now()
        let mutationCountInWindow = 0
        let isObserverPaused = false

        const sync = () => {
          syncHelperButton(
            portal,
            handleHelperClick,
            handleWarning,
            handlePageAlertHost,
            language
          )
        }

        const scheduleSync = () => {
          if (syncAnimationFrame !== null) {
            return
          }

          syncAnimationFrame = window.requestAnimationFrame(() => {
            syncAnimationFrame = null
            sync()
          })
        }

        // Now you can observe inside this portal if drawer content appears later.
        const observer = new MutationObserver((mutations) => {
          if (isObserverPaused || !hasNonHelperMutation(mutations)) {
            return
          }

          const now = Date.now()

          if (now - mutationWindowStartedAt > portalMutationBurstWindowMs) {
            mutationWindowStartedAt = now
            mutationCountInWindow = 0
          }

          mutationCountInWindow += mutations.length

          if (mutationCountInWindow > portalMutationBurstLimit) {
            isObserverPaused = true
            console.warn(
              '[CRXJS] Portal mutation burst detected; pausing helper sync briefly',
              {
                mutationCountInWindow,
                portalMutationBurstWindowMs,
                portalMutationPauseMs
              }
            )
            resumeObserverTimeout = window.setTimeout(() => {
              resumeObserverTimeout = null
              isObserverPaused = false
              mutationWindowStartedAt = Date.now()
              mutationCountInWindow = 0
              scheduleSync()
            }, portalMutationPauseMs)
            return
          }

          scheduleSync()
        })

        observer.observe(portal, {
          childList: true,
          subtree: true
        })

        sync()

        abortController.signal.addEventListener('abort', () => {
          observer.disconnect()
          if (syncAnimationFrame !== null) {
            window.cancelAnimationFrame(syncAnimationFrame)
          }
          if (resumeObserverTimeout !== null) {
            window.clearTimeout(resumeObserverTimeout)
          }
          removeHelperButton()
          document.getElementById(helperPageAlertHostId)?.remove()
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        console.warn('[CRXJS] Portal was not found in time:', error)
      }
    }

    run()

    return () => {
      abortController.abort()
    }
  }, [language])

  return (
    <>
      {helperPageAlert && helperPageAlertHost
        ? createPortal(
            <div className='helper-page-alert' role='alert'>
              <button
                type='button'
                className='helper-page-alert-close'
                aria-label={tr('closeAlert')}
                onClick={() => setHelperPageAlert(null)}>
                ×
              </button>
              <div className='helper-page-alert-content'>
                <strong>{tr('messagesTitle')}</strong>
                <p>{helperPageAlert.message}</p>
              </div>
              <div className='helper-page-alert-actions'>
                <button
                  type='button'
                  className='helper-page-alert-copy'
                  onClick={() => {
                    void copyPageAlertMessage()
                  }}>
                  {tr('copy')}
                </button>
                <button
                  type='button'
                  className='helper-page-alert-ok'
                  onClick={() => setHelperPageAlert(null)}>
                  {tr('ok')}
                </button>
              </div>
            </div>,
            helperPageAlertHost
          )
        : null}

      {parsedInfo && (
        <div
          className='helper-modal-backdrop'
          onClick={() => {
            setParsedInfo(null)
            resetGenerationState()
          }}>
          <div
            className='helper-modal'
            role='dialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}>
            <div className='helper-modal-header helper-modal-toolbar'>
              <div className='helper-modal-actions'>
                <button
                  type='button'
                  className='helper-modal-primary'
                  disabled={generationStatus === 'loading'}
                  onClick={handleDevSend}>
                  {tr('send')}
                </button>
                <button
                  type='button'
                  disabled={generationStatus === 'loading' || !generationText}
                  onClick={handleInsert}>
                  {tr('insert')}
                </button>
              </div>
              <button
                type='button'
                className='helper-modal-close'
                onClick={() => {
                  setParsedInfo(null)
                  resetGenerationState()
                }}>
                {tr('close')}
              </button>
            </div>

            {generationStatus === 'loading' ? (
              <div className='helper-modal-loading'>
                <div className='helper-modal-spinner' aria-hidden='true' />
                <p>{tr('generationRequestRunning')}</p>
                <strong>{generationSeconds} sec</strong>
              </div>
            ) : (
              <>
                <dl className='helper-modal-data'>
                  <div>
                    <dt>name:</dt>
                    <dd>{parsedInfo.name}</dd>
                  </div>
                  <div>
                    <dt>product_details:</dt>
                    <dd>{parsedInfo.product_details.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>feedback_reasons:</dt>
                    <dd>{parsedInfo.feedback_reasons.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>rating:</dt>
                    <dd>{parsedInfo.rating}</dd>
                  </div>
                  <div>
                    <dt>product_name:</dt>
                    <dd>{parsedInfo.product_name}</dd>
                  </div>
                  <div>
                    <dt>product_url:</dt>
                    <dd>{parsedInfo.product_url}</dd>
                  </div>
                  <div>
                    <dt>vendor_code_1:</dt>
                    <dd>{parsedInfo.vendor_code_1}</dd>
                  </div>
                  <div>
                    <dt>vendor_code_2:</dt>
                    <dd>{parsedInfo.vendor_code_2}</dd>
                  </div>
                  <div>
                    <dt>colors:</dt>
                    <dd>{parsedInfo.colors}</dd>
                  </div>
                  <div>
                    <dt>size:</dt>
                    <dd>{parsedInfo.size}</dd>
                  </div>
                </dl>

                {generationText ? (
                  <div className='helper-modal-result'>
                    <h3>{tr('generatedResponse')}</h3>
                    <p>{generationText}</p>
                  </div>
                ) : null}

                {generationMessage ? (
                  <div
                    className={
                      generationStatus === 'failed'
                        ? 'helper-modal-status helper-modal-status--error'
                        : 'helper-modal-status helper-modal-status--success'
                    }>
                    <p>{generationMessage}</p>
                  </div>
                ) : null}

                {generationDiagnostics ? (
                  <div className='helper-modal-diagnostics'>
                    <h3>{tr('diagnostics')}</h3>
                    <pre>{generationDiagnostics}</pre>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      )}

      {helperButtonWarning && (
        <div
          className='helper-modal-backdrop'
          onClick={() => setHelperButtonWarning(null)}>
          <div
            className='helper-modal helper-modal--warning'
            role='alertdialog'
            aria-modal='true'
            onClick={(event) => event.stopPropagation()}>
            <div className='helper-modal-header'>
              <h2>{helperButtonWarning.title}</h2>
              <button
                type='button'
                className='helper-modal-close'
                onClick={() => setHelperButtonWarning(null)}>
                {tr('close')}
              </button>
            </div>

            <div className='helper-modal-message'>
              <p>{helperButtonWarning.message}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default App
