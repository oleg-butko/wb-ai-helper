# Problem-solution changelog

## Add popup history/options/dev-mode tabs

Problem: The extension popup still showed the CRXJS/Vite demo screen, so users had no place to enter an extension API key, check it, or see recent extension actions. Development-only config controls also needed to stay hidden from normal production users.

Solution: Replaced the demo popup with History and Options tabs for all users, plus a Dev Mode tab only when `is_dev_mode` is present in config. The popup stores config in `chrome.storage.sync`, stores recent action history in `chrome.storage.local`, checks API keys with a 15-second timeout and spinner, and shows dismissible alert messages from extension/API actions.

## Recover AI answer button when drawer button markup changes

Problem: Wildberries changed the drawer action-button structure, so the old positional selector for the built-in `Сгенерировать` button returned `null` and the extension stopped adding `AI ответ`.

Solution: Find the built-in generation button by stable text/structure inside the known button root, keep the old selector only as a compatibility fallback, add a simple fallback `AI ответ` button when the native button wrapper cannot be cloned, and show a warning modal that the extension needs an update for the changed page HTML.

## Add build-specific extension config defaults

Problem: The extension had no background service worker and no persisted install-time config, so there was no reliable way to initialize or manually reset API settings per build type.

Solution: Added an MV3 service worker, `chrome.storage.sync` config reset helper, explicit production/develop build scripts, build-mode-specific defaults, UUIDv7 `user_id` generation, and a manual `self.resetConfig()` service-worker console hook.

## Parse feedback rating without generated class hashes

Problem: The feedback drawer renders its five rating stars with generated class suffixes, so matching the complete class names would break when the site rebuilds its styles.

Solution: Find the rating root and star states by their stable class prefixes. Count active stars as one and inactive stars as zero, cap parsing at five slots, and show the resulting 0-5 number in the parsed-data modal.

## Parse article metadata by structure and class prefixes

Problem: Product metadata uses generated class suffixes, and one divider belongs to the vendor-code layout rather than to the color and size values.

Solution: Locate the article-info and vendor-code elements by stable class prefixes. Exclude dividers nested under vendor-code items, then map the remaining divider siblings to colors and size in document order.

## Search the complete drawer for article metadata

Problem: The product parser searched only the feedback-info sub-block, but the article-info card is its sibling under the drawer portal, so every product field was empty.

Solution: Keep feedback and rating parsing scoped to the feedback-info block, but pass the complete drawer portal to the product parser so it can find the sibling article-info card.

## Exclude drawer control text from product details

Problem: The drawer's `Ещё` control text was collected as a product detail even though it is interface noise rather than feedback data.

Solution: Remove the exact trimmed `Ещё` value from `product_details` after text extraction without changing parsing for other fields.
