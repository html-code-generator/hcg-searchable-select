/*!
 * hcg-select - pure vanilla JS searchable select dropdown
 * No dependencies. Progressive enhancement of a native <select>.
 * Author: HTML Code Generator
 * Page: https://www.html-code-generator.com/javascript/searchable-select
 * License: MIT
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.hcgSelect = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  let idSeq = 0;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* - wrap the matched query inside the label with <mark>, HTML-escaped - */
  function highlight(label, query) {
    if (!query) return escapeHtml(label);
    const idx = label.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(label);
    const before = label.slice(0, idx);
    const match = label.slice(idx, idx + query.length);
    const after = label.slice(idx + query.length);
    return escapeHtml(before) + "<mark>" + escapeHtml(match) + "</mark>" + escapeHtml(after);
  }

  /* - an option is effectively disabled if it (or its parent optgroup) is disabled - */
  function optionDisabled(opt) {
    return opt.disabled ||
      (opt.parentElement && opt.parentElement.tagName === "OPTGROUP" && opt.parentElement.disabled);
  }

  function hcgSelect(select, opts) {
    if (typeof select === "string") {
      const found = document.querySelector(select);
      if (!found && typeof console !== "undefined" && console.warn) {
        console.warn(`hcg-select: no element matches selector "${select}".`);
      }
      select = found;
    }
    if (!select || select.tagName !== "SELECT") return;

    /* - native <select multiple> is not supported; leave it untouched - */
    if (select.multiple) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("hcg-select: <select multiple> is not supported; skipping.", select);
      }
      return;
    }
    /* - already initialized: return the existing instance instead of undefined - */
    if (select._hcgApi) return select._hcgApi;
    select.dataset.hcgReady = "1";
    opts = opts || {};

    const uid = `hcgs-${++idSeq}`;
    const listId = `${uid}-list`;
    const placeholder = opts.placeholder || select.dataset.placeholder || "Select...";
    const searchText = opts.searchPlaceholder || "Search...";
    const noResultsText = opts.noResultsText || "No results";
    const typeAheadEnabled = opts.typeAhead !== false;

    let clearable = opts.clearable;
    if (clearable === undefined && select.dataset.clearable !== undefined) {
      clearable = select.dataset.clearable !== "false";
    }
    clearable = !!clearable;

    const wrap = document.createElement("div");
    wrap.className = "hcg-select";

    /* - control is the combobox while CLOSED; becomes a button while open - */
    const control = document.createElement("div");
    control.className = "hcg-select-control";
    control.tabIndex = 0;
    control.setAttribute("role", "combobox");
    control.setAttribute("aria-haspopup", "listbox");
    control.setAttribute("aria-expanded", "false");
    control.setAttribute("aria-controls", listId);

    const labelSpan = document.createElement("span");
    labelSpan.className = "hcg-select-label";
    labelSpan.id = `${uid}-value`;

    const clearBtn = document.createElement("span");
    clearBtn.className = "hcg-select-clear";
    clearBtn.setAttribute("role", "button");
    clearBtn.setAttribute("aria-label", "Clear selection");
    clearBtn.setAttribute("tabindex", "-1");
    clearBtn.hidden = true;
    clearBtn.innerHTML = "&times;";

    const caret = document.createElement("span");
    caret.className = "hcg-select-caret";

    control.appendChild(labelSpan);
    control.appendChild(clearBtn);
    control.appendChild(caret);

    /* - associate an external <label for="..."> (or wrapping <label>) - */
    let labelEl = null;
    if (select.id) {
      const escId = (typeof CSS !== "undefined" && CSS.escape) ? CSS.escape(select.id) : select.id;
      labelEl = document.querySelector(`label[for="${escId}"]`);
    }
    if (!labelEl && select.closest) labelEl = select.closest("label");
    if (labelEl) {
      if (!labelEl.id) labelEl.id = `${uid}-label`;
      control.setAttribute("aria-labelledby", `${labelEl.id} ${labelSpan.id}`);
    } else {
      control.setAttribute("aria-labelledby", labelSpan.id);
    }

    const panel = document.createElement("div");
    panel.className = "hcg-select-panel";
    panel.hidden = true;

    const search = document.createElement("input");
    search.type = "text";
    search.id = `${uid}-search`;
    search.className = "hcg-select-search";
    search.setAttribute("placeholder", searchText);
    search.setAttribute("aria-label", searchText);
    search.setAttribute("autocomplete", "off");
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-controls", listId);

    const list = document.createElement("ul");
    list.className = "hcg-select-list";
    list.id = listId;
    list.setAttribute("role", "listbox");

    const empty = document.createElement("div");
    empty.className = "hcg-select-empty";
    empty.hidden = true;
    empty.textContent = noResultsText;

    panel.appendChild(search);
    panel.appendChild(list);
    panel.appendChild(empty);

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(control);
    wrap.appendChild(panel);
    wrap.appendChild(select);
    select.classList.add("hcg-select-native");
    select.setAttribute("tabindex", "-1");
    select.setAttribute("aria-hidden", "true");
    /* - inert prevents the hidden select from EVER receiving focus (an
         aria-hidden element must never hold focus, even transiently). The
         element still submits with the form. - */
    const inertSupported = "inert" in select;
    if (inertSupported) select.inert = true;

    /* - clicking the associated <label for> would natively focus the select;
         with inert that goes nowhere, so send focus to the control instead - */
    function onLabelClick() {
      if (!select.disabled) control.focus();
    }
    if (labelEl) labelEl.addEventListener("click", onLabelClick);

    /* - fallback for engines without inert: forward any focus that lands on
         the hidden select to the control - */
    function onNativeFocus() {
      setTimeout(() => {
        if (document.activeElement !== select) return;
        if (!select.disabled) control.focus();
        else select.blur();
      }, 0);
    }
    if (!inertSupported) select.addEventListener("focus", onNativeFocus);

    let items = [];
    let groups = [];
    let activeIndex = -1;
    let lastQuery = null;

    /* - only the FIRST empty-value option is treated as the placeholder - */
    function isPlaceholderOption(opt, index) {
      return opt.value === "" && index === 0;
    }

    /* - clearing only makes sense when there is a placeholder option to return to
         (a native <select> always has something selected; the placeholder IS its
         "empty" state). Without one, the clear button is not shown. - */
    function hasPlaceholder() {
      return select.options.length > 0 && isPlaceholderOption(select.options[0], 0);
    }
    if (clearable && !hasPlaceholder() && typeof console !== "undefined" && console.warn) {
      console.warn("hcg-select: `clearable` has no effect without a placeholder option " +
        '(a first <option value=""> ...). Add one to enable clearing.', select);
    }

    function makeOption(opt, grouped, groupDisabled) {
      const i = opt.index;
      if (isPlaceholderOption(opt, i)) return null;
      const li = document.createElement("li");
      li.className = "hcg-select-option" + (grouped ? " is-grouped" : "");
      li.id = `${uid}-opt-${i}`;
      li.setAttribute("role", "option");
      li.dataset.index = String(i);
      li.dataset.label = opt.text;
      if (opt.disabled || groupDisabled) {
        li.classList.add("is-disabled");
        li.setAttribute("aria-disabled", "true");
      }
      li.textContent = opt.text;
      return li;
    }

    /* - (re)build the list from current <option>s, honoring <optgroup> structure - */
    function buildItems() {
      list.innerHTML = "";
      items = [];
      groups = [];
      lastQuery = null;
      Array.from(select.children).forEach((node) => {
        if (node.tagName === "OPTGROUP") {
          const header = document.createElement("li");
          header.className = "hcg-select-group";
          header.setAttribute("role", "presentation");
          header.textContent = node.label || "";
          list.appendChild(header);
          const groupOptions = [];
          Array.from(node.children).forEach((opt) => {
            if (opt.tagName !== "OPTION") return;
            const li = makeOption(opt, true, node.disabled);
            if (li) { list.appendChild(li); items.push(li); groupOptions.push(li); }
          });
          groups.push({ header, options: groupOptions });
        } else if (node.tagName === "OPTION") {
          const li = makeOption(node, false, false);
          if (li) { list.appendChild(li); items.push(li); }
        }
      });
    }

    function setLabel() {
      const opt = select.options[select.selectedIndex];
      const hasRealSelection = opt && !isPlaceholderOption(opt, select.selectedIndex);
      if (hasRealSelection) {
        labelSpan.textContent = opt.text;
        labelSpan.classList.remove("hcg-select-placeholder");
      } else {
        labelSpan.textContent = placeholder;
        labelSpan.classList.add("hcg-select-placeholder");
      }
      clearBtn.hidden = !(clearable && hasRealSelection && hasPlaceholder());
      items.forEach((li) => {
        li.setAttribute("aria-selected", Number(li.dataset.index) === select.selectedIndex ? "true" : "false");
      });
    }

    function selectableItems() {
      return items.filter((li) => !li.hidden && !li.classList.contains("is-disabled"));
    }

    /* - scroll the LIST only (scrollIntoView would also scroll the page and
         every other ancestor, yanking the window on open with a far-down
         selection) - */
    function scrollItemIntoList(li) {
      const top = li.offsetTop;
      const bottom = top + li.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }

    function setActive(idx) {
      const sel = selectableItems();
      items.forEach((li) => li.classList.remove("is-active"));
      activeIndex = idx;
      if (idx >= 0 && idx < sel.length) {
        const li = sel[idx];
        li.classList.add("is-active");
        scrollItemIntoList(li);
        search.setAttribute("aria-activedescendant", li.id);
      } else {
        search.removeAttribute("aria-activedescendant");
      }
    }

    function filter(q) {
      const query = q.trim();
      if (query === lastQuery) return;
      lastQuery = query;
      const lower = query.toLowerCase();
      let anyVisible = false;
      items.forEach((li) => {
        const match = !query || li.dataset.label.toLowerCase().indexOf(lower) !== -1;
        li.hidden = !match;
        if (match) {
          if (query) li.innerHTML = highlight(li.dataset.label, query);
          else li.textContent = li.dataset.label;
          anyVisible = true;
        }
      });
      /* - hide a group header when all of its options are filtered out - */
      groups.forEach((g) => { g.header.hidden = g.options.every((li) => li.hidden); });
      empty.hidden = anyVisible;
      setActive(selectableItems().length ? 0 : -1);
    }

    function onDocumentPointerDown(e) {
      if (!wrap.contains(e.target)) close();
    }

    function syncDisabled() {
      const disabled = select.disabled;
      wrap.classList.toggle("is-disabled", disabled);
      control.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (disabled) {
        control.removeAttribute("tabindex");
        close();
      } else {
        control.setAttribute("tabindex", "0");
      }
    }

    function syncRequired() {
      if (select.required) control.setAttribute("aria-required", "true");
      else control.removeAttribute("aria-required");
    }
    function onInvalid() { control.setAttribute("aria-invalid", "true"); }
    function onValidityCheck() {
      if (select.checkValidity && select.checkValidity()) control.removeAttribute("aria-invalid");
    }

    /* - flip the panel upward when there is not enough room below the control - */
    function positionPanel() {
      wrap.classList.remove("is-flipped");
      if (typeof window === "undefined" || !control.getBoundingClientRect) return;
      const rect = control.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      const panelH = panel.offsetHeight;
      if (below < panelH && above > below) wrap.classList.add("is-flipped");
    }

    function open() {
      if (select.disabled) return;
      if (!panel.hidden) return;
      panel.hidden = false;
      wrap.classList.add("is-open");
      control.setAttribute("role", "button");
      control.setAttribute("aria-expanded", "true");
      search.setAttribute("role", "combobox");
      search.setAttribute("aria-expanded", "true");
      search.value = "";
      lastQuery = null;
      filter("");
      const sel = selectableItems();
      const selIdx = sel.findIndex((li) => Number(li.dataset.index) === select.selectedIndex);
      setActive(selIdx >= 0 ? selIdx : (sel.length ? 0 : -1));
      positionPanel();
      document.addEventListener("pointerdown", onDocumentPointerDown);
      if (typeof opts.onOpen === "function") opts.onOpen(select, api);
    }

    function close() {
      if (panel.hidden) return;
      panel.hidden = true;
      wrap.classList.remove("is-open", "is-flipped");
      control.setAttribute("role", "combobox");
      control.setAttribute("aria-expanded", "false");
      search.removeAttribute("role");
      search.removeAttribute("aria-expanded");
      search.removeAttribute("aria-activedescendant");
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      if (typeof opts.onClose === "function") opts.onClose(select, api);
    }

    /* - commit a selection by native option index (-1 clears the selection) - */
    function commit(index) {
      if (index < -1 || index >= select.options.length) return;
      select.selectedIndex = index;
      setLabel();
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      if (typeof opts.onChange === "function") {
        const opt = select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
        opts.onChange(select.value, opt, select);
      }
    }

    function choose(li) {
      if (!li || li.classList.contains("is-disabled")) return;
      commit(Number(li.dataset.index));
      close();
      control.focus();
    }

    /* - clear by returning to the placeholder option (index 0); no-op when the
         select has no placeholder, matching native "always has a value" behavior - */
    function clearSelection() {
      if (!hasPlaceholder()) return;
      commit(0);
    }
    clearBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      clearSelection();
    });

    function selectableIndexes() {
      const indexes = [];
      Array.from(select.options).forEach((o, i) => {
        if (isPlaceholderOption(o, i) || optionDisabled(o)) return;
        indexes.push(i);
      });
      return indexes;
    }

    function step(dir) {
      const indexes = selectableIndexes();
      if (!indexes.length) return;
      const cur = indexes.indexOf(select.selectedIndex);
      let next;
      if (cur === -1) {
        next = dir > 0 ? 0 : indexes.length - 1;
      } else {
        next = cur + dir;
        if (next < 0 || next >= indexes.length) return;
      }
      commit(indexes[next]);
    }

    let typeBuffer = "";
    let typeTimer = null;
    function typeAhead(ch) {
      typeBuffer += ch.toLowerCase();
      if (typeTimer) clearTimeout(typeTimer);
      typeTimer = setTimeout(() => { typeBuffer = ""; }, 700);
      const hit = selectableIndexes().find(
        (i) => select.options[i].text.toLowerCase().startsWith(typeBuffer)
      );
      if (hit !== undefined) commit(hit);
    }

    control.addEventListener("click", () => {
      panel.hidden ? open() : close();
    });
    /* - list navigation while the panel is OPEN; shared by the control (focus
         stays there when opened by keyboard, since the search box is not
         auto-focused) and the search input - */
    function onOpenKeydown(e) {
      const sel = selectableItems();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (sel.length) setActive((activeIndex + 1) % sel.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (sel.length) setActive(activeIndex <= 0 ? sel.length - 1 : activeIndex - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        if (sel.length) setActive(0);
      } else if (e.key === "End") {
        e.preventDefault();
        if (sel.length) setActive(sel.length - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0) choose(sel[activeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
        control.focus();
      }
    }

    control.addEventListener("keydown", (e) => {
      if (select.disabled) return;
      if (!panel.hidden) {
        onOpenKeydown(e);
        return;
      }
      if (e.key === "Enter" || e.key === " " || (e.key === "ArrowDown" && e.altKey)) {
        e.preventDefault();
        open();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      } else if (clearable && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        clearSelection();
      } else if (typeAheadEnabled && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        typeAhead(e.key);
      }
    });

    search.addEventListener("input", () => filter(search.value));
    search.addEventListener("keydown", onOpenKeydown);

    list.addEventListener("click", (e) => {
      const li = e.target.closest(".hcg-select-option");
      if (li) choose(li);
    });

    wrap.addEventListener("focusout", (e) => {
      if (e.relatedTarget && !wrap.contains(e.relatedTarget)) close();
    });

    select.addEventListener("change", setLabel);
    select.addEventListener("change", onValidityCheck);
    select.addEventListener("invalid", onInvalid);

    /* - the platform fires no event when `select.value` / `select.selectedIndex` is
         assigned programmatically, so wrap this element's setters to sync the label
         (UI only - no change event, matching native property-assignment semantics) - */
    let valueDesc = null;
    let indexDesc = null;
    if (typeof HTMLSelectElement !== "undefined") {
      valueDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      indexDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
    }
    const propsPatched = !!(valueDesc && valueDesc.configurable && indexDesc && indexDesc.configurable);
    if (propsPatched) {
      Object.defineProperty(select, "value", {
        configurable: true,
        enumerable: valueDesc.enumerable,
        get() { return valueDesc.get.call(this); },
        set(v) { valueDesc.set.call(this, v); setLabel(); }
      });
      Object.defineProperty(select, "selectedIndex", {
        configurable: true,
        enumerable: indexDesc.enumerable,
        get() { return indexDesc.get.call(this); },
        set(v) { indexDesc.set.call(this, v); setLabel(); }
      });
    }
    const theForm = select.form;
    function onFormReset() { setTimeout(setLabel, 0); }
    if (theForm) theForm.addEventListener("reset", onFormReset);

    /* - watch the native <select>: disabled toggles mirror onto the widget; option /
         optgroup add-remove-rename-disable rebuilds the list (debounced) - */
    let domObserver = null;
    let rebuildQueued = false;
    function scheduleRebuild() {
      if (rebuildQueued) return;
      rebuildQueued = true;
      Promise.resolve().then(() => {
        rebuildQueued = false;
        buildItems();
        setLabel();
        if (!panel.hidden) filter(search.value);
      });
    }
    if (typeof MutationObserver !== "undefined") {
      domObserver = new MutationObserver((mutations) => {
        let structural = false;
        let disabledChanged = false;
        for (const m of mutations) {
          if (m.type === "attributes" && m.attributeName === "disabled" && m.target === select) {
            disabledChanged = true;
          } else {
            structural = true;
          }
        }
        if (disabledChanged) syncDisabled();
        if (structural) scheduleRebuild();
      });
      domObserver.observe(select, {
        attributes: true,
        attributeFilter: ["disabled"],
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    buildItems();
    setLabel();
    syncDisabled();
    syncRequired();

    function destroy() {
      close();
      if (domObserver) domObserver.disconnect();
      if (typeTimer) clearTimeout(typeTimer);
      select.removeEventListener("change", setLabel);
      select.removeEventListener("change", onValidityCheck);
      select.removeEventListener("invalid", onInvalid);
      select.removeEventListener("focus", onNativeFocus);
      if (labelEl) labelEl.removeEventListener("click", onLabelClick);
      if (inertSupported) select.inert = false;
      if (theForm) theForm.removeEventListener("reset", onFormReset);
      /* - restore the native value / selectedIndex setters - */
      if (propsPatched) {
        delete select.value;
        delete select.selectedIndex;
      }
      if (wrap.parentNode) wrap.parentNode.insertBefore(select, wrap);
      select.classList.remove("hcg-select-native");
      select.removeAttribute("tabindex");
      select.removeAttribute("aria-hidden");
      delete select.dataset.hcgReady;
      delete select._hcgApi;
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    function setDisabled(state) {
      select.disabled = !!state;
      syncDisabled();
    }

    const api = {
      open,
      close,
      refresh() { buildItems(); setLabel(); syncDisabled(); syncRequired(); },
      clear: clearSelection,
      disable() { setDisabled(true); },
      enable() { setDisabled(false); },
      setDisabled,
      destroy,
      element: wrap,
      select
    };
    select._hcgApi = api;
    return api;
  }

  function autoInit() {
    document.querySelectorAll("select[data-hcg-select]").forEach((el) => hcgSelect(el));
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInit);
    } else {
      autoInit();
    }
  }

  return hcgSelect;
});
