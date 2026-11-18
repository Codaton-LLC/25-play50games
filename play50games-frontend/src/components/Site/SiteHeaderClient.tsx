"use client";

// The site chrome of the redesigned pages (docs/design/DESIGN.md §5): the sticky top bar with the
// world switcher and its mega panel, search, theme, the account menu, and the phone tab bar.
// The worlds are real links, so every world page is one click (or tap) away without JavaScript.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import LoginModal from "@/components/Auth/LoginModal";
import RegisterModal from "@/components/Auth/RegisterModal";
import { ARCADE_ENABLED, ARCADE_LEADERBOARD, SQUAD_TEASER } from "@/arcade3d/flags";
import type { ThemeChoice } from "@/lib/theme";
import {
   LOGIN_EVENT,
   SQUAD,
   WORLDS,
   initialsOf,
   isPlayable,
   publicName,
   type SiteGame,
   type SiteSection,
   type WorldId,
} from "./siteData";
import { CLASSIC_TOTAL, useClassicCompleted, useLocalScores, useTheme } from "./hooks";
import ClassicPath from "./ClassicPath";
import SearchPalette from "./SearchPalette";
import SquadArt from "./SquadArt";
import { BrandMark, ChevronIcon, CubeIcon, GridIcon, HomeIcon, RollIcon, PodiumIcon, SearchIcon, ThemeIcon } from "./icons";
import ui from "./ui.module.css";
import styles from "./SiteHeader.module.css";

export interface SiteHeaderClientProps {
   active: SiteSection;
   /** the visible arcade games, slimmed on the server (empty while the arcade is off) */
   games: SiteGame[];
   /** a game page: a bar that scrolls away, and no phone tab bar (SiteHeader says why) */
   immersive?: boolean;
}

const WORLD_IDS: WorldId[] = [
   "classic",
   ...(ARCADE_ENABLED ? (["arcade"] as const) : []),
   ...(SQUAD_TEASER ? (["squad"] as const) : []),
];

/** The leaderboards page exists only with the arcade and its leaderboards on. */
const BOARDS = ARCADE_ENABLED && ARCADE_LEADERBOARD;

const THEMES: Array<{ id: ThemeChoice; label: string }> = [
   { id: "system", label: "System" },
   { id: "light", label: "Light" },
   { id: "dark", label: "Dark" },
];

const WORLD_ICONS = { classic: GridIcon, arcade: CubeIcon, squad: RollIcon } as const;

function MegaLink({ href, children, index }: { href: string; children: React.ReactNode; index: number }) {
   return (
      <Link href={href} className={styles.megaLink} style={{ "--i": index } as React.CSSProperties}>
         {children}
         <ChevronIcon />
      </Link>
   );
}

export default function SiteHeaderClient({ active, games, immersive = false }: SiteHeaderClientProps) {
   const { user, isAuthenticated, login, register, logout } = useAuth();
   const pathname = usePathname();
   const rootRef = useRef<HTMLElement>(null);
   const openTimer = useRef<number>();
   const closeTimer = useRef<number>();
   const [openWorld, setOpenWorld] = useState<WorldId | null>(null);
   const [menu, setMenu] = useState<"theme" | "account" | null>(null);
   const [searching, setSearching] = useState(false);
   const [modal, setModal] = useState<"login" | "register" | null>(null);
   // classic progress is read once the Classic panel has been opened (hooks.ts)
   const [classicSeen, setClassicSeen] = useState(false);
   const [theme, setTheme] = useTheme();
   const classicDone = useClassicCompleted(classicSeen);
   const scores = useLocalScores();

   const playable = games.filter(isPlayable);
   const played = playable.filter((game) => scores[game.slug as keyof typeof scores]).length;
   // the newest games with art first: the mega panel's featured tiles
   const featured = [...playable]
      .filter((game) => game.thumbnail)
      .sort((a, b) => b.order - a.order)
      .slice(0, 3);

   const closeAll = useCallback(() => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
      setOpenWorld(null);
      setMenu(null);
   }, []);

   const showWorld = useCallback((id: WorldId, delay: number) => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(openTimer.current);
      openTimer.current = window.setTimeout(() => {
         setMenu(null);
         setOpenWorld(id);
         if (id === "classic") setClassicSeen(true);
      }, delay);
   }, []);

   const hideWorldSoon = useCallback(() => {
      window.clearTimeout(openTimer.current);
      closeTimer.current = window.setTimeout(() => setOpenWorld(null), 240);
   }, []);

   // a new page closes everything
   useEffect(() => {
      closeAll();
      setSearching(false);
   }, [pathname, closeAll]);

   useEffect(() => {
      const onKey = (event: KeyboardEvent) => {
         if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            closeAll();
            setSearching(true);
         } else if (event.key === "Escape") {
            closeAll();
         }
      };
      const onPointer = (event: MouseEvent) => {
         if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeAll();
      };
      // a page asks for the login sheet; with detail "register" for the register sheet
      const onLogin = (event: Event) => {
         closeAll();
         setModal((event as CustomEvent).detail === "register" ? "register" : "login");
      };
      document.addEventListener("keydown", onKey);
      document.addEventListener("mousedown", onPointer);
      window.addEventListener(LOGIN_EVENT, onLogin);
      return () => {
         document.removeEventListener("keydown", onKey);
         document.removeEventListener("mousedown", onPointer);
         window.removeEventListener(LOGIN_EVENT, onLogin);
         window.clearTimeout(openTimer.current);
         window.clearTimeout(closeTimer.current);
      };
   }, [closeAll]);

   const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

   const tabs: Array<{ id: SiteSection; label: string; href: string; Icon: typeof HomeIcon }> = [
      { id: "home", label: "Home", href: "/", Icon: HomeIcon },
      ...WORLD_IDS.map((id) => ({
         id: id as SiteSection,
         label: id === "classic" ? "Classic" : id === "arcade" ? "Arcade" : "Squad",
         href: WORLDS[id].href,
         Icon: WORLD_ICONS[id],
      })),
      ...(BOARDS ? [{ id: "leaderboards" as SiteSection, label: "Ranks", href: "/leaderboards", Icon: PodiumIcon }] : []),
   ];

   return (
      <>
         <header className={immersive ? `${styles.bar} ${styles.barStatic}` : styles.bar} ref={rootRef}>
            <div
               className={`${ui.wrap} ${styles.inner}`}
               onMouseLeave={hideWorldSoon}
               onMouseEnter={() => window.clearTimeout(closeTimer.current)}
               onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpenWorld(null);
               }}
            >
               <Link href="/" className={styles.brand} aria-label="Play50Games home">
                  <BrandMark className={styles.mark} />
                  <span>
                     Play<b>50</b>
                     <i>Games</i>
                  </span>
               </Link>

               <nav className={styles.switch} aria-label="Game worlds">
                  {WORLD_IDS.map((id) => {
                     const world = WORLDS[id];
                     const on = openWorld === id || (openWorld === null && active === id);
                     return (
                        <Link
                           key={id}
                           href={world.href}
                           className={on ? `${styles.seg} ${styles.segOn}` : styles.seg}
                           aria-current={active === id ? "page" : undefined}
                           aria-expanded={openWorld === id}
                           aria-controls="site-mega"
                           onMouseEnter={() => {
                              if (canHover()) showWorld(id, openWorld ? 0 : 90);
                           }}
                           onMouseLeave={() => window.clearTimeout(openTimer.current)}
                           onFocus={() => showWorld(id, 0)}
                           onClick={closeAll}
                        >
                           <span className={ui.plate}>{world.plate}</span>
                           {world.label}
                        </Link>
                     );
                  })}
               </nav>

               {openWorld ? (
                  <div className={styles.mega} id="site-mega">
                     <div className={styles.megaPanel} key={openWorld}>
                        <div className={styles.megaA}>
                           <span className={`${ui.plate} ${ui.plateLg}`}>{WORLDS[openWorld].plate}</span>
                           <p className={styles.megaTitle}>{WORLDS[openWorld].title}</p>
                           <p className={styles.megaText}>{WORLDS[openWorld].text}</p>

                           {openWorld === "classic" ? (
                              <div className={styles.progress}>
                                 <span>
                                    {classicDone === null ? "–" : String(classicDone).padStart(2, "0")} / {CLASSIC_TOTAL} games
                                    finished
                                 </span>
                                 <div className={ui.meter}>
                                    <i
                                       className={ui.meterFill}
                                       style={{ "--v": (classicDone ?? 0) / CLASSIC_TOTAL } as React.CSSProperties}
                                    />
                                 </div>
                              </div>
                           ) : null}
                           {openWorld === "arcade" ? (
                              <div className={styles.progress}>
                                 <span>
                                    {String(played).padStart(2, "0")} / {playable.length} games played
                                 </span>
                                 <div className={ui.meter}>
                                    <i
                                       className={ui.meterFill}
                                       style={
                                          { "--v": playable.length ? played / playable.length : 0 } as React.CSSProperties
                                       }
                                    />
                                 </div>
                              </div>
                           ) : null}
                           {openWorld === "squad" ? (
                              <div className={styles.progress}>
                                 <span>Opens soon</span>
                              </div>
                           ) : null}

                           <Link
                              href={WORLDS[openWorld].href}
                              className={`${ui.btn} ${ui.btnPrimary} ${styles.megaCta}`}
                              onClick={closeAll}
                           >
                              {openWorld === "classic"
                                 ? classicDone
                                    ? "Continue Classic 50"
                                    : "Play Classic 50"
                                 : openWorld === "arcade"
                                   ? "Enter 3D Arcade"
                                   : "Meet the squad"}
                           </Link>
                        </div>

                        <div className={styles.megaLinks}>
                           {openWorld === "classic" ? (
                              <>
                                 <p className={ui.label}>Go to</p>
                                 <MegaLink href="/classic" index={0}>
                                    All 50 games
                                 </MegaLink>
                                 <MegaLink href="/progress" index={1}>
                                    My progress
                                 </MegaLink>
                                 <MegaLink href="/certificate" index={2}>
                                    Certificate
                                 </MegaLink>
                                 <MegaLink href="/verify" index={3}>
                                    Verify a certificate
                                 </MegaLink>
                              </>
                           ) : null}
                           {openWorld === "arcade" ? (
                              <>
                                 <p className={ui.label}>Play now</p>
                                 {playable.slice(0, 5).map((game, index) => (
                                    <MegaLink key={game.slug} href={`/3d/${game.slug}`} index={index}>
                                       {game.title}
                                    </MegaLink>
                                 ))}
                                 <MegaLink href="/3d" index={5}>
                                    All {games.length} games
                                 </MegaLink>
                                 {BOARDS ? (
                                    <MegaLink href="/leaderboards" index={6}>
                                       Leaderboards
                                    </MegaLink>
                                 ) : null}
                              </>
                           ) : null}
                           {openWorld === "squad" ? (
                              <>
                                 <p className={ui.label}>The five</p>
                                 <ul className={styles.roster}>
                                    {SQUAD.map((hero) => (
                                       <li key={hero.name}>
                                          <i className={ui.ring} style={{ "--ring": hero.color } as React.CSSProperties} />
                                          {hero.name}
                                          <span>{hero.ability}</span>
                                       </li>
                                    ))}
                                 </ul>
                              </>
                           ) : null}
                        </div>

                        <div className={styles.megaArt}>
                           {openWorld === "classic" ? (
                              <>
                                 <p className={ui.label}>Your path</p>
                                 <div className={styles.pathBox}>
                                    <ClassicPath count={40} size="sm" enabled={classicSeen} />
                                 </div>
                              </>
                           ) : null}
                           {openWorld === "arcade" ? (
                              <>
                                 <p className={ui.label}>Newest</p>
                                 {featured.map((game, index) => (
                                    <Link
                                       key={game.slug}
                                       href={`/3d/${game.slug}`}
                                       className={index === 0 ? `${styles.mini} ${styles.miniWide}` : styles.mini}
                                       onClick={closeAll}
                                    >
                                       {/* eslint-disable-next-line @next/next/no-img-element */}
                                       <img src={game.thumbnail ?? ""} alt="" />
                                       {game.title}
                                    </Link>
                                 ))}
                              </>
                           ) : null}
                           {openWorld === "squad" ? (
                              <>
                                 <p className={ui.label}>The squad</p>
                                 <div className={styles.pathBox}>
                                    <SquadArt />
                                 </div>
                              </>
                           ) : null}
                        </div>
                     </div>
                  </div>
               ) : null}

               <div className={styles.right}>
                  {ARCADE_ENABLED ? (
                     <button
                        type="button"
                        className={styles.search}
                        onClick={() => {
                           closeAll();
                           setSearching(true);
                        }}
                        aria-label="Find a game"
                     >
                        <SearchIcon />
                        <span>Find a game</span>
                        <kbd className={ui.kbd}>Ctrl K</kbd>
                     </button>
                  ) : null}

                  {BOARDS ? (
                     <Link
                        href="/leaderboards"
                        className={styles.link}
                        aria-current={active === "leaderboards" ? "page" : undefined}
                     >
                        Leaderboards
                     </Link>
                  ) : null}

                  <div className={styles.anchor}>
                     <button
                        type="button"
                        className={ui.iconBtn}
                        aria-label="Theme"
                        aria-expanded={menu === "theme"}
                        onClick={() => {
                           setOpenWorld(null);
                           setMenu(menu === "theme" ? null : "theme");
                        }}
                     >
                        <ThemeIcon />
                     </button>
                     {menu === "theme" ? (
                        <div className={styles.pop}>
                           <p className={`${ui.label} ${styles.popLabel}`}>Theme</p>
                           <div className={styles.seg3} role="group" aria-label="Theme">
                              {THEMES.map((item) => (
                                 <button
                                    key={item.id}
                                    type="button"
                                    aria-pressed={theme === item.id}
                                    onClick={() => setTheme(item.id)}
                                 >
                                    {item.label}
                                 </button>
                              ))}
                           </div>
                        </div>
                     ) : null}
                  </div>

                  {isAuthenticated && user ? (
                     <div className={styles.anchor}>
                        <button
                           type="button"
                           className={styles.avatar}
                           aria-label="Account menu"
                           aria-expanded={menu === "account"}
                           onClick={() => {
                              setOpenWorld(null);
                              setMenu(menu === "account" ? null : "account");
                           }}
                        >
                           {initialsOf(user)}
                        </button>
                        {menu === "account" ? (
                           <div className={styles.pop}>
                              <div className={styles.me}>
                                 <span className={styles.avatar} aria-hidden="true">
                                    {initialsOf(user)}
                                 </span>
                                 <b>{user.display_name || user.email}</b>
                                 <span>Scores show as {publicName(user)}</span>
                              </div>
                              <Link href="/progress" className={styles.popLink} onClick={closeAll}>
                                 My progress
                              </Link>
                              <Link href="/certificate" className={styles.popLink} onClick={closeAll}>
                                 Certificate
                              </Link>
                              <Link href="/verify" className={styles.popLink} onClick={closeAll}>
                                 Verify a certificate
                              </Link>
                              <Link href="/faq" className={styles.popLink} onClick={closeAll}>
                                 Help
                              </Link>
                              <Link href="/contact-us" className={styles.popLink} onClick={closeAll}>
                                 Contact
                              </Link>
                              <button
                                 type="button"
                                 className={`${styles.popLink} ${styles.popOut}`}
                                 onClick={() => {
                                    closeAll();
                                    void logout();
                                 }}
                              >
                                 Log out
                              </button>
                           </div>
                        ) : null}
                     </div>
                  ) : (
                     <button
                        type="button"
                        className={`${ui.btn} ${ui.btnQuiet} ${ui.btnSm}`}
                        onClick={() => {
                           closeAll();
                           setModal("login");
                        }}
                     >
                        Log in
                     </button>
                  )}
               </div>
            </div>
         </header>

         {!immersive && (
            <nav className={styles.tabs} aria-label="Main">
               {tabs.map(({ id, label, href, Icon }) => (
                  <Link key={id} href={href} className={styles.tab} aria-current={active === id ? "page" : undefined}>
                     <Icon />
                     {label}
                  </Link>
               ))}
            </nav>
         )}

         <SearchPalette
            open={searching}
            onClose={() => setSearching(false)}
            games={games}
            worlds={WORLD_IDS}
            boards={BOARDS}
         />

         <LoginModal
            isOpen={modal === "login"}
            onClose={() => setModal(null)}
            onLogin={login}
            onSwitchToRegister={() => setModal("register")}
         />
         <RegisterModal
            isOpen={modal === "register"}
            onClose={() => setModal(null)}
            onRegister={register}
            onSwitchToLogin={() => setModal("login")}
         />
      </>
   );
}
