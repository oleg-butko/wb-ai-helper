import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './views/App.tsx'

console.log('[CRXJS] content script loaded', {
	readyState: document.readyState,
	bodyExists: Boolean(document.body),
	portalElExists: Boolean(document.querySelector('#Portal-modal-extend-info'))
})

const container = document.createElement('div')
container.id = 'crxjs-app'
document.body.appendChild(container)
createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>
)
