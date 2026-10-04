/**
 * DOM page for the paw, the pause menu, the pickup card, and the Archives hall.
 * Every menu shares one Imagine backdrop (backdrop.js). Words are HTML text.
 * A later 3D hub replaces this view and keeps catalogue.js.
 */

import { HALL_LOOP, PAW_GLOW, mountMenuBackdrop } from "./backdrop.js";
import { buildCatalogue } from "./catalogue.js";
import {
  cardBox,
  cardOpacity,
  chromeLayout,
  containBox,
  plateBox,
} from "./layout.js";

const STYLE = `
#archives-root { position: fixed; inset: 0; z-index: 6; pointer-events: none; }
#archives-paw {
  position: fixed; z-index: 6; padding: 0; border: 0; background: transparent;
  pointer-events: auto; line-height: 0; isolation: isolate;
}
#archives-paw img { display: block; width: 100%; height: 100%; object-fit: contain; }
#archives-paw .archives-paw-glow {
  position: absolute; inset: 0; pointer-events: none;
  mix-blend-mode: screen;
  animation: archives-paw-glow ${PAW_GLOW.periodS}s ease-in-out infinite alternate;
}
@keyframes archives-paw-glow {
  from { opacity: ${PAW_GLOW.min}; }
  to { opacity: ${PAW_GLOW.max}; }
}
@media (prefers-reduced-motion: reduce) {
  #archives-paw .archives-paw-glow { animation: none; opacity: ${PAW_GLOW.min}; }
}
#archives-shade, #archives-screen {
  position: fixed; inset: 0; z-index: 8; display: none; pointer-events: auto; overflow: hidden;
  background: transparent;
}
#archives-shade.open, #archives-screen.open { display: block; }
#archives-menu, #archives-list {
  position: absolute; color: #f4f1ea;
  font-family: "Iowan Old Style", Palatino, Georgia, serif;
  text-shadow: 0 1px 2px rgba(0,0,0,0.85);
}
#archives-menu { display: flex; flex-direction: column; justify-content: center; gap: 4px; }
#archives-menu button, #archives-list button {
  background: transparent; border: 0; color: inherit; font: inherit;
  padding: 12px 8px; text-align: center; pointer-events: auto;
}
#archives-menu button:disabled { opacity: 0.45; }
#archives-menu .archives-soon { display: block; font-size: 12px; letter-spacing: 0.08em; }
#archives-list { left: 0; right: 0; top: 0; bottom: 0; overflow: auto; padding: 28px 22px 140px; box-sizing: border-box; }
#archives-list h1 { font-size: 28px; font-weight: 500; margin: 0 0 4px; text-align: center; }
#archives-list .archives-count { text-align: center; margin: 0 0 18px; font-size: 14px; letter-spacing: 0.12em; }
#archives-list article { display: grid; grid-template-columns: 76px 1fr; gap: 10px 12px; margin: 0 0 16px; align-items: center; }
#archives-list h2 { font-size: 18px; font-weight: 500; margin: 0; }
#archives-list article p { grid-column: 2; margin: 0; font-size: 14px; line-height: 1.35; }
#archives-list img { justify-self: center; }
#archives-card {
  position: fixed; z-index: 6; pointer-events: none; display: none;
  color: #f4f1ea; font-family: "Iowan Old Style", Palatino, Georgia, serif;
  text-shadow: 0 1px 2px rgba(0,0,0,0.85); text-align: center;
}
#archives-card img { display: block; margin: 0 auto; }
#archives-card p { margin: 6px 0 0; font-size: 14px; line-height: 1.35; }
@keyframes archives-float {
  from { transform: translateY(0); }
  to { transform: translateY(-6px); }
}
.archives-float { animation: archives-float 2.6s ease-in-out infinite alternate; }
`;

function dprOf() {
  return Math.min(2, Math.max(1, (typeof window !== "undefined" && window.devicePixelRatio) || 1));
}

export function mountPresent(doc, env) {
  const resolver = env.absUrl;
  if (!doc.getElementById("archives-style")) {
    const style = doc.createElement("style");
    style.id = "archives-style";
    style.textContent = STYLE;
    doc.head.appendChild(style);
  }
  const root = doc.createElement("div");
  root.id = "archives-root";

  const pawSrc = resolver(env.ui.paw);
  const paw = doc.createElement("button");
  paw.id = "archives-paw";
  paw.type = "button";
  paw.setAttribute("aria-label", "Pack");
  const pawImg = doc.createElement("img");
  pawImg.alt = "";
  pawImg.src = pawSrc;
  const pawGlow = doc.createElement("img");
  pawGlow.className = "archives-paw-glow";
  pawGlow.alt = "";
  pawGlow.src = pawSrc;
  paw.append(pawImg, pawGlow);

  const backdrop = mountMenuBackdrop(doc, {
    stillSrc: resolver(env.ui.hall),
    videoSrc: resolver(env.ui.hallVideo || HALL_LOOP),
  });

  const shade = doc.createElement("div");
  shade.id = "archives-shade";
  const menu = doc.createElement("div");
  menu.id = "archives-menu";
  shade.append(menu);

  const card = doc.createElement("div");
  card.id = "archives-card";
  const cardImg = doc.createElement("img");
  cardImg.alt = "";
  const cardText = doc.createElement("p");
  card.append(cardImg, cardText);

  const screen = doc.createElement("div");
  screen.id = "archives-screen";
  const list = doc.createElement("div");
  list.id = "archives-list";
  screen.append(list);

  root.append(paw, card);
  doc.body.append(root, backdrop.el, shade, screen);

  let menuOpen = false;
  let archivesOpen = false;
  let menuView = "main";
  let cardOn = false;
  let cardT = 0;
  let cardTotal = env.cardMs || 2500;
  let countLine = "0 of 0";
  const openScreens = new Set();

  function viewSize() {
    return {
      w: window.innerWidth || 360,
      h: window.innerHeight || 800,
    };
  }

  function layoutPaw() {
    const { w, h } = viewSize();
    const nw = pawImg.naturalWidth || 944;
    const nh = pawImg.naturalHeight || 1088;
    const fit = containBox(nw, nh, 56, 64, dprOf());
    const box = chromeLayout(w, h, fit.cssW, fit.cssH).paw;
    paw.style.left = box.x + "px";
    paw.style.top = box.y + "px";
    paw.style.width = box.w + "px";
    paw.style.height = box.h + "px";
  }

  function layoutMenu() {
    const { w, h } = viewSize();
    const box = plateBox(w, h);
    menu.style.left = box.x + "px";
    menu.style.top = box.y + "px";
    menu.style.width = box.w + "px";
    menu.style.height = box.h + "px";
  }

  function layoutBackdrop() {
    const { w, h } = viewSize();
    backdrop.layout(w, h, dprOf());
  }

  function layoutCard() {
    const { w, h } = viewSize();
    const box = cardBox(w, h);
    card.style.left = box.x + "px";
    card.style.top = box.y + "px";
    card.style.width = box.w + "px";
    if (cardImg.naturalWidth) {
      const fit = containBox(cardImg.naturalWidth, cardImg.naturalHeight, box.w, Math.min(112, box.h - 48), dprOf());
      cardImg.style.width = fit.cssW + "px";
      cardImg.style.height = fit.cssH + "px";
    }
  }

  function applyCard(blocked) {
    if (!cardOn) {
      card.style.display = "none";
      return;
    }
    card.style.display = "block";
    const op = blocked ? 0 : cardOpacity(cardT, cardTotal);
    card.style.opacity = String(op);
    if (!blocked && cardT >= cardTotal) {
      cardOn = false;
      card.style.display = "none";
    }
  }

  function setPawVisible(on) {
    paw.style.display = on ? "block" : "none";
    const stick = doc.getElementById("stick");
    if (stick) stick.style.visibility = (menuOpen || archivesOpen) ? "hidden" : "";
  }

  function setScreen(name, on) {
    if (on) openScreens.add(name);
    else openScreens.delete(name);
    const any = openScreens.size > 0;
    backdrop.setOpen(any);
    if (any) layoutBackdrop();
    if (env.onHold) env.onHold(any);
  }

  function fillMain() {
    menu.replaceChildren();
    const resume = doc.createElement("button");
    resume.type = "button";
    resume.textContent = "Resume";
    const archives = doc.createElement("button");
    archives.type = "button";
    archives.textContent = "Archives";
    const citadel = doc.createElement("button");
    citadel.type = "button";
    citadel.disabled = true;
    citadel.append("Citadel");
    const soon = doc.createElement("span");
    soon.className = "archives-soon";
    soon.textContent = "coming soon";
    citadel.append(soon);
    const settings = doc.createElement("button");
    settings.type = "button";
    settings.textContent = "Settings";
    resume.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    });
    archives.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (env.onArchives) env.onArchives();
    });
    settings.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      menuView = "settings";
      fillSettings();
    });
    menu.append(resume, archives, citadel, settings);
  }

  function fillSettings() {
    menu.replaceChildren();
    const a = doc.createElement("p");
    a.textContent = "Echoes stay on this device.";
    a.style.margin = "0 12px 8px";
    a.style.textAlign = "center";
    const b = doc.createElement("p");
    b.textContent = countLine;
    b.style.margin = "0 12px 12px";
    b.style.textAlign = "center";
    const back = doc.createElement("button");
    back.type = "button";
    back.textContent = "Resume";
    back.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenu();
    });
    menu.append(a, b, back);
  }

  function openMenu() {
    menuOpen = true;
    menuView = "main";
    shade.classList.add("open");
    setPawVisible(false);
    fillMain();
    layoutMenu();
    setScreen("pause", true);
  }

  function closeMenu() {
    menuOpen = false;
    shade.classList.remove("open");
    setPawVisible(!archivesOpen);
    setScreen("pause", false);
  }

  function fillArchives(cat) {
    list.replaceChildren();
    const title = doc.createElement("h1");
    title.textContent = "Living Archives";
    const count = doc.createElement("p");
    count.className = "archives-count";
    count.textContent = cat.found + " of " + cat.total;
    countLine = cat.found + " of " + cat.total;
    list.append(title, count);
    for (let i = 0; i < cat.shards.length; i++) {
      const s = cat.shards[i];
      const row = doc.createElement("article");
      const img = doc.createElement("img");
      img.alt = "";
      img.src = resolver(s.image);
      if (s.found) img.className = "archives-float";
      img.addEventListener("load", () => {
        const fit = containBox(img.naturalWidth, img.naturalHeight, 72, 96, dprOf());
        img.style.width = fit.cssW + "px";
        img.style.height = fit.cssH + "px";
      });
      const h = doc.createElement("h2");
      h.textContent = s.title;
      row.append(img, h);
      if (s.showLore) {
        const p = doc.createElement("p");
        p.textContent = s.lore;
        row.append(p);
      }
      list.append(row);
    }
    const back = doc.createElement("button");
    back.type = "button";
    back.textContent = "Resume";
    back.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeArchives();
    });
    list.append(back);
  }

  function openArchives(cat) {
    archivesOpen = true;
    setScreen("archives", true);
    closeMenu();
    setPawVisible(false);
    fillArchives(cat);
    screen.classList.add("open");
    layoutBackdrop();
  }

  function closeArchives() {
    archivesOpen = false;
    screen.classList.remove("open");
    setPawVisible(!menuOpen);
    setScreen("archives", false);
  }

  function showCard(shard, total) {
    cardOn = true;
    cardT = 0;
    cardTotal = total || env.cardMs || 2500;
    cardText.textContent = shard.lore;
    const src = resolver(shard.image);
    if (cardImg.getAttribute("src") !== src) cardImg.src = src;
    if (cardImg.complete && cardImg.naturalWidth) layoutCard();
    applyCard(false);
  }

  paw.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu();
  });
  shade.addEventListener("pointerdown", (e) => e.stopPropagation());
  screen.addEventListener("pointerdown", (e) => e.stopPropagation());
  pawImg.addEventListener("load", layoutPaw);
  cardImg.addEventListener("load", layoutCard);
  window.addEventListener("resize", () => {
    layoutPaw();
    if (menuOpen) layoutMenu();
    if (menuOpen || archivesOpen) layoutBackdrop();
    if (cardOn) layoutCard();
  });
  layoutPaw();

  function blocksPlay() {
    return menuOpen || archivesOpen || openScreens.size > 0;
  }

  return {
    blocksPlay,
    pawCorner(vw, vh) {
      return chromeLayout(vw, vh).reserve;
    },
    openMenu,
    closeMenu,
    openArchives,
    closeArchives,
    setScreen,
    showCard,
    setCount(text) { countLine = text; },
    menuVideoOn() { return backdrop.videoOn(); },
    tick(dt, blocked) {
      if (cardOn && !blocked) cardT += Math.max(0, dt) * 1000;
      applyCard(!!blocked);
    },
  };
}

export { buildCatalogue };
