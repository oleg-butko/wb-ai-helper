import Logo from '@/assets/crx.svg'
import { useEffect, useState } from 'react'
import { waitForElement } from '../utils/waitForElement'
import './App.css'

const helperButtonId = 'crxjs-helper-button'

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

const buttonsRootSelector =
	'#Portal-modal-extend-info > div > div > div > div > div > div > div > div > div > div > form > div:nth-child(2) > div'

const buttonGenSelector =
	'#Portal-modal-extend-info > div > div > div > div > div > div > div > div > div > div > form > div > div > div:nth-child(3) > div > div > button'

const textSelector = 'span[data-name="Text"]'

function getText(element: Element) {
	return element.textContent?.trim() ?? ''
}

function getTextValues(root: ParentNode) {
	return Array.from(root.querySelectorAll(textSelector))
		.map(getText)
		.filter(Boolean)
}

function findReasonsRoot(root: ParentNode) {
	return Array.from(root.querySelectorAll('div')).find((element) =>
		Array.from(element.classList).some((className) =>
			className.startsWith(
				'Extended-feedback-item-info-content__reasons-block__'
			)
		)
	)
}

function findFeedbackInfoRoot(root: ParentNode) {
	return (
		Array.from(root.querySelectorAll('div')).find((element) =>
			Array.from(element.classList).some((className) =>
				className.startsWith(
					'Extended-feedback-item-info-content__feedback-info-block__'
				)
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
	return Array.from(element.classList).some((className) =>
		className.startsWith(prefix)
	)
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
	const productRoot = findElementByClassPrefix(
		root,
		'Extended-article-info-card__info__'
	)

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
			hasClassPrefix(
				element,
				'Extended-article-info-card__vendor-code-container-item__'
			)
	)
	const vendorCodes = vendorCodeElements.map(getText)

	const dividerElements = Array.from(productRoot.querySelectorAll('div')).filter(
		(element) =>
			hasClassPrefix(element, 'Extended-article-info-card__divider__')
	)
	const externalDividerElements = dividerElements.filter(
		(element) =>
			!hasAncestorWithClassPrefix(
				element,
				'Extended-article-info-card__vendor-code-container-item__'
			)
	)
	const dividerValues = externalDividerElements
		.map((divider) =>
			divider.nextElementSibling
				? getText(divider.nextElementSibling)
				: ''
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

			if (
				classes.some((className) =>
					className.startsWith('Rating--not-active__')
				)
			) {
				return rating
			}

			return rating
		}, 0)
}

function parseFeedbackInfo(root: ParentNode): ParsedInfo {
	const infoRoot = findFeedbackInfoRoot(root)
	const firstText = infoRoot.querySelector(textSelector)
	const productDetailsRoot = infoRoot.querySelector(
		'div[data-testid="Product-item-details"]'
	)
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
		product_details: productDetailsRoot
			? getTextValues(productDetailsRoot).filter((value) => value !== 'Ещё')
			: [],
		feedback_reasons: feedbackReasons,
		rating: parseRating(infoRoot),
		...parseProductInfo(root)
	}
	const missingFields = Object.entries(parsedInfo).flatMap(([field, value]) => {
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

function createHelperButton(
	buttonGenWrapper: Element,
	onHelperClick: () => void
) {
	const wrapper = buttonGenWrapper.cloneNode(true) as HTMLElement
	wrapper.id = helperButtonId

	wrapper.querySelectorAll('[id]').forEach((element) => {
		element.removeAttribute('id')
	})

	const button = wrapper.querySelector('button')
	const spans = button ? Array.from(button.querySelectorAll('span')) : []
	const label =
		spans.find((span) => span.className.includes('caption__')) ??
		spans[spans.length - 1]

	if (button) {
		button.type = 'button'
		button.disabled = false
		button.removeAttribute('aria-disabled')
		button.addEventListener('click', (event) => {
			event.preventDefault()
			event.stopPropagation()
			onHelperClick()
		})
	}

	if (label) {
		label.textContent = 'Helper'
	} else if (button) {
		button.textContent = 'Helper'
	}

	return wrapper
}

function syncHelperButton(portal: HTMLElement, onHelperClick: () => void) {
	const buttonsRoot = document.querySelector<HTMLElement>(buttonsRootSelector)
	const buttonGen = portal.querySelector<HTMLButtonElement>(buttonGenSelector)

	if (!buttonsRoot || !buttonGen) {
		removeHelperButton()
		return
	}

	if (document.getElementById(helperButtonId)) {
		return
	}

	const buttonGenWrapper = Array.from(buttonsRoot.children).find((child) =>
		child.contains(buttonGen)
	)

	if (!buttonGenWrapper) {
		return
	}

	buttonGenWrapper.after(createHelperButton(buttonGenWrapper, onHelperClick))
}

function App() {
	const [show, setShow] = useState(false)
	const [portalFound, setPortalFound] = useState(false)
	const [parsedInfo, setParsedInfo] = useState<ParsedInfo | null>(null)

	const toggle = () => setShow((prev) => !prev)

	useEffect(() => {
		const abortController = new AbortController()

		async function run() {
			try {
				console.log('[CRXJS] Waiting for #Portal-modal-extend-info...')

				const portal = await waitForElement<HTMLElement>(
					'#Portal-modal-extend-info',
					{
						observeRoot: document.documentElement,
						timeoutMs: 45_000,
						signal: abortController.signal
					}
				)

				console.log('[CRXJS] Portal found') // portal

				setPortalFound(true)

				const handleHelperClick = () => {
					setParsedInfo(parseFeedbackInfo(portal))
				}

				// Now you can observe inside this portal if drawer content appears later.
				const observer = new MutationObserver(() => {
					console.log('[CRXJS] Portal content changed')
					syncHelperButton(portal, handleHelperClick)
				})

				observer.observe(portal, {
					childList: true,
					subtree: true
				})

				syncHelperButton(portal, handleHelperClick)

				abortController.signal.addEventListener('abort', () => {
					observer.disconnect()
					removeHelperButton()
				})
			} catch (error) {
				if (
					error instanceof DOMException &&
					error.name === 'AbortError'
				) {
					return
				}
				console.warn('[CRXJS] Portal was not found in time:', error)
			}
		}

		run()

		return () => {
			abortController.abort()
		}
	}, [])

	return (
		<div className='popup-container'>
			{show && (
				<div
					className={`popup-content ${show ? 'opacity-100' : 'opacity-0'}`}>
					<h1>HELLO CRXJS</h1>

					<p>Portal status: {portalFound ? 'found' : 'waiting...'}</p>
				</div>
			)}

			<button className='toggle-button' onClick={toggle}>
				<img src={Logo} alt='CRXJS logo' className='button-icon' />
			</button>

			{parsedInfo && (
				<div className='helper-modal-backdrop'>
					<div className='helper-modal' role='dialog' aria-modal='true'>
						<div className='helper-modal-header'>
							<h2>Parsed info</h2>
							<button
								type='button'
								className='helper-modal-close'
								onClick={() => setParsedInfo(null)}>
								Close
							</button>
						</div>

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
					</div>
				</div>
			)}
		</div>
	)
}

export default App
