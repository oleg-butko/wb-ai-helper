export type ExtensionLanguage = 'ru' | 'en'

export const defaultExtensionLanguage: ExtensionLanguage = 'ru'

const translations = {
	ru: {
		alertCopied: 'Текст сообщения скопирован в буфер обмена.',
		alertEmpty: 'Сообщения от API и действия расширения будут показаны здесь.',
		apiAccess: 'Доступ к API',
		apiBaseUrlEmpty:
			'API base URL пустой. Укажите его в Dev Mode или настройках расширения.',
		apiKey: 'API ключ',
		apiKeyCheckFailed: 'Проверка API ключа не прошла.',
		apiKeyCheckFailedWithMessage: 'Проверка API ключа не прошла: {message}',
		apiKeyCheckSucceededWithMessage: 'Проверка API ключа прошла: {message}',
		apiKeyCheckTimedOut: 'Проверка API ключа заняла больше 15 секунд.',
		apiKeyEmpty: 'Введите API ключ перед проверкой.',
		apiKeySaved: 'API ключ сохранён.',
		apiKeyUpdatedHistory: 'API ключ обновлён в настройках popup.',
		apiKeyValidWithQuota:
			'API ключ действителен. Осталось генераций: {count}.',
		apiKeyValidWithUnknownQuota:
			'API ключ действителен. Осталось генераций: неизвестно.',
		apiRespondedWithStatus: 'API ответил HTTP {status}.',
		answerTextareaMissing: 'Поле ответа не найдено в drawer.',
		checkApiKey: 'Проверить API ключ',
		checking: 'Проверяем…',
		checkingApiKey: 'Проверяем API ключ. Таймаут — 15 секунд.',
		close: 'Закрыть',
		closeAlert: 'Закрыть сообщение',
		configLoadFailed: 'Не удалось загрузить настройки расширения.',
		configNotLoaded: 'Настройки ещё не загружены.',
		copy: 'Копировать',
		createReplyButton: 'Сгенерировать ответ',
		devConfigSaved: 'Dev настройки сохранены.',
		devConfigUpdatedHistory: 'Dev настройки обновлены из popup.',
		devMode: 'Dev Mode',
		diagnostics: 'Диагностика',
		extensionAssistant: 'Ассистент расширения',
		generatedResponse: 'Сгенерированный ответ',
		generatedTextInserted: 'Сгенерированный текст вставлен в поле ответа.',
		generationFailed: 'Генерация не удалась.',
		generationFailedAfter:
			'Генерация не удалась через {seconds} сек.\n{message}',
		generationFailedHistory: 'Генерация не удалась: {message}',
		generationFinished: 'Генерация завершена за {seconds} сек.',
		generationRequestFailed: 'Запрос генерации не удался.',
		generationRequestFailedWithStatus:
			'Запрос генерации не удался, HTTP {status}.',
		generationRequestRunning: 'Запрос генерации выполняется…',
		generationRequestSucceededWithQuota:
			'Генерация выполнена успешно. Осталось генераций: {count}.',
		generationRequestSucceededWithUnknownQuota:
			'Генерация выполнена успешно. Осталось генераций: неизвестно.',
		generationRequestTimedOut: 'Запрос генерации занял больше 60 секунд.',
		history: 'История',
		insert: 'Вставить',
		items: '{count} записей',
		language: 'Язык',
		languageEnglish: 'Английский',
		languageRussian: 'Русский',
		loadingConfig: 'Загрузка настроек…',
		localConfig: 'Локальные настройки',
		messagesTitle: 'Ошибка AI-ответа',
		noDiagnostics: 'Диагностика не вернулась.',
		noGeneratedText: 'Нет сгенерированного текста для вставки.',
		noHistory: 'Действий расширения пока нет.',
		ok: 'Ok',
		options: 'Настройки',
		save: 'Сохранить',
		saveDevConfig: 'Сохранить Dev настройки',
		send: 'Отправить',
		unexpectedGenerationResponse: 'API вернул ответ в неожиданном формате.',
		unknownInsertError: 'Не удалось вставить сгенерированный текст.',
		emptyApiBaseUrlBackground:
			'API_BASE_URL пустой. Откройте popup расширения и укажите его в Dev Mode.',
		emptyApiKeyBackground:
			'API ключ пустой. Откройте popup расширения и введите API ключ в настройках.',
		warningFallbackButtonTitle: '✨ AI-ответ добавлен в резервном режиме',
		warningGenerateButtonMissing:
			'Расширение не нашло встроенную кнопку «Сгенерировать» по ожидаемой структуре страницы. Кнопка «✨ AI-ответ» добавлена с простым стилем, но расширение нужно обновить под новый HTML Wildberries.',
		warningGenerateWrapperMissing:
			'Расширение нашло кнопку «Сгенерировать», но не смогло определить ее контейнер. Кнопка «✨ AI-ответ» добавлена с простым стилем, но расширение нужно обновить под новый HTML Wildberries.'
	},
	en: {
		alertCopied: 'Alert text was copied to clipboard.',
		alertEmpty: 'Messages from API and extension actions will appear here.',
		apiAccess: 'API access',
		apiBaseUrlEmpty:
			'API base URL is empty. Set it in Dev Mode or extension defaults.',
		apiKey: 'API key',
		apiKeyCheckFailed: 'API key check failed.',
		apiKeyCheckFailedWithMessage: 'API key check failed: {message}',
		apiKeyCheckSucceededWithMessage: 'API key check succeeded: {message}',
		apiKeyCheckTimedOut: 'API key check timed out after 15 seconds.',
		apiKeyEmpty: 'Enter API key before checking it.',
		apiKeySaved: 'API key was saved.',
		apiKeyUpdatedHistory: 'API key was updated in popup options.',
		apiKeyValidWithQuota: 'API key is valid. Generations left: {count}.',
		apiKeyValidWithUnknownQuota:
			'API key is valid. Generations left: unknown.',
		apiRespondedWithStatus: 'API responded with HTTP {status}.',
		answerTextareaMissing: 'Answer textarea was not found in the drawer.',
		checkApiKey: 'Check API key',
		checking: 'Checking…',
		checkingApiKey: 'Checking API key. Timeout is 15 seconds.',
		close: 'Close',
		closeAlert: 'Close alert',
		configLoadFailed: 'Could not load extension config.',
		configNotLoaded: 'Config is not loaded yet.',
		copy: 'Copy',
		createReplyButton: 'Generate a response',
		devConfigSaved: 'Dev config was saved.',
		devConfigUpdatedHistory: 'Dev config was updated from popup.',
		devMode: 'Dev Mode',
		diagnostics: 'Diagnostics',
		extensionAssistant: 'Extension assistant',
		generatedResponse: 'Generated response',
		generatedTextInserted: 'Generated text was inserted into the answer field.',
		generationFailed: 'Generation request failed.',
		generationFailedAfter:
			'Generation failed after {seconds} seconds.\n{message}',
		generationFailedHistory: 'Generation failed: {message}',
		generationFinished: 'Generation finished in {seconds} seconds.',
		generationRequestFailed: 'Generation request failed.',
		generationRequestFailedWithStatus:
			'Generation request failed with HTTP {status}.',
		generationRequestRunning: 'Generation request is running…',
		generationRequestSucceededWithQuota:
			'Generation request succeeded. Generations left: {count}.',
		generationRequestSucceededWithUnknownQuota:
			'Generation request succeeded. Generations left: unknown.',
		generationRequestTimedOut: 'Generation request timed out after 60 seconds.',
		history: 'History',
		insert: 'Insert',
		items: '{count} items',
		language: 'Language',
		languageEnglish: 'English',
		languageRussian: 'Russian',
		loadingConfig: 'Loading config…',
		localConfig: 'Local config',
		messagesTitle: 'AI response error',
		noDiagnostics: 'No diagnostics returned.',
		noGeneratedText: 'No generated text to insert yet.',
		noHistory: 'No extension actions recorded yet.',
		ok: 'Ok',
		options: 'Options',
		save: 'Save',
		saveDevConfig: 'Save Dev Config',
		send: 'Send',
		unexpectedGenerationResponse:
			'Generation response from API has unexpected format.',
		unknownInsertError: 'Could not insert generated text.',
		emptyApiBaseUrlBackground:
			'API_BASE_URL is empty. Open extension popup and set it in Dev Mode.',
		emptyApiKeyBackground:
			'API key is empty. Open extension popup and enter API key in Options.',
		warningFallbackButtonTitle: '✨ AI-ответ added in fallback mode',
		warningGenerateButtonMissing:
			'The extension did not find the built-in “Сгенерировать” button in the expected page structure. The “✨ AI-ответ” button was added with simple styling, but the extension should be updated for the new Wildberries HTML.',
		warningGenerateWrapperMissing:
			'The extension found the “Сгенерировать” button, but could not detect its container. The “✨ AI-ответ” button was added with simple styling, but the extension should be updated for the new Wildberries HTML.'
	}
} as const

export type TranslationKey = keyof typeof translations.ru

export function normalizeExtensionLanguage(
	value: unknown
): ExtensionLanguage {
	return value === 'en' || value === 'ru' ? value : defaultExtensionLanguage
}

export function t(
	language: ExtensionLanguage,
	key: TranslationKey,
	params: Record<string, string | number> = {}
): string {
	return Object.entries(params).reduce(
		(message, [paramKey, paramValue]) =>
			message.split(`{${paramKey}}`).join(String(paramValue)),
		translations[language][key] as string
	)
}
