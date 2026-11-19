// The dialogs' focus ownership (modalStack.ts): Tab wraps inside the newest modal, everything
// outside it is inert, a scoped sheet inerts only its own frame, and closing hands the focus back.
// There is no DOM in this test environment, so a few fake elements stand in for one: they model
// only what the stack reads (parent / children, attributes, contains, focus, tab stops).
import { afterEach, describe, expect, it } from "vitest";
import { nextTabStop, openModal, openModalCount, tabbables } from "./modalStack";

class FakeDoc {
   activeElement: FakeEl | null = null;
   listeners = new Map<string, (event: unknown) => void>();
   body!: FakeEl;
   documentElement!: FakeEl;
   addEventListener(type: string, fn: (event: unknown) => void) {
      this.listeners.set(type, fn);
   }
   removeEventListener(type: string) {
      this.listeners.delete(type);
   }
   /** dispatches a Tab keydown; true when the stack prevented the browser's own move */
   tab(shiftKey = false): boolean {
      let prevented = false;
      this.listeners.get("keydown")?.({
         key: "Tab",
         shiftKey,
         defaultPrevented: false,
         preventDefault: () => {
            prevented = true;
         },
      });
      return prevented;
   }
}

class FakeEl {
   parentElement: FakeEl | null = null;
   children: FakeEl[] = [];
   attrs = new Map<string, string>();
   tabIndex: number;
   disabled = false;
   constructor(
      public doc: FakeDoc,
      public tagName: string,
      public name: string,
      focusable = false,
   ) {
      this.tabIndex = focusable ? 0 : -1;
      this.focusable = focusable;
   }
   focusable: boolean;
   get ownerDocument() {
      return this.doc;
   }
   get isConnected(): boolean {
      let node: FakeEl | null = this;
      while (node) {
         if (node === this.doc.documentElement) return true;
         node = node.parentElement;
      }
      return false;
   }
   add(...kids: FakeEl[]) {
      for (const kid of kids) {
         kid.parentElement = this;
         this.children.push(kid);
      }
      return this;
   }
   remove() {
      if (!this.parentElement) return;
      this.parentElement.children = this.parentElement.children.filter((kid) => kid !== this);
      this.parentElement = null;
   }
   hasAttribute(name: string) {
      return this.attrs.has(name);
   }
   setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
   }
   removeAttribute(name: string) {
      this.attrs.delete(name);
   }
   contains(other: FakeEl | null): boolean {
      let node = other;
      while (node) {
         if (node === this) return true;
         node = node.parentElement;
      }
      return false;
   }
   closest(selector: string): FakeEl | null {
      if (selector !== "[inert]") throw new Error(`fake closest: ${selector}`);
      let node: FakeEl | null = this;
      while (node) {
         if (node.hasAttribute("inert")) return node;
         node = node.parentElement;
      }
      return null;
   }
   querySelectorAll(): FakeEl[] {
      const out: FakeEl[] = [];
      const walk = (node: FakeEl) => {
         for (const kid of node.children) {
            if (kid.focusable) out.push(kid);
            walk(kid);
         }
      };
      walk(this);
      return out;
   }
   focus() {
      this.doc.activeElement = this;
   }
}

/**
 * <html><body>
 *   <header> [login button] </header>
 *   <main> [page link] <div shell> <canvas/> <div sheet>[play]</div> </div> </main>
 *   <div cookie> [accept] </div>
 * </body></html>
 */
function page() {
   const doc = new FakeDoc();
   const el = (tag: string, name: string, focusable = false) => new FakeEl(doc, tag, name, focusable);
   const html = el("HTML", "html");
   const head = el("HEAD", "head");
   const body = el("BODY", "body");
   doc.body = body;
   doc.documentElement = html;
   const login = el("BUTTON", "login", true);
   const header = el("HEADER", "header").add(login);
   const link = el("A", "link", true);
   const canvas = el("CANVAS", "canvas");
   const play = el("BUTTON", "play", true);
   const sheet = el("DIV", "sheet").add(play);
   const shell = el("DIV", "shell").add(canvas, sheet);
   const main = el("MAIN", "main").add(link, shell);
   const accept = el("BUTTON", "accept", true);
   const cookie = el("DIV", "cookie").add(accept);
   const script = el("SCRIPT", "script");
   html.add(head, body.add(header, main, cookie, script));
   const dialog = (...buttons: string[]) => {
      const kids = buttons.map((name) => el("BUTTON", name, true));
      const box = el("DIV", "dialog").add(...kids);
      body.add(box);
      return { box, kids };
   };
   return { doc, body, header, login, main, link, shell, canvas, sheet, play, cookie, accept, script, head, dialog };
}

const inert = (...els: FakeEl[]) => els.map((node) => node.hasAttribute("inert"));
const asEl = (node: FakeEl) => node as unknown as HTMLElement;

const closers: Array<() => void> = [];
const open = (node: FakeEl, options?: Parameters<typeof openModal>[1]) => {
   const close = openModal(asEl(node), options);
   closers.push(close);
   return close;
};

afterEach(() => {
   while (closers.length) closers.pop()!();
   expect(openModalCount()).toBe(0);
});

describe("nextTabStop", () => {
   const items = ["a", "b", "c"];
   it("wraps from the last to the first and back", () => {
      expect(nextTabStop(items, "c", false, true)).toBe("a");
      expect(nextTabStop(items, "a", true, true)).toBe("c");
   });
   it("lets the browser move between inner stops", () => {
      expect(nextTabStop(items, "a", false, true)).toBeNull();
      expect(nextTabStop(items, "c", true, true)).toBeNull();
   });
   it("brings a focus outside (or on the dialog itself) to the first or last stop", () => {
      expect(nextTabStop(items, null, false, false)).toBe("a");
      expect(nextTabStop(items, null, true, true)).toBe("c");
   });
   it("keeps the focus put when there is nothing to tab to", () => {
      expect(nextTabStop([], null, false, true)).toBe("stay");
   });
});

describe("tabbables", () => {
   it("skips disabled, negative tabindex and inert elements", () => {
      const { dialog } = page();
      const { box, kids } = dialog("a", "b", "c", "d");
      kids[1].disabled = true;
      kids[2].tabIndex = -1;
      kids[3].setAttribute("inert", "");
      expect(tabbables(asEl(box))).toEqual([kids[0]]);
   });
});

describe("openModal (modal)", () => {
   it("makes everything outside the dialog inert, but never scripts or the head, and clears it on close", () => {
      const p = page();
      const { box } = p.dialog("close");
      const close = open(box);
      expect(inert(p.header, p.main, p.cookie, box)).toEqual([true, true, true, false]);
      expect(inert(p.script, p.head)).toEqual([false, false]);
      close();
      expect(inert(p.header, p.main, p.cookie)).toEqual([false, false, false]);
   });

   it("never clears an inert attribute it did not set", () => {
      const p = page();
      p.cookie.setAttribute("inert", "");
      const close = open(p.dialog("x").box);
      close();
      expect(p.cookie.hasAttribute("inert")).toBe(true);
   });

   it("wraps Tab and Shift+Tab inside the dialog and pulls an outside focus in", () => {
      const p = page();
      const { box, kids } = p.dialog("first", "middle", "last");
      open(box);
      kids[2].focus();
      expect(p.doc.tab()).toBe(true);
      expect(p.doc.activeElement).toBe(kids[0]);
      expect(p.doc.tab(true)).toBe(true);
      expect(p.doc.activeElement).toBe(kids[2]);
      kids[0].focus();
      expect(p.doc.tab()).toBe(false); // the browser moves on to "middle"
      p.login.focus();
      expect(p.doc.tab()).toBe(true);
      expect(p.doc.activeElement).toBe(kids[0]);
   });

   it("hands the focus back to the opener when the dialog unmounts", () => {
      const p = page();
      p.login.focus();
      const { box, kids } = p.dialog("close");
      const close = open(box);
      kids[0].focus();
      box.remove(); // React removes the node, then runs the effect's cleanup
      p.doc.activeElement = p.body;
      close();
      expect(p.doc.activeElement).toBe(p.login);
   });

   it("leaves a focus that moved on elsewhere alone, and can be told where to go instead", () => {
      const p = page();
      p.login.focus();
      const first = p.dialog("x");
      const close = open(first.box);
      p.accept.focus();
      close();
      expect(p.doc.activeElement).toBe(p.accept);

      p.login.focus();
      const second = p.dialog("y");
      const closeSecond = open(second.box, { restoreFocus: () => asEl(p.link) });
      second.kids[0].focus();
      closeSecond();
      expect(p.doc.activeElement).toBe(p.link);

      p.login.focus();
      const third = p.dialog("z");
      const closeThird = open(third.box, { restoreFocus: () => null });
      third.kids[0].focus();
      closeThird();
      expect(p.doc.activeElement).toBe(third.kids[0]);
   });

   it("lets the newest modal own the page; the older one takes over again when it closes", () => {
      const p = page();
      const lower = p.dialog("lower");
      open(lower.box);
      lower.kids[0].focus();
      const upper = p.dialog("upper");
      const closeUpper = open(upper.box);
      expect(inert(lower.box, upper.box)).toEqual([true, false]);
      upper.kids[0].focus();
      upper.box.remove();
      p.doc.activeElement = p.body;
      closeUpper();
      expect(inert(lower.box, p.header)).toEqual([false, true]);
      expect(p.doc.activeElement).toBe(lower.kids[0]);
   });

   it("a modal closed under a newer modal hands no focus back", () => {
      const p = page();
      p.login.focus();
      const lower = p.dialog("lower");
      const closeLower = open(lower.box);
      const upper = p.dialog("upper");
      open(upper.box);
      upper.kids[0].focus();
      closeLower();
      expect(p.doc.activeElement).toBe(upper.kids[0]);
      expect(inert(lower.box, upper.box)).toEqual([true, false]);
   });

   it("removes its Tab handler once no modal is open", () => {
      const p = page();
      const close = open(p.dialog("x").box);
      expect(p.doc.listeners.has("keydown")).toBe(true);
      close();
      expect(p.doc.listeners.has("keydown")).toBe(false);
   });
});

describe("openModal (scoped sheet, modal: false)", () => {
   it("makes only the rest of its frame inert; the header and the cookie bar stay usable", () => {
      const p = page();
      open(p.sheet, { modal: false, scope: p.shell as unknown as Element });
      expect(inert(p.canvas, p.sheet, p.header, p.cookie, p.link)).toEqual([true, false, false, false, false]);
      p.play.focus();
      expect(p.doc.tab()).toBe(false); // no trap
   });

   it("gives way to a modal opened over it and comes back after", () => {
      const p = page();
      open(p.sheet, { modal: false, scope: p.shell as unknown as Element });
      p.play.focus();
      const auth = p.dialog("email");
      const closeAuth = open(auth.box);
      expect(inert(p.main, p.header)).toEqual([true, true]);
      auth.kids[0].focus();
      auth.box.remove();
      p.doc.activeElement = p.body;
      closeAuth();
      expect(inert(p.main, p.header, p.canvas)).toEqual([false, false, true]);
      expect(p.doc.activeElement).toBe(p.play);
   });

   it("does not restore the focus by default when it closes", () => {
      const p = page();
      p.login.focus();
      const close = open(p.sheet, { modal: false, scope: p.shell as unknown as Element });
      p.play.focus();
      close();
      expect(p.doc.activeElement).toBe(p.play);
      expect(p.canvas.hasAttribute("inert")).toBe(false);
   });
});
