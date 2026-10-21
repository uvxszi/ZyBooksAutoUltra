# Firefox validation

The Firefox build is derived from the user-supplied ZyBooks-AutoUltra-v1.7.1.zip (SHA-256 adf046eb7ec4458297b52fd7fc17ceaa34edd0a984420dd8b4c56c5674ba8406).

Eight checks passed in Firefox 157.0.1 on Windows, in an isolated headless profile:

- Temporary installation of the actual Firefox manifest.
- Models page initialization, all 12 catalogue entries, and Firefox storage guidance.
- Background event-page messaging and settings persistence.
- Encrypted API-card storage and retrieval through Firefox IndexedDB and AES-GCM.
- Loading the bundled WebLLM module worker and reading its model-cache status without downloading weights.
- Injecting the actual content scripts into a local dummy activity and completing Show answer → fill → Check using DOM events.
- The question workspace starts collapsed and expands through the extension's normal prompt message.
- Toolbar popup initialization and embedded-element control ordering.

The local activity was served by a test-only localhost server. Its permission was granted only in the disposable test profile. No real course was modified. The delivered manifest retains the original zyBooks site scope and optional endpoint/frame access.

All extension JavaScript receives syntax checks; packaging validates the manifest, required file references, and ZIP integrity. Chrome test results are not presented as Firefox results.

Limitations: the headless Firefox instance did not expose a WebGPU adapter. No weights were downloaded and actual local-model inference was not exercised. API requests to a real provider, authenticated zyBooks course layouts, Firefox 142 itself, and other operating systems were not tested. Local AI remains conditional on WebGPU, shader-f16, GPU memory, and drivers. Android is outside this build's supported scope.

The package is unsigned. Mozilla signing is required for permanent installation in regular Firefox. It has not been submitted to Mozilla or reviewed for store acceptance.
