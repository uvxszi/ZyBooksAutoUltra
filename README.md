# ZyBooks AutoUltra 1.7.1

Made by uvxszi. An independent Chrome/Chromium extension for zyBooks, including Vivaldi. It provides participation automation and a manual AI question workspace. It is not affiliated with zyBooks or Wiley.

## Install or update

For a store installation, use the Install button on this extension’s Chrome Web Store listing. Browser-managed updates apply automatically; refresh open zyBooks tabs after an update.

For an unpacked installation:

1. Extract the extension ZIP into a permanent folder.
2. Open `chrome://extensions`, `vivaldi://extensions`, or `edge://extensions`.
3. Enable Developer mode, choose **Load unpacked**, and select the folder containing `manifest.json`.
4. Refresh your zyBooks tab. Open the extension toolbar button or the **ZU · AutoUltra** button at the bottom right.

When updating an unpacked copy, replace the files in the same folder, click **Reload** on the extension card, then refresh both zyBooks and any open Models tabs. Keeping the folder and extension identity preserves browser-stored settings and downloads. A stale page shows a Refresh button instead of throwing repeated extension-context errors.

## Ask a question

The **AI question workspace** starts collapsed. Click its heading to expand or collapse it. **Open question workspace** in the toolbar popup opens the page panel, expands the workspace, and focuses the question box.

Paste a question into the page panel, select a model in **Models**, and click **Ask model**. Answers stream into the answer box when supported. A small status line shows the stage, elapsed time, character count, and token count when available. **Stop** cancels generation and keeps partial text.

- **Paste** adds clipboard text. If browser clipboard access is unavailable, use Ctrl+V.
- **Copy** copies the question with the optional topic prefix.
- **Clear** empties the question. It does not erase the topic preference or uninstall models.
- **Include topic context** enables an editable prefix. The star button asks your selected model to identify the topic from a limited page excerpt.
- **Copy answer** copies the displayed response.
- **Clear answer** empties only the answer box. If an answer is still streaming, it stops that request so later text cannot refill the box. It leaves your question, topic, model settings, and clipboard unchanged.

The AI workspace never fills website answers or submits challenges/labs. Automatic challenge/lab solving, bulk question detection, and AI prompt formatting are not included.

## Copy one page element

Click **COPY ELEMENT FROM PAGE**, hover to highlight text or a dropdown, then click it. Text or the dropdown’s available choices are appended to your prompt without selecting an answer on the page. Escape, clicking an unsuitable area, clicking Cancel selection, or waiting 20 seconds cancels the picker.

For an embedded activity on another origin, the popup may show **Allow embedded elements**. This requests access only to the origins used by that page’s frames. **Disallow embedded elements** removes those optional grants. Required access to `learn.zybooks.com` remains until the extension is removed or its site access is changed in the browser. Copying text from unsupported editors may require ordinary selection and paste.

## Models

Open **Models**, choose a catalogue model or add an API card, and select the card you want to use. Creating a local card does not download weights. Click **Install Model to Browser** separately; installation shows progress and can be canceled. Local inference needs WebGPU, supported GPU features, enough GPU memory, and enough disk space.

The fixed local catalogue includes Qwen 2.5 Coder 0.5B, 1.5B, 3B, and 7B; Qwen 2.5 7B; Llama 3.1 8B; Hermes 3 Llama 3.1 8B; Mistral 7B v0.3; Gemma 2 9B; Phi 3.5 Mini 3.8B; Llama 2 13B; and Qwen 3.5 9B. Each entry links to its source and shows weight-download and GPU-memory estimates. Estimates exclude some cache/context overhead. Larger parameter counts do not guarantee better answers.

For LM Studio, start its local server and use `http://localhost:1234/v1/chat/completions` as the usual endpoint. Enter the model ID shown in LM Studio and a key if the server requires authentication. Other compatible APIs need their full chat-completions endpoint, model ID, key when required, and supported JSON response format. Remote endpoints must use HTTPS; HTTP is allowed for the local machine.

### Output length

**Limit output tokens is off by default**, including for older cards that previously had an implicit limit. The extension omits the API output-limit parameter and uses WebLLM’s unlimited-generation setting. The model still stops at its end token or available context, and an API server may impose its own limit. There is no fixed generation-duration cutoff; Stop remains available.

Enable the optional toggle to set an integer limit from 1 to 1,048,576. Local context capacity is separately selectable. A very large response is subject to a 16-million-character transport safeguard.

### Memory and storage

**Turn Off** cancels work, removes page controls, and terminates the local model worker to release its memory. The **Unload after inactivity** setting defaults to 5 minutes and is available in the popup and Models page. Choose 1–60 minutes or keep loaded until Turn Off. Browser suspension can delay timers; the check also runs when the Models page becomes visible. API servers manage their own model memory.

Model downloads remain installed after memory unloading. **Remove download** removes cached weights while keeping the card. Deleting the last card using a model also removes that model’s download.

The Models page shows the extension’s storage origin and installation guidance. Downloads live in the current browser profile’s IndexedDB, not the extracted extension folder. On Windows, Vivaldi’s profile is usually under `%LOCALAPPDATA%\Vivaldi\User Data\Default` or `Profile N`. Find the actual **Profile Path** on `vivaldi://version`, `chrome://version`, or `edge://version`; IndexedDB entries use the extension ID. Browser storage layout can vary. Uninstalling the extension removes its browser-managed data.

## Participation automation

**Page automation** opens expanded by default. **Run activities** or **Run this page** processes supported participation activities through DOM events, without moving the mouse. Supported adapters cover revealed answers, radio choices, 2x animations, term matching, supported array games, string slicing, inheritance-tree exploration, and Run examples. Completed activities are skipped; unknown layouts are reported for review.

The default pause between problems is 300 ms plus a random 100–500 ms. Feedback and animation waits add to that delay. Animations can run alongside the participation queue. **Stop run** stops further actions; it cannot undo a submitted response or an already-playing animation.

Chapter continuation is optional. Crossing into the next chapter requires its separate toggle. Optional chapters/sections can stop continuation. Missing LMS confirmation produces a warning after the configured wait instead of blocking forever. Unconfirmed activities can still stop continuation for review.

## Privacy and support

See **Privacy & support** in the popup or Models page for the full data notice. There is no developer telemetry or automatic diagnostic upload. Local AI inference runs in this browser; configured API providers receive prompts only when you ask the model or use the topic helper. Model downloads contact Hugging Face and its delivery services.

For support, use the **Support** section of the extension’s Chrome Web Store listing. Include the extension version, browser version, activity type, expected behavior, and actual behavior. Do not post API keys or private course/account information.

If requested for troubleshooting, enable **Developer mode** in the extension, choose **Pick activity**, and use **Copy diagnostics** or **Save report as a file**. Review reports before sharing. Reports include activity content and run information, with common secrets, current form values, scripts, and URL attributes removed. Redaction is not a guarantee that the remaining activity text contains no personal information. The extension does not send reports automatically.

Course-specific layouts and authenticated zyBooks pages can differ from the browser fixtures used during development. See `TESTING.md` for validation scope and limitations.
