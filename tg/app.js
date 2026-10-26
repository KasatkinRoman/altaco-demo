/* Al'taco Telegram Mini App (demo): menu → cart → checkout using Telegram's MainButton,
 * BackButton and haptics. Works in a regular browser too, with an on-page button instead.
 * Menu data: ../menu.js (generated from all-taco.ru). Orders are not sent anywhere. */

const FREE_DELIVERY_FROM = 3500;
const DELIVERY_FEE = 600;
const MIN_ORDER = 200;
const PICKUP_DISCOUNT = 0.2;
const UPSELL_LIMIT = 6;
const STORAGE_KEY = "altaco-tg-cart";
const BRAND_RED = "#d62f1f";
const FILTERS = [
  { id: "остро", name: "🌶 Остро" },
  { id: "вегги", name: "🥑 Вегги" },
  { id: "новинка", name: "Новинки" },
  { id: "мегапорция", name: "Мегапорции" },
];
const LABEL_CLASS = { "остро": "hot", "вегги": "veg", "новинка": "new" };
const UPSELL_CATEGORIES = ["Соусы", "Напитки"];
const SCREENS = ["menu", "cart", "checkout", "done"];

const tg = window.Telegram?.WebApp;
const inTelegram = Boolean(tg && tg.initData);
const dishes = MENU.dishes;
const byId = new Map(dishes.map((d) => [d.id, d]));
const categoryName = new Map(MENU.categories.map((c) => [c.id, c.name]));
const el = (id) => document.getElementById(id);
const rub = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const haptic = (kind) => { try { tg?.HapticFeedback?.impactOccurred(kind); } catch { /* not supported */ } };

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([id, qty]) => byId.has(id) && qty > 0));
  } catch {
    return {};
  }
}

let state = { screen: "menu", mode: "delivery", cart: loadCart(), filters: [] };

function setState(patch) {
  state = { ...state, ...patch };
  if (patch.cart) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cart)); } catch { /* memory only */ }
  }
  render();
}

function setQty(id, qty) {
  const cart = { ...state.cart };
  if (qty > 0) cart[id] = qty; else delete cart[id];
  haptic(qty > (state.cart[id] || 0) ? "light" : "soft");
  setState({ cart });
}

function totals() {
  const lines = Object.entries(state.cart).map(([id, qty]) => ({ dish: byId.get(id), qty }));
  const subtotal = lines.reduce((s, l) => s + l.dish.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const pickup = state.mode === "pickup";
  const discount = pickup ? Math.round(subtotal * PICKUP_DISCOUNT) : 0;
  const delivery = pickup || !subtotal || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  return { lines, subtotal, count, discount, delivery, total: subtotal - discount + delivery, toFree: Math.max(0, FREE_DELIVERY_FROM - subtotal) };
}

/* ---------- Pieces ---------- */

const labelsHtml = (d) => (d.labels.length
  ? `<div class="labels">${d.labels.map((l) => `<span class="label ${LABEL_CLASS[l] || ""}">${esc(l)}</span>`).join("")}</div>` : "");

function qtyHtml(d) {
  const qty = state.cart[d.id] || 0;
  return qty
    ? `<div class="qty"><button type="button" data-dec="${d.id}" aria-label="Убрать одну">−</button><output>${qty}</output><button type="button" data-inc="${d.id}" aria-label="Добавить ещё">+</button></div>`
    : `<button class="add" type="button" data-inc="${d.id}">${rub(d.price)}</button>`;
}

function modeButtons() {
  return [["delivery", "Доставка"], ["pickup", "Самовывоз −20%"]]
    .map(([id, label]) => `<button type="button" data-mode="${id}" aria-pressed="${state.mode === id}">${label}</button>`).join("");
}

function summaryHtml(t) {
  const rows = [
    ["Блюда", rub(t.subtotal), ""],
    ...(t.discount ? [["Скидка за самовывоз", "−" + rub(t.discount), "discount"]] : []),
    ...(state.mode === "delivery" ? [["Доставка", t.delivery ? rub(t.delivery) : "бесплатно", ""]] : []),
    ["Итого", rub(t.total), "total"],
  ];
  return rows.map(([k, v, cls]) => `<div class="row ${cls}"><span>${k}</span><span>${v}</span></div>`).join("")
    + (t.subtotal < MIN_ORDER ? `<div class="warn">Минимальный заказ — ${rub(MIN_ORDER)}</div>` : "");
}

/* ---------- Screens ---------- */

function renderMenu() {
  el("modeSwitch").innerHTML = modeButtons();
  el("modeHint").textContent = state.mode === "delivery"
    ? `Химки · до 60 мин · бесплатно от ${rub(FREE_DELIVERY_FROM)}` : "Самовывоз · скидка 20% на заказ";
  el("filters").innerHTML = FILTERS.map((f) =>
    `<button class="chip" type="button" data-filter="${f.id}" aria-pressed="${state.filters.includes(f.id)}">${f.name}</button>`).join("");
  const visible = (d) => state.filters.every((f) => d.labels.includes(f));
  const cats = MENU.categories.filter((c) => dishes.some((d) => d.category === c.id && visible(d)));
  el("cats").innerHTML = cats.map((c) => `<button class="cat" type="button" data-cat="${c.id}">${esc(c.name)}</button>`).join("");
  el("catalog").innerHTML = cats.map((c) => `<section class="section" id="cat-${c.id}"><h2>${esc(c.name)}</h2><div class="grid">${
    dishes.filter((d) => d.category === c.id && visible(d)).map((d) => `<article class="card">
      <button class="photo" type="button" data-open="${d.id}" aria-label="${esc(d.name)}"><img src="${esc(d.thumb)}" alt="" loading="lazy">${labelsHtml(d)}</button>
      <div class="body"><h3>${esc(d.name)}</h3><span class="meta">${esc(d.weight)}</span><div class="buy">${qtyHtml(d)}</div></div>
    </article>`).join("")}</div></section>`).join("") || '<p class="empty">Нет блюд с такими фильтрами</p>';
  observeSections();
}

function renderCart() {
  const t = totals();
  if (!t.count) { el("cartBody").innerHTML = '<p class="empty">Корзина пуста 🌮</p>'; return; }
  const lines = t.lines.map(({ dish, qty }) => `<div class="line"><img src="${esc(dish.thumb)}" alt="">
    <div><div class="name">${esc(dish.name)}</div><div class="sum">${rub(dish.price * qty)}</div></div>${qtyHtml(dish)}</div>`).join("");
  const progress = state.mode === "pickup"
    ? `<div class="progress">Самовывоз: скидка 20% — <b>−${rub(t.discount)}</b></div>`
    : `<div class="progress">${t.toFree ? `До бесплатной доставки — <b>${rub(t.toFree)}</b>` : "<b>Доставка бесплатно</b> 🎉"}<div class="bar"><i style="width:${Math.min(100, t.subtotal / FREE_DELIVERY_FROM * 100)}%"></i></div></div>`;
  const picks = dishes.filter((d) => UPSELL_CATEGORIES.includes(categoryName.get(d.category)) && !state.cart[d.id])
    .sort((a, b) => a.price - b.price).slice(0, UPSELL_LIMIT);
  const upsell = picks.length ? `<div class="upsell"><h3>Добавить к заказу</h3><div class="upsell-row">${picks.map((d) =>
    `<div class="mini"><img src="${esc(d.thumb)}" alt=""><div>${esc(d.name)}<button class="add" type="button" data-inc="${d.id}">+ ${rub(d.price)}</button></div></div>`).join("")}</div></div>` : "";
  el("cartBody").innerHTML = lines + progress + upsell + `<div class="summary">${summaryHtml(t)}</div>`;
}

function renderCheckout() {
  el("modeSwitch2").innerHTML = modeButtons();
  el("addrField").hidden = state.mode !== "delivery";
  el("checkoutSummary").innerHTML = summaryHtml(totals());
  el("sharePhone").hidden = !(inTelegram && tg.requestContact);
}

/* Telegram MainButton / BackButton, or an on-page button in a regular browser. */
function renderControls() {
  const t = totals();
  const config = {
    menu: t.count ? { text: `Корзина · ${rub(t.total)}`, action: () => setState({ screen: "cart" }) } : null,
    cart: t.count && t.subtotal >= MIN_ORDER ? { text: "Оформить заказ", action: () => setState({ screen: "checkout" }) } : null,
    checkout: { text: `Заказать за ${rub(t.total)}`, action: submitOrder },
    done: { text: "Вернуться в меню", action: () => setState({ screen: "menu" }) },
  }[state.screen];
  mainAction = config?.action || null;
  if (inTelegram) {
    if (config) { tg.MainButton.setParams({ text: config.text, color: BRAND_RED, text_color: "#ffffff", is_visible: true }); }
    else tg.MainButton.hide();
    if (["cart", "checkout"].includes(state.screen)) tg.BackButton.show(); else tg.BackButton.hide();
  } else {
    el("fallbackMain").hidden = !config;
    if (config) el("fallbackMain").textContent = config.text;
  }
}

function render() {
  SCREENS.forEach((s) => { el(`screen${s[0].toUpperCase()}${s.slice(1)}`).hidden = state.screen !== s; });
  if (state.screen === "menu") renderMenu();
  if (state.screen === "cart") renderCart();
  if (state.screen === "checkout") renderCheckout();
  renderControls();
}

/* ---------- Dish sheet ---------- */

function openDish(id) {
  const d = byId.get(id);
  el("sheet").innerHTML = `<div class="grab"></div><div style="position:relative"><img src="${esc(d.photo)}" alt="">${labelsHtml(d)}</div>
    <div class="info"><span class="meta" style="color:var(--hint);font-size:13px">${esc(categoryName.get(d.category))} · ${esc(d.weight)}</span>
    <h3 id="sheetTitle">${esc(d.name)}</h3><p>${esc(d.about)}</p>
    ${d.ingredients ? `<div class="ingredients"><b>Состав:</b> ${esc(d.ingredients)}</div>` : ""}
    <div class="buy" data-sheet-buy="${d.id}">${qtyHtml(d)}</div></div>`;
  el("sheet").hidden = false;
  el("sheetBackdrop").hidden = false;
  sheetOpenFor = id;
}
function closeSheet() {
  el("sheet").hidden = true;
  el("sheetBackdrop").hidden = true;
  sheetOpenFor = null;
}
let sheetOpenFor = null;

/* ---------- Category highlight ---------- */

let observer;
function observeSections() {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e) => {
      const id = e.target.id.replace("cat-", "");
      const strip = el("cats");
      strip.querySelectorAll(".cat").forEach((b) => b.classList.toggle("active", b.dataset.cat === id));
      const link = strip.querySelector(`[data-cat="${id}"]`);
      if (link) strip.scrollTo({ left: Math.max(0, link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2), behavior: "smooth" });
    });
  }, { rootMargin: "-120px 0px -65% 0px" });
  document.querySelectorAll(".section").forEach((s) => observer.observe(s));
}

/* ---------- Checkout ---------- */

function validate(form) {
  const v = (n) => (form.elements[n]?.value || "").trim();
  if (v("name").length < 2) return "Укажите имя.";
  if (v("phone").replace(/\D/g, "").length < 10) return "Проверьте номер телефона.";
  if (state.mode === "delivery" && v("address").length < 5) return "Укажите адрес доставки.";
  if (totals().subtotal < MIN_ORDER) return `Минимальный заказ — ${rub(MIN_ORDER)}.`;
  return "";
}

function submitOrder() {
  const form = el("orderForm");
  const error = validate(form);
  el("orderErr").textContent = error;
  if (error) { try { tg?.HapticFeedback?.notificationOccurred("error"); } catch { /* ignore */ } return; }
  const t = totals();
  try { tg?.HapticFeedback?.notificationOccurred("success"); } catch { /* ignore */ }
  el("doneText").textContent = `Заказ на ${rub(t.total)} принят (демо). В рабочей версии здесь откроется оплата, а заказ придёт в чат кафе.`;
  setState({ screen: "done", cart: {} });
}

/* ---------- Events ---------- */

let mainAction = null;
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.inc) setQty(d.inc, (state.cart[d.inc] || 0) + 1);
  else if (d.dec) setQty(d.dec, (state.cart[d.dec] || 0) - 1);
  else if (d.open) openDish(d.open);
  else if (d.mode) { haptic("light"); setState({ mode: d.mode }); }
  else if (d.filter) setState({ filters: state.filters.includes(d.filter) ? state.filters.filter((f) => f !== d.filter) : [...state.filters, d.filter] });
  else if (d.cat) {
    const target = el(`cat-${d.cat}`);
    if (target) window.scrollTo({ top: target.offsetTop - 110, behavior: "smooth" });
  }
  if ((d.inc || d.dec) && sheetOpenFor) {
    const box = document.querySelector(`[data-sheet-buy="${sheetOpenFor}"]`);
    if (box) box.innerHTML = qtyHtml(byId.get(sheetOpenFor));
  }
});
el("sheetBackdrop").addEventListener("click", closeSheet);
el("fallbackMain").addEventListener("click", () => mainAction?.());
el("sharePhone").addEventListener("click", () => {
  tg.requestContact((shared, result) => {
    const phone = result?.responseUnsafe?.contact?.phone_number;
    if (shared && phone) el("orderForm").elements.phone.value = phone.startsWith("+") ? phone : `+${phone}`;
  });
});

if (inTelegram) {
  tg.ready();
  tg.expand();
  try { tg.setHeaderColor("bg_color"); } catch { /* old clients */ }
  tg.MainButton.onClick(() => mainAction?.());
  tg.BackButton.onClick(() => setState({ screen: state.screen === "checkout" ? "cart" : "menu" }));
  const user = tg.initDataUnsafe?.user;
  if (user?.first_name) el("orderForm").elements.name.value = user.first_name;
}
render();
