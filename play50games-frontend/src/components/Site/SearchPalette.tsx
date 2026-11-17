"use client";

// "Find a game" (Ctrl K): a command palette over the page. Games, worlds and a few pages; arrow
// keys move, Enter opens, Esc closes. On phones it fills the screen.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WORLDS, bestText, isPlayable, type SiteGame, type WorldId } from "./siteData";
import { useLocalScores } from "./hooks";
import { CloseIcon, SearchIcon } from "./icons";
import ui from "./ui.module.css";
import styles from "./SearchPalette.module.css";

export interface SearchPaletteProps {
   open: boolean;
   onClose: () => void;
   games: SiteGame[];
   worlds: WorldId[];
   /** the leaderboards page exists */
   boards: boolean;
}

interface Item {
   key: string;
   title: string;
   sub: string;
   href: string;
   thumb?: string | null;
   plate?: string;
   right?: string | null;
}

interface Group {
   title: string;
   items: Item[];
}

const PAGES: Array<{ title: string; sub: string; href: string }> = [
   { title: "My progress", sub: "Classic 50", href: "/progress" },
   { title: "Certificate", sub: "Classic 50", href: "/certificate" },
   { title: "Verify a certificate", sub: "Classic 50", href: "/verify" },
   { title: "FAQ", sub: "Help", href: "/faq" },
   { title: "Contact", sub: "Help", href: "/contact-us" },
];

export default function SearchPalette({ open, onClose, games, worlds, boards }: SearchPaletteProps) {
   const router = useRouter();
   const scores = useLocalScores();
   const inputRef = useRef<HTMLInputElement>(null);
   const listRef = useRef<HTMLDivElement>(null);
   const [query, setQuery] = useState("");
   const [selected, setSelected] = useState(0);

   const groups = useMemo<Group[]>(() => {
      const playable = games.filter(isPlayable);
      const gameItem = (game: SiteGame): Item => ({
         key: `game-${game.slug}`,
         title: game.title,
         sub: "3D Arcade",
         href: `/3d/${game.slug}`,
         thumb: game.thumbnail,
         right: bestText(game, scores[game.slug as keyof typeof scores]),
      });
      const worldItem = (id: WorldId): Item => ({
         key: `world-${id}`,
         title: WORLDS[id].title,
         sub: "World",
         href: WORLDS[id].href,
         plate: WORLDS[id].plate,
      });
      const pages: Item[] = [
         ...(boards ? [{ title: "Leaderboards", sub: "3D Arcade", href: "/leaderboards" }] : []),
         ...PAGES,
      ].map((page) => ({ key: `page-${page.href}`, ...page }));

      const text = query.trim().toLowerCase();
      if (!text) {
         const recent = playable
            .filter((game) => scores[game.slug as keyof typeof scores])
            .sort((a, b) => {
               const A = scores[a.slug as keyof typeof scores]?.lastPlayed ?? "";
               const B = scores[b.slug as keyof typeof scores]?.lastPlayed ?? "";
               return B.localeCompare(A);
            })
            .slice(0, 4);
         const first = recent.length > 0 ? recent : playable.slice(0, 4);
         return [
            { title: recent.length > 0 ? "Jump back in" : "Games", items: first.map(gameItem) },
            { title: "Worlds", items: worlds.map(worldItem) },
         ].filter((group) => group.items.length > 0);
      }

      const match = (value: string) => value.toLowerCase().includes(text);
      return [
         { title: "Games", items: playable.filter((game) => match(game.title)).map(gameItem) },
         { title: "Worlds", items: worlds.filter((id) => match(WORLDS[id].title)).map(worldItem) },
         { title: "Pages", items: pages.filter((page) => match(page.title)) },
      ].filter((group) => group.items.length > 0);
   }, [games, worlds, boards, scores, query]);

   const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

   useEffect(() => {
      if (!open) return;
      setQuery("");
      setSelected(0);
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const focus = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
         window.clearTimeout(focus);
         document.body.style.overflow = previous;
      };
   }, [open]);

   useEffect(() => {
      setSelected(0);
   }, [query]);

   if (!open) return null;

   function go(item: Item | undefined) {
      if (!item) return;
      onClose();
      router.push(item.href);
   }

   function onKeyDown(event: React.KeyboardEvent) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
         event.preventDefault();
         const next =
            event.key === "ArrowDown" ? Math.min(flat.length - 1, selected + 1) : Math.max(0, selected - 1);
         setSelected(next);
         listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter") {
         event.preventDefault();
         go(flat[selected]);
      } else if (event.key === "Escape") {
         event.preventDefault();
         onClose();
      }
   }

   let index = -1;

   return (
      <div
         className={styles.overlay}
         onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
         }}
      >
         <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Find a game" onKeyDown={onKeyDown}>
            <div className={styles.inputRow}>
               <SearchIcon className={styles.inputIcon} />
               <input
                  ref={inputRef}
                  className={styles.input}
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a game"
                  aria-label="Find a game"
                  autoComplete="off"
                  spellCheck={false}
               />
               <button type="button" className={ui.iconBtn} onClick={onClose} aria-label="Close search">
                  <CloseIcon />
               </button>
            </div>

            <div className={styles.list} ref={listRef} role="listbox" aria-label="Results">
               {groups.length === 0 ? (
                  <p className={styles.none}>
                     No game matches that. Try a shorter word, like &ldquo;robot&rdquo; or &ldquo;escape&rdquo;.
                  </p>
               ) : (
                  groups.map((group) => (
                     <div key={group.title}>
                        <p className={`${ui.label} ${styles.groupTitle}`}>{group.title}</p>
                        {group.items.map((item) => {
                           index += 1;
                           const itemIndex = index;
                           return (
                              <Link
                                 key={item.key}
                                 href={item.href}
                                 className={styles.item}
                                 role="option"
                                 aria-selected={itemIndex === selected}
                                 data-index={itemIndex}
                                 onClick={onClose}
                                 onMouseMove={() => {
                                    if (itemIndex !== selected) setSelected(itemIndex);
                                 }}
                              >
                                 {item.plate ? (
                                    <span className={styles.plateCell}>
                                       <span className={`${ui.plate} ${ui.plateLg}`}>{item.plate}</span>
                                    </span>
                                 ) : item.thumb ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img className={styles.thumb} src={item.thumb} alt="" />
                                 ) : (
                                    <span className={styles.thumb} aria-hidden="true" />
                                 )}
                                 <span className={styles.text}>
                                    <span className={styles.title}>{item.title}</span>
                                    <span className={styles.sub}>{item.sub}</span>
                                 </span>
                                 {item.right ? <span className={styles.right}>{item.right}</span> : null}
                              </Link>
                           );
                        })}
                     </div>
                  ))
               )}
            </div>

            <div className={styles.foot} aria-hidden="true">
               <span>
                  <kbd className={ui.kbd}>Enter</kbd> open
               </span>
               <span>
                  <kbd className={ui.kbd}>&uarr;</kbd>
                  <kbd className={ui.kbd}>&darr;</kbd> move
               </span>
               <span>
                  <kbd className={ui.kbd}>Esc</kbd> close
               </span>
            </div>
         </div>
      </div>
   );
}
