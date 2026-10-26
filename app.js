/* Al'taco prototype: catalog, filters, cart with delivery rules and a demo checkout.
 * Menu data comes from menu.js (generated from all-taco.ru); nothing is sent anywhere. */

const FREE_DELIVERY_FROM = 3500;
const DELIVERY_FEE = 600;
const MIN_ORDER = 200;
const PICKUP_DISCOUNT = 0.2;
const DELIVERY_MINUTES = 60;
const UPSELL_LIMIT = 6;
const STORAGE_KEY = "altaco-cart";
const HERO_DISHES = ["Чимичанга", "Killburger", "Пицца Мексиканская"];
const FILTERS = [
  { id: "остро", name: "🌶 Остро" },
  { id: "вегги", name: "🥑 Вегги" },
  { id: "новинка", name: "Новинки" },
  { id: "мегапорция", name: "Мегапорции" },
];
const LABEL_CLASS = { "остро": "hot", "вегги": "veg", "новинка": "new" };
const UPSELL_CATEGORIES = ["Соусы", "Напитки"];
// Real guest reviews from all-taco.ru/himki/feedback.
const REVIEWS = [
  { who: "Ольга", date: "21.09.2025", text: "Очень вкусно и сбалансировано, острота есть, но она раскрывает вкус блюда." },
  { who: "Гость", date: "07.09.2026", text: "Попробовали первый раз мексиканскую кухню по совету друзей. Любим острое) Очень-очень всё вкусно, сытно и красиво! Будем брать." },
  { who: "Александр", date: "26.06.2025", text: "Буррито супер, острота в меру, доставка быстрая)" },
  { who: "Ксения", date: "02.06.2025", text: "Очень вкусно! Буррито понравился больше всего!" },
];

const dishes = MENU.dishes;
const byId = new Map(dishes.map((d) => [d.id, d]));
const categoryName = new Map(MENU.categories.map((c) => [c.id, c.name]));
const el = (id) => document.getElementById(id);
const rub = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function loadCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Object.fromEntries(Object.entries(saved).filter(([id, qty]) => byId.has(id) && qty > 0));
  } catch {
    return {};
  }
}
function saveCart(cart) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch { /* private mode: cart lives in memory */ }
}

let state = { mode: "delivery", cart: loadCart(), filters: [], query: "", step: "cart" };

function setState(patch) {
  state = { ...state, ...patch };
  if (patch.cart) saveCart(state.cart);
}

function setQty(id, qty) {
  const cart = { ...state.cart };
  if (qty > 0) cart[id] = qty; else delete cart[id];
  setState({ cart });
  renderBuy(id);
  renderCartSummary();
  if (!el("drawer").hidden) renderDrawer();
}

/* ---------- Totals ---------- */

function totals() {
  const lines = Object.entries(state.cart).map(([id, qty]) => ({ dish: byId.get(id), qty }));
  const subtotal = lines.reduce((s, l) => s + l.dish.price * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const pickup = state.mode === "pickup";
  const discount = pickup ? Math.round(subtotal * PICKUP_DISCOUNT) : 0;
  const delivery = pickup || subtotal === 0 || subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE;
  return { lines, subtotal, count, discount, delivery, total: subtotal - discount + delivery, toFree: Math.max(0, FREE_DELIVERY_FROM - subtotal) };
}

/* ---------- Hero ---------- */

function renderMode() {
  el("modeSwitch").innerHTML = [
    ["delivery", "Доставка"],
    ["pickup", 'Самовывоз <span class="tag">−20%</span>'],
  ].map(([id, label]) => `<button type="button" data-mode="${id}" aria-pressed="${state.mode === id}">${label}</button>`).join("");
  const facts = state.mode === "delivery"
    ? [[`${DELIVERY_MINUTES} мин`, "доставка по Химкам"], [`от ${rub(FREE_DELIVERY_FROM)}`, "доставка бесплатно"], [rub(DELIVERY_FEE), "доставка для заказа меньше"], [`от ${rub(MIN_ORDER)}`, "минимальный заказ"]]
    : [["−20%", "на весь заказ"], [`от ${rub(MIN_ORDER)}`, "минимальный заказ"]];
  el("facts").innerHTML = facts.map(([b, s]) => `<li><b>${b}</b><span>${s}</span></li>`).join("");
}

function renderCollage() {
  const picks = HERO_DISHES.map((name) => dishes.find((d) => d.name.includes(name))).filter(Boolean);
  const [a, b, c] = [...picks, ...dishes].slice(0, 3);
  el("collage").innerHTML = `
    <img class="c1" src="${esc(a.photo)}" alt="" loading="eager" fetchpriority="high">
    <img class="c2" src="${esc(b.thumb)}" alt="">
    <img class="c3" src="${esc(c.thumb)}" alt="">
    <div class="sticker">Самовывоз −20%</div>`;
}

/* ---------- Catalog ---------- */

function matches(dish) {
  if (state.filters.length && !state.filters.every((f) => dish.labels.includes(f))) return false;
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return [dish.name, dish.about, dish.ingredients].some((t) => t.toLowerCase().includes(q));
}

function labelsHtml(dish) {
  return dish.labels.length
    ? `<div class="labels">${dish.labels.map((l) => `<span class="label ${LABEL_CLASS[l] || ""}">${esc(l)}</span>`).join("")}</div>`
    : "";
}

function buyHtml(dish) {
  const qty = state.cart[dish.id] || 0;
  const control = qty
    ? `<span class="qty"><button type="button" data-dec="${dish.id}" aria-label="Убрать одну">−</button><output>${qty}</output><button type="button" data-inc="${dish.id}" aria-label="Добавить ещё">+</button></span>`
    : `<button class="add" type="button" data-inc="${dish.id}">+ В корзину</button>`;
  return `<span><span class="price">${rub(dish.price)}</span><span class="weight">${esc(dish.weight)}</span></span>${control}`;
}

function cardHtml(dish) {
  return `<article class="card">
    <button class="photo" type="button" data-open="${dish.id}" aria-label="Подробнее: ${esc(dish.name)}">
      <img src="${esc(dish.thumb)}" alt="${esc(dish.name)}" loading="lazy" width="400" height="300">${labelsHtml(dish)}
    </button>
    <div class="body">
      <h3><button type="button" data-open="${dish.id}">${esc(dish.name)}</button></h3>
      <p>${esc(dish.about)}</p>
      <div class="buy" data-buy="${dish.id}">${buyHtml(dish)}</div>
    </div>
  </article>`;
}

function renderCatalog() {
  const sections = MENU.categories.map((cat) => {
    const items = dishes.filter((d) => d.category === cat.id && matches(d));
    if (!items.length) return "";
    return `<section class="cat-section" id="cat-${cat.id}" aria-labelledby="h-${cat.id}">
      <h2 id="h-${cat.id}">${esc(cat.name)}</h2><div class="grid">${items.map(cardHtml).join("")}</div></section>`;
  }).join("");
  el("catalog").innerHTML = sections || '<p class="empty">Ничего не нашлось — попробуйте другой фильтр или запрос.</p>';
  el("cats").innerHTML = MENU.categories
    .filter((cat) => dishes.some((d) => d.category === cat.id && matches(d)))
    .map((cat) => `<a class="cat" href="#cat-${cat.id}" data-cat="${cat.id}">${esc(cat.name)}</a>`).join("");
  observeSections();
}

function renderFilters() {
  el("filters").innerHTML = FILTERS.map((f) =>
    `<button class="chip" type="button" data-filter="${f.id}" aria-pressed="${state.filters.includes(f.id)}">${f.name}</button>`).join("");
}

function renderBuy(id) {
  const dish = byId.get(id);
  document.querySelectorAll(`[data-buy="${id}"]`).forEach((node) => { node.innerHTML = buyHtml(dish); });
}

/* Scrolls only the category strip sideways. scrollIntoView would also scroll the page
 * and fight the visitor's own scrolling, so the page got stuck below the second section. */
function centerCategoryLink(id) {
  const strip = el("cats");
  const link = strip.querySelector(`.cat[data-cat="${id}"]`);
  if (!link) return;
  const left = link.offsetLeft - (strip.clientWidth - link.offsetWidth) / 2;
  strip.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

let sectionObserver;
function observeSections() {
  sectionObserver?.disconnect();
  sectionObserver = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e) => {
      const id = e.target.id.replace("cat-", "");
      document.querySelectorAll(".cat").forEach((a) => a.classList.toggle("active", a.dataset.cat === id));
      centerCategoryLink(id);
    });
  }, { rootMargin: "-150px 0px -60% 0px" });
  document.querySelectorAll(".cat-section").forEach((s) => sectionObserver.observe(s));
}

/* ---------- Dish dialog ---------- */

function openDish(id) {
  const dish = byId.get(id);
  const dialog = el("dish");
  dialog.innerHTML = `<button class="close" type="button" data-close-dish aria-label="Закрыть">×</button>
    <div class="dish-grid">
      <div style="position:relative"><img src="${esc(dish.photo)}" alt="${esc(dish.name)}">${labelsHtml(dish)}</div>
      <div class="dish-info">
        <span class="weight" style="margin:0">${esc(categoryName.get(dish.category))} · ${esc(dish.weight)}</span>
        <h3 id="dishTitle">${esc(dish.name)}</h3>
        <p>${esc(dish.about)}</p>
        ${dish.ingredients ? `<div class="ingredients"><b>Состав:</b> ${esc(dish.ingredients)}</div>` : ""}
        <div class="buy" data-buy="${dish.id}">${buyHtml(dish)}</div>
      </div>
    </div>`;
  dialog.showModal();
}

/* ---------- Cart drawer ---------- */

function renderCartSummary() {
  const t = totals();
  el("cartCount").textContent = t.count;
  el("mCount").textContent = t.count;
  el("mSum").textContent = rub(t.total);
  el("mobileCart").classList.toggle("has-items", t.count > 0);
}

function progressHtml(t) {
  if (state.mode === "pickup") return `<div class="progress">Самовывоз: скидка 20% — <b>−${rub(t.discount)}</b></div>`;
  const share = Math.min(100, (t.subtotal / FREE_DELIVERY_FROM) * 100);
  const text = t.toFree > 0 ? `До бесплатной доставки — <b>${rub(t.toFree)}</b>` : "<b>Доставка бесплатно</b> 🎉";
  return `<div class="progress">${text}<div class="bar"><i style="width:${share}%"></i></div></div>`;
}

function upsellHtml() {
  const picks = dishes
    .filter((d) => UPSELL_CATEGORIES.includes(categoryName.get(d.category)) && !state.cart[d.id])
    .sort((a, b) => a.price - b.price).slice(0, UPSELL_LIMIT);
  if (!picks.length) return "";
  return `<div class="upsell"><h3>Добавить к заказу</h3><div class="upsell-row">${picks.map((d) => `
    <div class="mini"><img src="${esc(d.thumb)}" alt=""><div>${esc(d.name)}<br><b>${rub(d.price)}</b>
    <button type="button" data-inc="${d.id}">+ Добавить</button></div></div>`).join("")}</div></div>`;
}

function cartBodyHtml(t) {
  if (!t.count) return '<p class="empty">Корзина пуста. Добавьте что-нибудь вкусное из меню 🌮</p>';
  const lines = t.lines.map(({ dish, qty }) => `<div class="line">
    <img src="${esc(dish.thumb)}" alt="">
    <div><div class="name">${esc(dish.name)}</div><div class="sum">${rub(dish.price)} × ${qty}</div></div>
    <span class="qty"><button type="button" data-dec="${dish.id}" aria-label="Убрать одну">−</button><output>${qty}</output><button type="button" data-inc="${dish.id}" aria-label="Добавить ещё">+</button></span>
  </div>`).join("");
  return lines + progressHtml(t) + upsellHtml();
}

function checkoutHtml() {
  const delivery = state.mode === "delivery";
  return `<form class="form" id="orderForm" novalidate>
    <div class="mode light" role="group" aria-label="Способ получения">${[["delivery", "Доставка"], ["pickup", "Самовывоз −20%"]]
      .map(([id, label]) => `<button type="button" data-mode="${id}" aria-pressed="${state.mode === id}">${label}</button>`).join("")}</div>
    <label>Имя<input name="name" autocomplete="name" required></label>
    <label>Телефон<input name="phone" type="tel" autocomplete="tel" placeholder="+7" required></label>
    ${delivery ? '<label>Адрес в Химках<input name="address" autocomplete="street-address" placeholder="Улица, дом, квартира" required></label>' : '<p class="weight" style="margin:0">Адрес самовывоза подтвердим по телефону.</p>'}
    <label>Когда<select name="time"><option>Как можно скорее</option><option>Через 1,5 часа</option><option>Через 2 часа</option><option>К определённому времени — уточним по телефону</option></select></label>
    <div class="pay" role="radiogroup" aria-label="Оплата">
      <label><input type="radio" name="pay" value="online" checked> Онлайн: карта или СБП</label>
      <label><input type="radio" name="pay" value="cash"> Наличными ${delivery ? "курьеру" : "при получении"}</label>
    </div>
    <label>Комментарий<textarea name="comment" rows="2" placeholder="Например: сделать острее, домофон не работает"></textarea></label>
    <label style="display:flex;gap:8px;align-items:flex-start;font-weight:500"><input type="checkbox" name="consent" style="margin-top:3px"> Согласен на обработку персональных данных</label>
    <div class="err" id="orderErr" role="alert"></div>
  </form>`;
}

function renderDrawer() {
  const t = totals();
  const title = { cart: "Ваш заказ", checkout: "Оформление", done: "Заказ принят" }[state.step];
  el("drawerTitle").textContent = title;
  if (state.step === "done") {
    el("drawerBody").innerHTML = `<div class="done"><b>Спасибо!</b>В рабочей версии здесь откроется онлайн-оплата, а заказ уйдёт на кухню. Подтвердим заказ по телефону.</div>`;
    el("totals").innerHTML = '<button class="btn btn-chili" type="button" data-close-cart>Вернуться в меню</button>';
    return;
  }
  el("drawerBody").innerHTML = state.step === "checkout" ? checkoutHtml() : cartBodyHtml(t);
  if (!t.count) { el("totals").innerHTML = ""; return; }
  const rows = [
    ["Блюда", rub(t.subtotal), ""],
    ...(t.discount ? [["Скидка за самовывоз", "−" + rub(t.discount), "discount"]] : []),
    ...(state.mode === "delivery" ? [["Доставка", t.delivery ? rub(t.delivery) : "бесплатно", ""]] : []),
  ];
  const belowMin = t.subtotal < MIN_ORDER;
  const action = state.step === "cart"
    ? `<button class="btn btn-chili" type="button" data-step="checkout" ${belowMin ? "disabled" : ""}>Оформить заказ</button>`
    : `<button class="btn btn-chili" type="submit" form="orderForm">${'Заказать за ' + rub(t.total)}</button>
       <button class="btn btn-ghost" type="button" data-step="cart" style="margin-top:8px">Назад к корзине</button>`;
  el("totals").innerHTML = rows.map(([k, v, cls]) => `<div class="row ${cls}"><span>${k}</span><span>${v}</span></div>`).join("")
    + `<div class="row total"><span>Итого</span><span>${rub(t.total)}</span></div>`
    + (belowMin ? `<div class="err">Минимальный заказ — ${rub(MIN_ORDER)}</div>` : "") + action;
}

function openCart() {
  setState({ step: "cart" });
  renderDrawer();
  el("drawer").hidden = false;
  el("overlay").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeCart() {
  el("drawer").hidden = true;
  el("overlay").hidden = true;
  document.body.style.overflow = "";
  if (state.step === "done") setState({ step: "cart" });
}

function validateOrder(form) {
  const value = (name) => (form.elements[name]?.value || "").trim();
  if (value("name").length < 2) return "Укажите имя.";
  if (value("phone").replace(/\D/g, "").length < 10) return "Проверьте номер телефона.";
  if (state.mode === "delivery" && value("address").length < 5) return "Укажите адрес доставки.";
  if (!form.elements.consent.checked) return "Нужно согласие на обработку данных.";
  return "";
}

/* ---------- Events ---------- */

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  const d = t.dataset;
  if (d.inc) setQty(d.inc, (state.cart[d.inc] || 0) + 1);
  else if (d.dec) setQty(d.dec, (state.cart[d.dec] || 0) - 1);
  else if (d.open) openDish(d.open);
  else if ("closeDish" in d) el("dish").close();
  else if ("openCart" in d) openCart();
  else if ("closeCart" in d) closeCart();
  else if (d.step) { setState({ step: d.step }); renderDrawer(); }
  else if (d.mode) { setState({ mode: d.mode }); renderMode(); renderCartSummary(); if (!el("drawer").hidden) renderDrawer(); }
  else if (d.filter) {
    const filters = state.filters.includes(d.filter) ? state.filters.filter((f) => f !== d.filter) : [...state.filters, d.filter];
    setState({ filters }); renderFilters(); renderCatalog();
  }
});

el("overlay").addEventListener("click", closeCart);
el("dish").addEventListener("click", (e) => { if (e.target === el("dish")) el("dish").close(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !el("drawer").hidden) closeCart(); });

let searchTimer;
el("search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { setState({ query: e.target.value }); renderCatalog(); }, 150);
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "orderForm") return;
  e.preventDefault();
  const error = validateOrder(e.target);
  el("orderErr").textContent = error;
  if (error) return;
  setState({ step: "done", cart: {} });
  renderDrawer(); renderCartSummary();
  dishes.forEach((d) => renderBuy(d.id));
});

/* ---------- Start ---------- */

el("reviewList").innerHTML = REVIEWS.map((r) =>
  `<div class="review"><span class="stars" aria-label="5 из 5">★★★★★</span><div class="who">${esc(r.who)}</div><div class="date">${r.date}</div><p>${esc(r.text)}</p></div>`).join("");
renderMode();
renderCollage();
renderFilters();
renderCatalog();
renderCartSummary();
