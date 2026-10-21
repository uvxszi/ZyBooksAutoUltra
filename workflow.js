(() => {
  'use strict';
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const shown = el => !!el?.isConnected && el.getClientRects().length > 0 && !el.closest('[hidden], [aria-hidden="true"]');
  const enabled = el => shown(el) && !el.matches(':disabled, .disabled, [aria-disabled="true"]');
  function routeInfo(url = location.href) {
    try {
      const u = new URL(url, location.href), m = u.pathname.match(/^\/zybook\/([^/]+)\/chapter\/(\d+)\/section\/(\d+)\/?$/);
      return m ? { origin: u.origin, book: m[1], chapter: Number(m[2]), section: Number(m[3]), path: u.pathname } : null;
    } catch { return null; }
  }
  function nextSection() {
    const current = routeInfo();
    const links = all(document, 'nav[aria-label="next section"] a[href], .section-nav.next a[href]').filter(shown);
    const targets = links.map(link => ({ link, route: routeInfo(link.href) })).filter(x => x.route && x.route.origin === current?.origin && x.route.book === current.book);
    return targets.length === 1 ? targets[0] : null;
  }
  function optionalTarget(target) {
    if(!target)return false;
    const route=target.route;
    const candidates=[target.link,...all(document,'a[href]').filter(a=>{const r=routeInfo(a.href);return r&&r.book===route.book&&r.chapter===route.chapter;})];
    return candidates.some(a=>{
      const container=a.closest('[data-optional],.chapter-item,.chapter-row,.chapter-entry,.toc-chapter,.section-item')||a;
      return container.getAttribute('data-optional')==='true'||/\boptional\b/i.test([text(a),a.getAttribute('aria-label'),a.getAttribute('title'),text(container.querySelector('.optional,.optional-label,.chapter-optional'))].filter(Boolean).join(' '));
    });
  }
  function submissionState() {
    const cards = all(document, '.assignment-completion-summary-card').filter(shown);
    const linked = cards.map(card => {
      const status = card.querySelector('.submission-messaging-container');
      const message = text(status);
      const submit = all(card, 'button').find(el => enabled(el) && /^submit to\s/i.test(text(el)));
      const numbers = value => value.replace(/,/g, '').match(/\d+(?:\.\d+)?/g)?.join('|') || '';
      const earned = numbers(text(card.querySelector('.points-completed-text')));
      const submitted = numbers(message.split(/submitted to/i)[0]);
      const error = /submission failed|browse to this assignment through|trouble submitting/i.test(message);
      const busy = !!status?.querySelector('[aria-label="Submitting..."], .zb-progress-circular') || /submitting/i.test(message);
      const success = /submitted to\s+\S|successfully submitted|submitted successfully/i.test(message) && !error && !busy && (!earned || !submitted || submitted === earned);
      return { linked: !!submit || /submitted to|successfully submitted|submitted successfully|submitting|submission failed|browse to this assignment through/i.test(message), success, error, busy, submit };
    }).filter(x => x.linked);
    const resubmit = all(document, '.resubmit-assignment-announcement .resubmit-button').find(enabled);
    const brokenLink = all(document, '[aria-label="browse through LMS"]').some(shown);
    const pendingActivity = all(document, '.chevron-container .zb-progress-circular, .title-bar-chevron-container .zb-progress-circular').some(shown);
    return { linked: linked.length > 0 || !!resubmit || brokenLink, success: linked.length > 0 && linked.every(x => x.success) && !resubmit && !brokenLink && !pendingActivity,
      error: brokenLink || linked.some(x => x.error), busy: pendingActivity || linked.some(x => x.busy), buttons: [...linked.map(x => x.submit).filter(Boolean), ...(resubmit ? [resubmit] : [])] };
  }
  class Workflow {
    constructor(runner, hooks = {}) { this.runner = runner; this.hooks = hooks; this.active = false; this.phase = ''; this.pages = 0; }
    snapshot() {
      const state = this.runner.snapshot();
      return { ...state, running: this.active || state.running, phase: this.phase || state.phase, pages: this.pages };
    }
    emit() { this.hooks.update?.(this.snapshot()); }
    stop(reason = 'Stopped') {
      this.reason = reason; this.controller?.abort(); this.runner.stop(reason);
      this.hooks.clearResume?.(); this.phase = reason; this.emit();
    }
    guard() {
      if (this.controller.signal.aborted) throw new Error(this.reason || 'Stopped');
      if (!this.hooks.options?.().enabled && this.hooks.options) throw new Error('Turned off');
      if (this.path && location.pathname !== this.path && location.pathname !== this.nextPath) throw new Error('Stopped because the page changed');
    }
    async sleep(ms) {
      this.guard(); const signal = this.controller.signal;
      await new Promise((resolve, reject) => {
        const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error(this.reason || 'Stopped')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
        signal.addEventListener('abort', abort, { once: true });
      }); this.guard();
    }
    async wait(predicate, timeout) {
      const begin = Date.now();
      do { this.guard(); if (predicate()) return true; await this.sleep(150); } while (Date.now() - begin < timeout);
      return false;
    }
    async settle(options) {
      this.phase = 'Waiting for saved progress'; this.emit();
      await this.sleep(options.afterPageMs);
      let state = submissionState();
      if (!state.linked) {
        if (state.busy) await this.wait(() => !submissionState().busy, options.lmsWaitMs);
        this.runner.note(`No LMS confirmation available. Waited ${options.afterPageMs / 1000} seconds before continuing.`);
        return;
      }
      const submitted = new Set();
      const begin = Date.now();
      while (Date.now() - begin < options.lmsWaitMs) {
        this.guard(); state = submissionState();
        if (state.success) { this.runner.note('The displayed assignment score is confirmed submitted to the LMS.'); return; }
        for (const control of state.buttons) if (!submitted.has(control) && !state.busy) {
          // One explicit submission per displayed assignment control; never resubmit indefinitely.
          const key = text(control) + '|' + text(control.closest('.assignment-completion-summary-card')?.querySelector('.assignment-completion-header'));
          if (submitted.has(key)) continue;
          submitted.add(control); submitted.add(key); control.click();
        }
        if (state.error && !state.buttons.length) { this.runner.note('LMS confirmation is unavailable. Continuing after the configured wait.', 'warning'); return; }
        this.phase = 'Waiting for LMS submission confirmation'; this.emit();
        await this.sleep(250);
      }
      this.runner.note('LMS confirmation did not appear before the timeout. Continuing to the next section; submission is unconfirmed.', 'warning');
    }
    async run(raw, resume = null) {
      if (this.active || this.runner.state.running) return;
      const options = ZBUltra.settings(raw);
      if (!options.enabled) return;
      this.active = true; this.controller = new AbortController(); this.reason = ''; this.phase = ''; this.pages = resume?.pages || 0;
      const initial = routeInfo();
      // A fresh manual run always starts from the current URL, including a newly selected chapter.
      this.boundary = initial;
      this.path = location.pathname; this.nextPath = null;
      try {
        if (options.autoChapter && !initial) throw new Error('Chapter navigation requires a zyBooks section page');
        for (let page = 0; page < 250; page++) {
          this.guard(); this.phase = ''; this.emit();
          await this.runner.run(options); this.guard(); this.pages++; this.emit();
          const auto = this.hooks.options ? this.hooks.options().autoChapter : options.autoChapter;
          if (!auto) break;
          if (this.snapshot().skipped || this.runner.state.played) throw new Error('An activity needs review; chapter navigation stopped');
          await this.settle(options);
          if (options.participation && all(document, '.interactive-activity-container.participation [aria-label="Activity not completed"]').some(shown))
            throw new Error('A participation activity is incomplete; chapter navigation stopped');
          const target = nextSection();
          const live=this.hooks.options?this.hooks.options():options;
          if (!target) { this.phase = 'Reached the last available section'; break; }
          const current = routeInfo();
          const chapterChanged=target.route.chapter!==current.chapter;
          if(chapterChanged&&!live.nextChapter){this.phase='Reached the end of this chapter';break;}
          if(live.stopOptional&&optionalTarget(target)){this.phase='Stopped before optional content';break;}
          if (target.route.chapter < current.chapter || (!chapterChanged && target.route.section <= current.section)) throw new Error('The next-section link is not forward; navigation stopped');
          if (this.hooks.options && !this.hooks.options().autoChapter) break;
          this.guard();
          this.nextPath = target.route.path;
          const oldRoots = all(document, '.content-resource');
          const fingerprint = () => all(document, '.content-resource').map(el => el.getAttribute('content_resource_id') || el.getAttribute('content_resource_guid') || '').join('|');
          const before = fingerprint();
          this.phase = `Opening ${target.route.chapter}.${target.route.section}`; this.emit();
          await this.hooks.stageResume?.({ boundary: target.route, fromPath:location.pathname, expectedPath: this.nextPath, options:live, pages: this.pages });
          this.guard();
          if (this.hooks.options && !this.hooks.options().autoChapter) break;
          this.navigating = true;
          target.link.click();
          if (!await this.wait(() => location.pathname === this.nextPath && (oldRoots.every(el => !el.isConnected) || fingerprint() !== before), 20000))
            throw new Error('The next section did not finish loading');
          this.path = this.nextPath; this.nextPath = null; this.navigating = false;
          await this.hooks.clearResume?.();
          await this.sleep(700);
        }
      } catch (error) {
        this.phase = error.message || 'Stopped';
        this.runner.note(this.phase, 'warning');
      } finally {
        // On a full navigation this document is destroyed; the next document consumes its one-use resume record.
        this.active = false; this.navigating = false;
        await this.hooks.clearResume?.(); this.emit();
      }
    }
  }
  globalThis.ZBUltraFlow = Object.freeze({ Workflow, routeInfo, nextSection, optionalTarget, submissionState });
})();
