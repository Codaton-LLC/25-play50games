// Focus ownership for the site's dialogs (the auth sheets, search, the 3D shell's sheets, the
// classic Game Complete). One stack for the whole page, so a sheet opened over another (log in
// from a 3D result) takes over and hands back cleanly:
// - a modal entry: Tab and Shift+Tab wrap inside it, and every element outside it gets `inert`
//   (no focus, no clicks, hidden from assistive technology). Only the newest modal entry acts.
// - a scoped entry (modal: false): a sheet that is the page's content beside the site header
//   (the 3D lobby and result). It makes only the rest of its own frame inert (`scope`, e.g. the
//   canvas and the HUD behind it); Tab moves on to the header and the cookie bar as usual.
// - closing an entry gives the focus back to the element that had it when the entry opened (or to
//   `restoreFocus()`), when the focus was lost with the dialog (on <body>) or is still inside it.
// The inert attributes are recomputed from the stack on every change, so entries may close in any
// order; an element that was inert before (not set here) is never touched.
//
// Plain DOM: the hook is useModal.ts. The tests drive it with small fake elements (no jsdom).

export const TABBABLE_SELECTOR = [
   "a[href]",
   "area[href]",
   "button",
   "input",
   "select",
   "textarea",
   "iframe",
   "summary",
   "[tabindex]",
   '[contenteditable="true"]',
].join(",");

/** never made inert: nothing focusable or visible lives in them */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT", "HEAD"]);

export interface ModalOptions {
   /** true (default): focus is contained and the rest of the page is inert */
   modal?: boolean;
   /** modal: false only: the frame whose other parts become inert (none = nothing is inert) */
   scope?: Element | null;
   /**
    * Where the focus goes when the entry closes. Default true: the element that was focused when
    * it opened. A function picks the target at close time: an element, null to skip the restore,
    * undefined for the opener. false never restores (default for scoped entries).
    */
   restoreFocus?: boolean | (() => HTMLElement | null | undefined);
}

interface Entry {
   el: HTMLElement;
   modal: boolean;
   scope: Element | null;
   restoreFocus: boolean | (() => HTMLElement | null | undefined);
   opener: HTMLElement | null;
}

const stack: Entry[] = [];
const inerted = new Set<Element>();
let listening: Document | null = null;

function topModal(): Entry | null {
   for (let i = stack.length - 1; i >= 0; i -= 1) if (stack[i].modal) return stack[i];
   return null;
}

/** Marks every sibling along the path from `el` up to `boundary` (exclusive) inert. */
function inertOutside(el: Element, boundary: Element) {
   let node: Element = el;
   while (node !== boundary) {
      const parent = node.parentElement;
      if (!parent) break;
      for (const sibling of Array.from(parent.children)) {
         if (sibling === node || SKIP_TAGS.has(sibling.tagName) || sibling.hasAttribute("inert")) continue;
         sibling.setAttribute("inert", "");
         inerted.add(sibling);
      }
      node = parent;
   }
}

function apply() {
   for (const el of inerted) el.removeAttribute("inert");
   inerted.clear();
   const top = topModal();
   if (top) {
      const body = top.el.ownerDocument.body;
      inertOutside(top.el, body ?? top.el.ownerDocument.documentElement);
      return;
   }
   for (const entry of stack) {
      if (entry.scope && entry.scope !== entry.el && entry.scope.contains(entry.el)) inertOutside(entry.el, entry.scope);
   }
}

function isVisible(el: HTMLElement): boolean {
   const check = (el as HTMLElement & { checkVisibility?: (options?: object) => boolean }).checkVisibility;
   if (typeof check !== "function") return true;
   return check.call(el, { checkVisibilityCSS: true, visibilityProperty: true });
}

/** The elements Tab reaches inside `container`, in document order. */
export function tabbables(container: Element): HTMLElement[] {
   return Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
      (el) =>
         el.tabIndex >= 0 &&
         !(el as HTMLButtonElement).disabled &&
         !(el.tagName === "INPUT" && (el as HTMLInputElement).type === "hidden") &&
         !el.closest("[inert]") &&
         isVisible(el),
   );
}

/**
 * Where Tab (or Shift+Tab with `backward`) must go so the focus stays inside the dialog. null:
 * the browser's own move stays inside, let it happen. "stay": nothing to focus, keep it put.
 */
export function nextTabStop<T>(items: readonly T[], active: T | null, backward: boolean, inside: boolean): T | "stay" | null {
   if (items.length === 0) return "stay";
   const first = items[0];
   const last = items[items.length - 1];
   const index = active === null ? -1 : items.indexOf(active);
   if (!inside || index === -1) return backward ? last : first;
   if (!backward && index === items.length - 1) return first;
   if (backward && index === 0) return last;
   return null;
}

function onKeyDown(event: KeyboardEvent) {
   if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
   const top = topModal();
   if (!top) return;
   const doc = top.el.ownerDocument;
   const active = doc.activeElement as HTMLElement | null;
   const inside = !!active && top.el.contains(active);
   const target = nextTabStop(tabbables(top.el), inside && active !== top.el ? active : null, event.shiftKey, inside);
   if (target === null) return;
   event.preventDefault();
   if (target !== "stay") target.focus();
}

function syncListener(doc: Document) {
   const want = topModal() !== null;
   if (want && !listening) {
      doc.addEventListener("keydown", onKeyDown, true);
      listening = doc;
   } else if (!want && listening) {
      listening.removeEventListener("keydown", onKeyDown, true);
      listening = null;
   }
}

/**
 * Registers an open dialog. Returns the function that closes it (call it when the dialog unmounts
 * or hides); calling it twice is harmless.
 */
export function openModal(el: HTMLElement, options: ModalOptions = {}): () => void {
   const modal = options.modal ?? true;
   const doc = el.ownerDocument;
   const entry: Entry = {
      el,
      modal,
      scope: modal ? null : (options.scope ?? null),
      restoreFocus: options.restoreFocus ?? modal,
      opener: (doc.activeElement as HTMLElement | null) ?? null,
   };
   stack.push(entry);
   apply();
   syncListener(doc);

   let closed = false;
   return () => {
      if (closed) return;
      closed = true;
      const index = stack.indexOf(entry);
      // a modal under a newer modal hands nothing back: the newer one owns the focus
      const covered = stack.slice(index + 1).some((other) => other.modal);
      if (index !== -1) stack.splice(index, 1);
      apply();
      syncListener(doc);
      if (covered || entry.restoreFocus === false) return;
      const picked = typeof entry.restoreFocus === "function" ? entry.restoreFocus() : undefined;
      const target = picked === undefined ? entry.opener : picked;
      if (!target || !target.isConnected || target === doc.body) return;
      const active = doc.activeElement;
      const lost = !active || active === doc.body || !el.isConnected || el.contains(active);
      if (!lost) return;
      target.focus({ preventScroll: true });
   };
}

/** test only: the stack's size */
export const openModalCount = () => stack.length;

/**
 * After a failed submit: moves the focus to the form's first invalid field once React has drawn
 * the errors (its label and linked error text are read out with it).
 */
export function focusFirstInvalid(form: HTMLFormElement | null): void {
   if (!form) return;
   window.setTimeout(() => {
      form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
   }, 0);
}
