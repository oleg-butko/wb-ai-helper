export function waitForElement<T extends Element>(
  selector: string,
  options: {
    root?: ParentNode
    observeRoot?: Node
    timeoutMs?: number
    signal?: AbortSignal
  } = {}
): Promise<T> {
  const {
    root = document,
    observeRoot = document.documentElement,
    timeoutMs = 30_000,
    signal,
  } = options

  const existing = root.querySelector<T>(selector)

  if (existing) {
    return Promise.resolve(existing)
  }

  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    let timeoutId: number | undefined

    const cleanup = () => {
      observer.disconnect()

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }

      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    const observer = new MutationObserver(() => {
      const element = root.querySelector<T>(selector)

      if (element) {
        cleanup()
        resolve(element)
      }
    })

    observer.observe(observeRoot, {
      childList: true,
      subtree: true,
    })

    signal?.addEventListener('abort', onAbort)

    if (timeoutMs > 0) {
      timeoutId = window.setTimeout(() => {
        cleanup()
        reject(new Error(`Element not found: ${selector}`))
      }, timeoutMs)
    }
  })
}
