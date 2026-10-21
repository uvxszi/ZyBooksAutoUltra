# Validation

Version 1.7.1 changes only workspace expansion and embedded-element control placement, plus release labels and documentation. It received a JavaScript syntax check and package integrity check; no browser tests were rerun for this small layout update. The results below are from 1.7.0.

## Version 1.7.0

Eight Node regression groups passed for the 1.7 changes:

- The empty `<think>…</think>` prefix emitted by WebLLM with thinking disabled is accepted for both topic and answer responses.
- Complete leading reasoning blocks and JSON fences are handled at every possible stream split. Reasoning is never shown as an answer. Literal tags, quotes, Unicode, tabs, and newlines inside the answer are preserved.
- Truncated, malformed, and wrong-schema responses remain rejected with readable errors that do not include raw model output.
- The actual local worker entry point, with a mocked model engine, produces a usable topic through the parser and preserves no-thinking, streaming, and default output-limit settings.
- Clear answer preserves the question and topic.
- Clearing a streaming answer cancels that request and prevents late chunks or a late result from refilling the box.
- A new answer can run after clearing. Clearing an old answer does not cancel a separate topic request.
- The DeepSeek setup section is removed, LM Studio API hints remain, privacy body text is 16px, and release identifiers are updated.

Four existing streaming regression groups also passed again: JSON escape handling, fragmented SSE/UTF-8 transport, optional/default output limits, and non-streaming API responses.

JavaScript syntax, manifest and HTML file references, catalogue runtime files, WebAssembly validity, and release ZIP contents are checked separately. The marquee PNG is verified as 1400 × 560 pixels, 8 bits per RGB channel, with no alpha channel, and was visually inspected.

## Browser validation and limitations

The last successful complete MV3 browser fixture run was version 1.6.0: 14 checks passed, with no uncaught errors. It covered the model catalogue, settings, private credential storage, page panel, element picker, streaming, topic context, Stop, model unloading, Turn Off, and extension reload handling. Model workers and API responses were mocked; no model weights were downloaded.

Additional browser launches were blocked when automatic approval review reached its usage limit. The 1.7 controller checks use mocked DOM and extension messaging boundaries, and do not replace a fresh full-browser test. No additional screenshots were created for 1.7.

Real Qwen 3.5 GPU inference and authenticated zyBooks activity pages have not been retested here. The parsing regression reproduces the documented WebLLM output prefix; model quality, GPU capacity, and course-specific layouts still require testing on the user's setup.
