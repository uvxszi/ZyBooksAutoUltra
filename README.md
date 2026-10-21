# ZyBooks AutoUltra · Firefox 1.7.1

Firefox Desktop edition, adapted from the supplied Chrome 1.7.1 ZIP. Requires Firefox 142 or later. The original Chrome package is unchanged.

## Try it now

1. Open `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on**.
3. Select the Firefox ZIP, or extract it and select `manifest.json`.
4. Open or refresh your zyBooks page. Allow site access if Firefox asks.

A temporary add-on is removed when Firefox restarts. For permanent installation in regular Firefox, submit the ZIP to Mozilla Add-ons for signing (listed or unlisted), then install the signed XPI Mozilla provides. This package is unsigned; renaming a ZIP to XPI does not sign it. The stable add-on ID is `zybooks-autoultra@uvxszi`; keep it for future Firefox updates.

## Features

Supported participation automation, chapter continuation, the collapsible question workspace, Copy Element, streaming answers, topic context, Clear answer, local-model cards, API cards, and memory unloading are retained. The AI question workspace starts closed and expands when you click its heading or **Open question workspace** in the toolbar popup.

Open **Models** to configure AI. Creating a card does not download model weights. Local inference requires WebGPU, shader-f16, and sufficient GPU memory. Availability depends on Firefox, your operating system, graphics hardware, and drivers. If Firefox reports missing GPU support, connect an API model, including a local LM Studio server at `http://localhost:1234/v1/chat/completions`. Enter the model ID shown by your server.

Firefox stores its own settings, encrypted API cards, and model downloads. Chrome/Vivaldi settings and downloaded models do not automatically migrate. The Models page shows the Firefox storage origin and profile-location guidance. Remove model downloads using the card controls, rather than deleting profile files manually.

## Firefox differences

- Uses a Firefox background event page instead of a Chrome service worker.
- Uses the Promise-based `browser` API throughout the extension-owned code, including the injected element picker.
- Declares Firefox data-handling permissions for website content and API credentials. Local inference stays on device; optional API requests go to the configured endpoint.
- Keeps all JavaScript and WebAssembly libraries packaged. Only model data is downloaded when installation is requested.
- Desktop Firefox is the target; this build does not claim Android support.

See `privacy.html` for data handling and `TESTING.md` for verification details. A public privacy-policy URL and any review/source-code materials required by Mozilla must be supplied when publishing. This build has not been submitted or signed.

Made by uvxszi. Not affiliated with zyBooks or Wiley.
