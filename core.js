/* ZyBooks AutoUltra — all activity operations use ordinary DOM events. */
(() => {
  "use strict";
  if (globalThis.ZBUltra) return;
  const VERSION = "1.7.1";
  const DEFAULTS = Object.freeze({ enabled: true, developerMode: false, autoChapter: false, nextChapter: false, stopOptional: true,
    participation: true, short: true, choice: true, animation: true, matching: true, tools: true,
    modelIdleMinutes: 5,
    includeTopic: false, topicLine: 'Programming: ',
    baseMs: 300, jitterMinMs: 100, jitterMaxMs: 500, feedbackMs: 6000, animationMs: 180000,
    afterPageMs: 5000, lmsWaitMs: 10000 });
  const S = Object.freeze({
    resource: ".content-resource",
    activity: ".interactive-activity-container",
    question: ".question-set-question",
    short: ".short-answer-question",
    choice: ".multiple-choice-question",
    animation: ".animation-controls",
    matching: ".definition-match-payload",
    array: ".array-games",
    interaction: ".string-slice, .content-resource.zyde, .content-resource:has(.inheritanceTree-classLabel)",
    feedback: ".zb-explanation, .definition-match-explanation",
    answer: ".forfeit-answer",
    input: 'input:not([type]), input[type="text"], input[type="number"], textarea',
    controls: 'button, input, textarea, select, [role="button"], [role="radio"], [role="checkbox"], math-field, [contenteditable="true"]'
  });
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  const norm = text => String(text ?? "").replace(/\s+/g, " ").trim();
  const visible = el => !!el?.isConnected && !el.closest('[hidden], [inert], [aria-hidden="true"]') &&
    el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
  const enabled = el => !!el && !el.disabled && !el.matches(':disabled, .disabled, [aria-disabled="true"]') && !el.closest('[inert]');
  const usable = el => visible(el) && enabled(el);
  const name = el => norm(el?.getAttribute("aria-label") || el?.textContent || el?.getAttribute("title"));
  const button = (root, selector, label) => all(root, selector).find(usable) ||
    all(root, 'button, [role="button"]').find(el => usable(el) && label.test(name(el)));
  const container = el => el.closest(S.activity) || el.closest(S.resource) || el;
  function inScope(el) {
    return visible(el) && !el.closest('.edit, .edit-question, .challenge, .lab, .zyLab, .exam, [data-activity-type="challenge"], [data-activity-type="lab"]') &&
      !/\/(?:exam|exams|assessments)(?:\/|$)/i.test(location.pathname);
  }
  function completed(root, activity = false) {
    const scope = activity ? container(root) : root;
    return all(scope, activity ? '[aria-label="Activity completed"]' : '[aria-label="Question completed"]')
      .some(visible) || (!activity && feedback(root) === "correct");
  }
  function feedback(root) {
    const boxes = all(root, S.feedback).filter(visible);
    if (boxes.some(el => el.classList.contains("correct"))) return "correct";
    if (boxes.some(el => el.classList.contains("incorrect"))) return "incorrect";
    for (const el of boxes.flatMap(box => all(box, ".message"))) {
      if (/^correct[!.]?$/i.test(norm(el.textContent))) return "correct";
      if (/^incorrect[!.]?$/i.test(norm(el.textContent))) return "incorrect";
    }
    return null;
  }
  function signature(root) {
    return all(root, S.feedback).map(el => `${el.className}|${el.textContent}`).join("|");
  }
  function clamp(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
  }
  function settings(raw = {}) {
    const out = { ...DEFAULTS };
    for (const key of ["enabled", "developerMode", "autoChapter", "nextChapter", "stopOptional", "participation", "short", "choice", "animation", "matching", "tools", "includeTopic"]) if (typeof raw[key] === "boolean") out[key] = raw[key];
    if(typeof raw.topicLine==='string')out.topicLine=raw.topicLine.replace(/[\r\n]/g,' ').slice(0,160);
    for (const key of ["baseMs", "jitterMinMs", "jitterMaxMs"]) out[key] = clamp(raw[key] ?? out[key], 0, 10000, out[key]);
    out.jitterMaxMs = Math.max(out.jitterMinMs, out.jitterMaxMs);
    out.feedbackMs = clamp(raw.feedbackMs ?? out.feedbackMs, 1000, 30000, out.feedbackMs);
    out.animationMs = clamp(raw.animationMs ?? out.animationMs, 10000, 600000, out.animationMs);
    out.afterPageMs = clamp(raw.afterPageMs ?? out.afterPageMs, 0, 120000, out.afterPageMs);
    out.lmsWaitMs = clamp(raw.lmsWaitMs ?? out.lmsWaitMs, 10000, 180000, out.lmsWaitMs);
    out.modelIdleMinutes = clamp(raw.modelIdleMinutes ?? out.modelIdleMinutes, 0, 60, out.modelIdleMinutes);
    return out;
  }
  function delayMs(opts, random = Math.random) {
    return opts.baseMs + opts.jitterMinMs + Math.floor(random() * (opts.jitterMaxMs - opts.jitterMinMs + 1));
  }
  function discover(doc = document) {
    const items = [];
    const resources = all(doc, S.resource);
    const add = (kind, root) => {
      if (!inScope(root)) return;
      const resource = root.closest(S.resource) || container(root);
      const identity = resource.getAttribute("content_resource_id") || resource.getAttribute("content_resource_guid") ||
        `position-${resources.indexOf(resource)}`;
      const index = ["short", "choice"].includes(kind) ? all(resource, S[kind]).indexOf(root) : 0;
      items.push({ kind, root, key: `${identity}:${kind}:${index}` });
    };
    all(doc, S.short).forEach(root => add("short", root));
    all(doc, S.choice).forEach(root => add("choice", root));
    all(doc, S.animation).forEach(el => add("animation", el.closest(S.resource) || el.parentElement));
    all(doc, S.matching).forEach(root => add("matching", root));
    all(doc, S.array).forEach(root => add("array", root));
    all(doc, S.interaction).filter(root => root.closest(`${S.activity}.participation`)).forEach(root => add("interaction", root));
    return items.sort((a, b) => a.root.compareDocumentPosition(b.root) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1);
  }
  class Halt extends Error {}
  class Skip extends Error {}
  class Runner {
    constructor(onUpdate = () => {}) {
      this.onUpdate = onUpdate;
      this.state = { running: false, phase: "Ready", current: "", finished: 0, already: 0, skipped: 0, played: 0, actions: 0, animations: 0 };
      this.log = [];
      this.outcomes = [];
      this.options = settings();
    }
    snapshot() { return { ...this.state, logs: this.log.slice(-12), options: this.options }; }
    emit() { this.onUpdate(this.snapshot()); }
    note(message, kind = "info") {
      this.log.push({ time: new Date().toISOString(), kind, message });
      if (this.log.length > 150) this.log.shift();
      this.emit();
    }
    stop(reason = "Stopped") {
      if (!this.state.running) return;
      this.stopReason = reason;
      this.controller?.abort();
      this.state.phase = "Stopping";
      this.emit();
    }
    guard(root) {
      if (this.controller?.signal.aborted) throw new Halt(this.stopReason || "Stopped");
      if (location.href !== this.url) throw new Halt("Stopped because the page changed");
      if (root && !root.isConnected) throw new Skip("Activity was replaced while running. Run again to rescan.");
      if (this.state.actions >= 1500) throw new Halt("Stopped at the action limit");
    }
    async sleep(ms) {
      this.guard();
      const signal = this.controller.signal;
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(new Halt(this.stopReason || "Stopped")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
        signal.addEventListener("abort", abort, { once: true });
      });
      this.guard();
    }
    async wait(predicate, timeout = this.options.feedbackMs, root) {
      const start = Date.now();
      do {
        this.guard(root);
        const result = predicate();
        if (result) return result;
        await this.sleep(100);
      } while (Date.now() - start < timeout);
      return null;
    }
    click(el) {
      this.guard(el);
      if (!usable(el)) throw new Skip("A needed control is hidden or disabled.");
      this.state.actions++;
      el.click();
    }
    key(el, key) {
      this.guard(el);
      this.state.actions++;
      el.dispatchEvent(new KeyboardEvent("keydown", { key, code: key === " " ? "Space" : key, bubbles: true, cancelable: true }));
    }
    async gap() { await this.sleep(delayMs(this.options)); }
    async verdict(root, action) {
      const before = signature(root);
      let changed = false;
      let lastChange = 0;
      const relevant = node => node.nodeType === 1 && (node.matches(S.feedback) || node.closest(S.feedback) || node.querySelector(S.feedback));
      const observer = new MutationObserver(records => {
        if (records.some(r => relevant(r.target.nodeType === 1 ? r.target : r.target.parentElement) ||
          [...r.addedNodes, ...r.removedNodes].some(relevant))) { changed = true; lastChange = Date.now(); }
      });
      observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
      try {
        await action();
        // Do not mistake a previous choice's feedback for this choice's result.
        await this.sleep(180);
        return await this.wait(() => {
          const result = feedback(root);
          if (result && (changed || signature(root) !== before) && Date.now() - lastChange >= 100) return result;
          return null;
        }, this.options.feedbackMs, root);
      } finally { observer.disconnect(); }
    }
    async short(root) {
      const fields = all(root, S.input).filter(el => usable(el) && !el.readOnly);
      if (root.querySelector('math-field, .zb-math-live, .MathJax, mjx-container')?.closest(".input") ||
          fields.length !== 1) throw new Skip("This answer editor needs a specific adapter; copy its diagnostic report.");
      let answers = all(root, S.answer).filter(visible);
      for (let attempt = 0; !answers.length && attempt < 4; attempt++) {
        const show = button(root, ".show-answer-button", /^show answer$/i);
        if (!show) throw new Skip("Show answer was not found.");
        this.click(show);
        await this.sleep(180);
        await this.wait(() => all(root, S.answer).some(visible) || all(root, ".show-again").some(visible), 1800, root);
        answers = all(root, S.answer).filter(visible);
      }
      if (!answers.length) throw new Skip("No revealed answer appeared after four attempts.");
      // The spans are alternatives for one field, not separate fields. Preserve whitespace exactly.
      const values = [...new Set(answers.filter(el => !el.querySelector('mjx-container, .MathJax, math')).map(el => el.textContent))];
      if (!values.length) throw new Skip("The answer uses a math renderer; copy diagnostics for an adapter.");
      for (const value of values.slice(0, 5)) {
        this.guard(root);
        const field = all(root, S.input).find(el => usable(el) && !el.readOnly);
        if (!field) throw new Skip("The answer field disappeared.");
        const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(field, value);
        if (field.value !== value && field.type === "number") throw new Skip("The revealed answer cannot be entered as a plain number.");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
        await this.sleep(120);
        const check = await this.wait(() => button(root, ".check-button", /^check$/i), undefined, root);
        if (!check) throw new Skip("Check was not available.");
        const result = await this.verdict(root, () => this.click(check));
        if (result === "correct") return "finished";
        if (!result) throw new Skip("Check did not produce fresh feedback before the timeout.");
        await this.gap();
      }
      throw new Skip("Revealed alternatives were not accepted; copy diagnostics.");
    }
    async choice(root) {
      const initial = all(root, 'input[type="radio"], [role="radio"]').filter(visible);
      if (!initial.length || initial.length > 20) throw new Skip("Radio choices could not be identified reliably.");
      for (let i = 0; i < initial.length; i++) {
        const options = all(root, 'input[type="radio"], [role="radio"]').filter(visible);
        const option = options[i];
        if (options.length !== initial.length || !option) throw new Skip("The choice list changed during the attempt.");
        if (!enabled(option)) continue;
        if ((option.checked || option.getAttribute("aria-checked") === "true") && feedback(root) === "incorrect") continue;
        // Re-clicking an already checked native radio does not fire input; request its normal input handler.
        const wasChecked = option.checked;
        const result = await this.verdict(root, () => {
          this.click(option);
          if (wasChecked) option.dispatchEvent(new Event("input", { bubbles: true }));
          const check = button(root, ".check-button", /^check$/i);
          if (check) this.click(check);
        });
        if (result === "correct") return "finished";
        if (!result) throw new Skip("A choice did not produce fresh feedback before the timeout.");
        await this.gap();
      }
      throw new Skip("No choice was confirmed correct.");
    }
    async animation(root) {
      const controls = root.querySelector(S.animation);
      const speed = all(controls, '.speed-control input[type="checkbox"], .speed-control [role="checkbox"]').find(usable);
      if (!speed) throw new Skip("The 2x speed control was not recognized.");
      if (!(speed.checked || speed.getAttribute("aria-checked") === "true")) {
        this.click(speed);
        if (!await this.wait(() => speed.checked || speed.getAttribute("aria-checked") === "true", 2000, root))
          throw new Skip("2x speed did not switch on.");
      }
      const begin = Date.now();
      let started = false;
      let plays = 0;
      while (Date.now() - begin < this.options.animationMs) {
        this.guard(root);
        if (completed(root, true)) return "finished";
        if (all(controls, ".play-button.rotate-180").some(visible)) {
          if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return "finished";
          return "played";
        }
        const pause = button(controls, 'button[aria-label="Pause"]', /^pause$/i);
        if (pause) { await this.sleep(250); continue; }
        const start = button(controls, ".start-button", /^start$/i);
        const play = button(controls, 'button[aria-label="Play"]', /^play$|^next$|^continue$/i);
        const next = start || play;
        if (next) {
          if (start && started) {
            if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return "finished";
            return "played";
          }
          if (++plays > 100) throw new Skip("Animation reached the playback action limit.");
          this.click(next);
          started = true;
          const changed = await this.wait(() => completed(root, true) || !next.isConnected ||
            button(controls, 'button[aria-label="Pause"]', /^pause$/i) ||
            all(controls, ".play-button.rotate-180").some(visible) || !enabled(next), this.options.feedbackMs, root);
          if (!changed) throw new Skip("The animation did not acknowledge playback.");
          await this.gap();
        } else await this.sleep(250);
      }
      throw new Skip("Animation timed out. Increase its timeout or copy diagnostics.");
    }
    async moveTerm(item, target, root) {
      let grabbed = false;
      try {
        item.focus({ preventScroll: true });
        this.key(item, "Enter");
        grabbed = true;
        if (item.getAttribute("aria-selected") !== "true") throw new Skip("Matching did not acknowledge the keyboard grab.");
        // Moving with arrows may reorder the bank or traverse occupied replacement buckets.
        // Transfer only to this known, empty destination, then let the site's keyboard-release
        // handler commit the normal model update. Never drop over an existing correct term.
        if (!target.matches('.term-bank') && target.querySelector('.definition-match-term'))
          throw new Skip("The matching destination is occupied.");
        this.guard(root);
        target.appendChild(item);
        this.key(item, "Enter");
        grabbed = false;
        await this.sleep(300);
      } finally {
        // Escape cancels any unfinished move, even if Stop was pressed mid-move.
        if (grabbed && item.isConnected) item.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
    }
    async matching(root) {
      const bank = root.querySelector(".term-bank.zb-sortable-container");
      const rows = all(root, ".definition-row");
      if (!bank || !rows.length || rows.length > 40) throw new Skip("Matching layout was not recognized.");
      const token = el => ({ id: el.getAttribute("data-id"), text: norm(el.textContent) });
      const findTerm = (key, scope = root) => all(scope, ".definition-match-term").find(el =>
        key.id ? el.getAttribute("data-id") === key.id : norm(el.textContent) === key.text);
      // One bounded reset can restore terms lost by the site's widget. Restore confirmed
      // matches immediately; never reset a healthy widget merely because an attempt is wrong.
      if (all(root, ".definition-match-term").length < rows.length) {
        const saved = rows.map((row, index) => ({ index, row, item: row.querySelector('.definition-match-term') }))
          .filter(x => x.item && feedback(x.row) === 'correct').map(x => ({ index: x.index, text: norm(x.item.textContent) }));
        const reset = button(root, '.reset-button', /^reset$/i);
        if (!reset) throw new Skip("Missing matching terms; Reset is unavailable.");
        this.click(reset);
        if (!await this.wait(() => all(bank, '.definition-match-term').length >= rows.length, this.options.feedbackMs, root))
          throw new Skip("Terms are still missing after one recovery reset.");
        for (const entry of saved) {
          const term = findTerm(entry, bank), row = rows[entry.index];
          if (!term || await this.verdict(row, () => this.moveTerm(term, row.querySelector('.term-bucket'), root)) !== 'correct')
            throw new Skip("A previously correct match could not be restored after reset.");
        }
        this.note("Recovered missing matching terms and restored confirmed matches.");
      }
      // Keep completed matches in place; return only incorrect or ungraded selections to the bank.
      for (const row of rows) if (feedback(row) !== "correct") {
        const selected = row.querySelector(".term-bucket .definition-match-term");
        if (selected) {
          await this.moveTerm(selected, bank, root);
          if (!await this.wait(() => !feedback(row), this.options.feedbackMs, root)) throw new Skip("Matching feedback did not clear.");
        }
      }
      for (const row of rows) {
        if (feedback(row) === "correct") continue;
        const bucket = row.querySelector(".term-bucket.zb-sortable-container");
        if (!bucket) throw new Skip("A matching destination was not recognized.");
        const ids = all(bank, ".definition-match-term").map(token);
        let matched = false;
        for (const id of ids) {
          const term = findTerm(id, bank);
          if (!term || !bank.contains(term)) continue;
          const result = await this.verdict(row, () => this.moveTerm(term, bucket, root));
          if (result === "correct") { matched = true; break; }
          const rejected = findTerm(id);
          if (rejected) {
            await this.moveTerm(rejected, bank, root);
            if (!await this.wait(() => !feedback(row), this.options.feedbackMs, root))
              throw new Skip("Matching feedback did not clear after returning the term.");
          }
          if (!result) throw new Skip("Matching did not produce feedback.");
          await this.gap();
        }
        if (!matched) throw new Skip("No available term was confirmed correct.");
        await this.gap();
      }
      return "finished";
    }
    setValue(field, value) {
      this.guard(field);
      const proto = field.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(field, value);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    async interaction(root) {
      if (root.querySelector('.inheritanceTree-classLabel')) {
        const item=all(root,'.inheritanceTree-classLabel').find(usable);
        if(!item)throw new Skip('Inheritance tree class buttons were not available.');
        this.click(item);
      } else if (root.matches('.string-slice')) {
        const start = root.querySelector('input[aria-label="The start index for slicing"]');
        const end = root.querySelector('input[aria-label="The end index for slicing"]');
        if (!usable(start) || !usable(end)) throw new Skip("Slicing input controls were not recognized.");
        // Use valid integer indices, not random characters that could make the example invalid.
        const value = start.value === '2' ? '1' : '2';
        this.setValue(start, value);
        if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return 'finished';
        this.setValue(end, end.value === '5' ? '4' : '5');
      } else if (root.matches('.zyde')) {
        const run = button(root, '.run-button-container button', /^run$/i);
        if (!run) throw new Skip("This example's Run control is unavailable.");
        this.click(run);
      } else throw new Skip("This interactive tool needs an adapter.");
      if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return 'finished';
      throw new Skip("The interaction was made, but completion was not confirmed.");
    }
    async array(root) {
      const btn = text => button(root, '.__no_selector__', text);
      const kind = all(root, 'button').some(el => /^store value$/i.test(name(el))) ? 'max' :
        all(root, 'button').some(el => /^increment$/i.test(name(el))) ? 'negative' :
        all(root, 'button').some(el => /^swap values$/i.test(name(el))) ? 'largest' :
        all(root, 'button').some(el => /^swap$/i.test(name(el))) ? 'sort' : null;
      if (!kind) throw new Skip("This array game is not supported yet.");
      const cells = () => all(root, '.array [role="listitem"], .array .value-icon-container')
        .map(el => ({ el, span: el.querySelector('span.default, span.highlight, span.success, span.clickable, span.disabled') || el.querySelector('span'),
          checkbox: el.querySelector('input[type="checkbox"]') }))
        .map(x => ({ ...x, value: /^-?\d+(?:\.\d+)?$/.test(norm(x.span?.textContent)) ? Number(norm(x.span.textContent)) : null }));
      const state = () => cells().map(x => `${x.value}:${x.span?.className}`).join('|') + '|' + norm(root.querySelector('.max-container')?.textContent);
      const start = btn(/^start$/i);
      if (start) { const before = state(); this.click(start); if (!await this.wait(() => state() !== before, undefined, root)) throw new Skip("Array game did not start."); }
      for (let step = 0; step < 150; step++) {
        this.guard(root);
        if (completed(root, true)) return 'finished';
        const aria = norm(root.querySelector('.assistive-text')?.textContent);
        if (/^correct\b/i.test(aria) || all(root, '.success').some(el => /correct, sorted/i.test(norm(el.textContent)))) {
          if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return 'finished';
          throw new Skip("Array game reports Correct, but saved completion was not confirmed.");
        }
        if (/^incorrect\b/i.test(aria)) throw new Skip("Array game reports an incorrect result; reset it and run again.");
        const list = cells(), shown = list.filter(x => x.value !== null);
        let action;
        if (kind === 'sort') {
          if (shown.length !== list.length) throw new Skip("The sorting values are not all visible.");
          let i = shown.findIndex((x, index) => index < shown.length - 1 && x.value > shown[index + 1].value);
          if (i < 0) {
            if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return 'finished';
            throw new Skip("Array is sorted, but saved completion was not confirmed.");
          }
          const chosen = shown.filter(x => x.checkbox?.checked);
          for (const x of chosen) this.click(x.checkbox);
          for (const x of [shown[i], shown[i + 1]]) {
            const control = x.checkbox || x.span;
            this.click(control); await this.sleep(120);
          }
          action = btn(/^swap$/i);
        } else {
          if (shown.length !== (kind === 'largest' ? 2 : 1)) throw new Skip("The current array values are ambiguous.");
          if (kind === 'max') {
            const text = norm(root.querySelector('.max-container > span')?.textContent);
            const currentMax = /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : -Infinity;
            if (shown[0].value > currentMax) action = btn(/^store value$/i);
          } else if (kind === 'negative' && shown[0].value < 0) action = btn(/^increment$/i);
          else if (kind === 'largest' && shown[0].value > shown[1].value) action = btn(/^swap values$/i);
        }
        if (action) {
          const before = state(); this.click(action);
          if (!await this.wait(() => state() !== before || !enabled(action), undefined, root)) throw new Skip("The array action was not acknowledged.");
          await this.sleep(180);
        }
        if (kind !== 'sort') {
          const next = btn(/^next value$/i);
          if (!next) {
            if (await this.wait(() => completed(root, true), this.options.feedbackMs, root)) return 'finished';
            throw new Skip("Next value is unavailable and completion is unconfirmed.");
          }
          const before = state(); this.click(next);
          if (!await this.wait(() => state() !== before || completed(root, true), undefined, root)) throw new Skip("The next array value did not appear.");
        }
        await this.gap();
      }
      throw new Skip("Array game reached its action limit.");
    }
    async run(rawOptions) {
      if (this.state.running) return;
      this.options = settings(rawOptions);
      this.controller = new AbortController();
      this.url = location.href;
      this.outcomes = [];
      this.log = [];
      this.state = { running: true, phase: "Running", current: "Scanning this page", finished: 0, already: 0, skipped: 0, played: 0, actions: 0, animations: 0 };
      this.note("Started. The run covers supported activities currently loaded on this page.");
      const done = new Set();
      const animations = new Set();
      let animationError = null;
      const process = async (item, label) => {
        let outcome, reason = '';
        try { outcome = completed(item.root, !['short', 'choice'].includes(item.kind)) ? 'already' : await this[item.kind](item.root); }
        catch (error) {
          if (error instanceof Halt) throw error;
          outcome = 'skipped'; reason = error instanceof Skip ? error.message : 'Unexpected adapter error. Diagnostics are available in developer mode.';
        }
        this.state[outcome]++;
        this.outcomes.push({ key: item.key, kind: item.kind, outcome, reason });
        if (outcome === 'skipped') this.note(`${label}: ${reason}`, 'warning');
        else if (outcome === 'played') this.note('Animation finished playing; saved completion was not confirmed.', 'warning');
        else this.note(`${label}: ${outcome === 'already' ? 'already complete' : 'correct / complete'}.`);
      };
      let idle = 0;
      try {
        while (idle < 2) {
          this.guard();
          if (animationError) throw animationError;
          const item = discover().find(x => (x.kind === 'animation' || this.options.participation) && this.options[['array','interaction'].includes(x.kind) ? 'tools' : x.kind] && !done.has(x.key));
          if (!item) { if (!animations.size) idle++; this.state.current = animations.size ? 'Finishing animations in the background' : ''; this.emit(); await this.sleep(650); continue; }
          idle = 0;
          done.add(item.key);
          this.state.current = `${{ short: "Revealed answer", choice: "Multiple choice", animation: "Animation", matching: "Term matching", array: "Array game", interaction: "Interactive example" }[item.kind]} · item ${done.size}`;
          this.emit();
          if (item.kind === 'animation') {
            const task = process(item, this.state.current).catch(error => { animationError = error; this.stop(error.message); })
              .finally(() => { animations.delete(task); this.state.animations = animations.size; this.emit(); });
            animations.add(task); this.state.animations = animations.size;
          } else await process(item, this.state.current);
          await this.gap();
        }
        this.state.phase = done.size ? "Finished scan" : "No supported activities found";
      } catch (error) {
        this.state.phase = error instanceof Halt ? error.message : "Stopped after an unexpected error";
        this.note(this.state.phase, "warning");
      } finally {
        this.controller.abort();
        await Promise.allSettled([...animations]);
        this.state.running = false;
        this.state.current = "";
        this.emit();
      }
    }
  }
  function redact(value) {
    return String(value ?? "")
      .replace(/https?:\/\/[^\s<>"']+/gi, "[URL removed]")
      .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removed]")
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token removed]")
      .replace(/\b(?:bearer|token|password|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "[credential removed]");
  }
  function safeHTML(root, limit = 36000) {
    if (!root) return { html: "", truncated: false };
    // Build a new inert tree with an attribute allowlist; never export scripts, URLs or field values.
    const inert = document.implementation.createHTMLDocument("");
    let budget = 1400;
    let clipped = false;
    function copy(node) {
      if (--budget < 0) { clipped = true; return null; }
      if (node.nodeType === Node.TEXT_NODE) return inert.createTextNode(redact(node.textContent).slice(0, 1800));
      if (node.nodeType !== Node.ELEMENT_NODE || node.id === "zb-ultra-host" ||
          node.matches('script, style, noscript, iframe, object, embed, link, meta, input[type="hidden"], input[type="password"]')) return null;
      const tag = node.tagName.toLowerCase();
      const out = inert.createElement(tag === "svg" || tag === "path" ? "span" : tag);
      for (const attr of node.attributes) if (/^(?:class|id|role|type|name|disabled|readonly|hidden|tabindex|for|aria-label|aria-labelledby|aria-describedby|aria-selected|aria-checked|aria-disabled|aria-hidden|aria-live|aria-invalid)$/.test(attr.name)) {
        out.setAttribute(attr.name, redact(attr.value).slice(0, 240));
      }
      if (node.matches('input[type="checkbox"], input[type="radio"]')) out.setAttribute("data-current-checked", String(node.checked));
      if (node.matches('input, textarea, [contenteditable="true"], math-field')) {
        if (tag !== "input") out.textContent = "[editable content removed]";
      } else {
        for (const child of node.childNodes) { const safe = copy(child); if (safe) out.appendChild(safe); }
      }
      return out;
    }
    const html = copy(root)?.outerHTML || "";
    return { html: html.slice(0, limit), truncated: clipped || html.length > limit };
  }
  function diagnostics(runner, selected = null) {
    const items = discover();
    const skipped = runner.outcomes.find(x => x.outcome === "skipped");
    const unknown = all(document, S.activity).find(el => inScope(el) && !items.some(item => el.contains(item.root)));
    const target = selected?.isConnected ? selected : items.find(x => x.key === skipped?.key)?.root || unknown || items[0]?.root;
    const clean = safeHTML(target);
    const counts = Object.fromEntries(Object.entries(S).map(([key, selector]) => [key, all(document, selector).length]));
    return JSON.stringify({
      report: "ZyBooks AutoUltra diagnostic", version: VERSION, created: new Date().toISOString(),
      host: location.hostname, routeShape: location.pathname.split("/").map(p => /^\d+$/.test(p) ? ":number" :
        /^(?:zybook|chapter|section|library|)$/.test(p) ? p : ":redacted").join("/"),
      browser: navigator.userAgent, options: runner.options,
      privacy: "Local report. No cookies, storage, page URLs, scripts or form values. Activity text may remain; review before sharing.",
      state: { ...runner.state }, selectorCounts: counts,
      inventory: items.slice(0, 120).map((item, index) => ({ index: index + 1, kind: item.kind, classes: item.root.className,
        completed: completed(item.root, ["animation", "matching"].includes(item.kind)) })),
      outcomes: runner.outcomes.map(({ key, ...rest }) => rest), logs: runner.log.slice(-60),
      selected: target ? { tag: target.tagName, classes: target.className,
        controls: all(target, S.controls).slice(0, 100).map(el => ({ tag: el.tagName, type: el.getAttribute("type"),
          role: el.getAttribute("role"), classes: el.className, label: redact(el.matches("input,textarea") ? el.getAttribute("aria-label") || "" : name(el)).slice(0, 160),
          visible: visible(el), enabled: enabled(el) })), ...clean } : null,
      frames: all(document, "iframe").map(() => "Embedded frame (contents not inspected)"),
      nextStep: "Use this report to troubleshoot the selected activity."
    }, null, 2);
  }
  globalThis.ZBUltra = Object.freeze({ VERSION, DEFAULTS, S, Runner, discover, settings, delayMs, diagnostics, safeHTML });
})();
