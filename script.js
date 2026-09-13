(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Cart state ---------- */
  const cart = new Map();
  const CART_KEY = "aure_cart";

  /* Catálogo y precios. Se leen de AURE_CONFIG.catalogo (definido en el <head>
     de index.html, que es donde los edita el dueño de la tienda a mano).
     Cada item: { n: nombre, c: categoria, p: precio, img: url }. */
  const DEFAULTS = { catalogo: [] };
  const RAW = (window && window.AURE_CONFIG && typeof window.AURE_CONFIG === "object") ? window.AURE_CONFIG : null;
  const CFG = RAW && Array.isArray(RAW.catalogo)
    ? RAW
    : (RAW && RAW.precios
        ? { catalogo: Object.keys(RAW.precios).map((n) => ({ n, c: "", p: RAW.precios[n], img: "" })) }
        : DEFAULTS);
  const CATALOGO = CFG.catalogo || [];
  const prices = {};
  CATALOGO.forEach((item) => {
    if (item && item.n) prices[item.n] = (typeof item.p === "number" && item.p > 0) ? item.p : null;
  });
  function unitPrice(name) {
    const p = prices[name];
    return typeof p === "number" && p > 0 ? p : null;
  }
  function fmtCOP(n) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);
  }
  function fmtN(n) {
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n);
  }

  const cartItemsEl = $("#cartItems");
  const cartCountEl = $("#cartCount");
  const cartTotalEl = $("#cartTotal");
  const drawer = $("#cartDrawer");
  const scrim = $("#scrim");
  const toast = $("#toast");

  let toastTimer = null;

  /* ---------- Persist & render cart ---------- */
  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(Array.from(cart.entries()))); } catch (e) {}
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      arr.forEach(([key, data]) => {
        if (!data || typeof data.qty !== "number") return;
        const nombre = data.nombre || String(key).split("||")[0];
        if (!nombre) return;
        cart.set(nombre, { nombre, qty: data.qty, img: data.img || "" });
      });
    } catch (e) {}
  }

  function renderCartCount() {
    const total = Array.from(cart.values()).reduce((s, it) => s + it.qty, 0);
    cartCountEl.hidden = total === 0;
    cartCountEl.textContent = total;
  }

  function itemSubtotal(it) {
    return (unitPrice(it.nombre) || 0) * it.qty;
  }

  function renderCartItems() {
    if (cart.size === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty"><div class="big">∅</div><p>Tu carrito está vacío.<br>Añade una fragancia para empezar.</p></div>`;
      cartTotalEl.textContent = "$0";
      return;
    }
    let html = "";
    let total = 0;
    cart.forEach((it) => {
      const sub = itemSubtotal(it);
      total += sub;
      const unit = unitPrice(it.nombre) || 0;
      html += `
        <li class="cart-item" data-name="${escapeAttr(it.nombre)}">
          <img class="cart-item-img" src="${escapeAttr(it.img)}" alt="${escapeAttr(it.nombre)}" loading="lazy">
          <div>
            <h4>${escapeHtml(it.nombre)}</h4>
            <p>${it.qty} × ${fmtCOP(unit)}</p>
          </div>
          <div class="cart-item-side">
            <strong class="cart-item-price">${fmtCOP(sub)}</strong>
            <div class="cart-item-actions">
              <button class="qty-btn" data-dec aria-label="Restar">−</button>
              <span>${it.qty}</span>
              <button class="qty-btn" data-inc aria-label="Sumar">+</button>
              <button class="remove-btn" data-remove aria-label="Eliminar">✕</button>
            </div>
          </div>
        </li>`;
    });
    cartItemsEl.innerHTML = html;
    cartTotalEl.textContent = fmtCOP(total);
  }

  function addToCart(name, img) {
    if (!unitPrice(name)) {
      showToast("Precio por definir");
      return;
    }
    const prev = cart.get(name);
    cart.set(name, prev
      ? { ...prev, qty: prev.qty + 1 }
      : { nombre: name, qty: 1, img });
    persistAndRender();
    showToast(name + " añadido al carrito");
    bumpBadge();
  }

  function persistAndRender() {
    saveCart();
    renderCartCount();
    renderCartItems();
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  function showToast(msg) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function bumpBadge() {
    cartCountEl.style.animation = "none";
    void cartCountEl.offsetWidth;
    cartCountEl.style.animation = "bump 0.4s var(--ease)";
  }

  /* ---------- Cart open/close ---------- */
  function openCart() {
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.hidden = false;
    requestAnimationFrame(() => scrim.classList.add("show"));
    document.body.classList.add("no-scroll");
    $("#cartBtn").setAttribute("aria-expanded", "true");
  }
  function closeCart() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("show");
    setTimeout(() => { scrim.hidden = true; }, 350);
    document.body.classList.remove("no-scroll");
    $("#cartBtn").setAttribute("aria-expanded", "false");
  }

  /* ---------- Precios en las tarjetas ---------- */
  function paintPrices() {
    $$(".product").forEach((card) => {
      const name = card.dataset.nombre;
      const priceEl = card.querySelector(".price-value");
      const btn = card.querySelector("[data-add]");
      const u = unitPrice(name);
      if (priceEl) priceEl.textContent = u ? fmtN(u) : "pronto";
      if (btn) {
        if (u) { btn.removeAttribute("aria-disabled"); btn.setAttribute("aria-label", "Añadir " + name + " al carrito"); }
        else { btn.setAttribute("aria-disabled", "true"); btn.setAttribute("aria-label", "Precio por definir"); }
      }
    });
  }

  /* ---------- Catálogo dinámico (se pinta en cada carga) ---------- */
  const grid = $("#productGrid");
  const catSearch = $("#catSearch");
  const catChips = $("#catChips");
  const catCount = $("#catCount");
  let currentCat = "all";
  let query = "";
  const PAGE = document.documentElement.getAttribute("data-page") || "inicio";

  const TINTS = { arabe: "amber", dama: "pink", hombre: "blue" };
  const BADGES = { arabe: "Árabe premium", dama: "Dama", hombre: "Diseñador" };
  const MONOGRAM = "data:image/svg+xml," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
    '<rect width="300" height="300" fill="#241c12"/>' +
    '<circle cx="150" cy="150" r="92" fill="none" stroke="#b8863f" stroke-width="2"/>' +
    '<text x="150" y="150" font-family="Georgia,serif" font-size="58" fill="#b8863f" text-anchor="middle" dominant-baseline="middle">A×X</text></svg>');

  function norm(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function renderCatalog() {
    const items = PAGE === "catalogo" ? CATALOGO : (CFG.destacados || []).map((n) => CATALOGO.find((i) => i && i.n === n)).filter(Boolean);
    if (!grid || !items.length) return;
    grid.innerHTML = items.map((item) => `
        <article class="glass product" data-nombre="${escapeAttr(item.n)}" data-cat="${escapeAttr(item.c || "")}">
          <div class="product-visual" data-tint="${escapeAttr(TINTS[item.c] || "gold")}">
            <img class="product-img" width="300" height="300" decoding="async" loading="lazy"
              src="${escapeAttr(item.img || "")}" alt="Perfume ${escapeAttr(item.n)}">
          </div>
          <div class="product-body">
            <span class="badge">${BADGES[item.c] || "Perfume"}</span>
            <h3>${escapeHtml(item.n)}</h3>
            <p class="notes">Eau de Parfum · 50 ml</p>
            <div class="product-row">
              <span class="price"><small>$</small><span class="price-value"></span></span>
              <button class="btn btn-primary add-btn" data-add>
                <span class="add-label">Añadir</span>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
        </article>`).join("\n");
    $$("#productGrid .product-img").forEach((img) => {
      img.addEventListener("error", () => {
        if (img.getAttribute("src") !== MONOGRAM) img.setAttribute("src", MONOGRAM);
      });
    });
  }

  function applyCatalogFilter() {
    const q = norm(query);
    let shown = 0;
    $$("#productGrid .product").forEach((card) => {
      const okCat = currentCat === "all" || card.dataset.cat === currentCat;
      const okQ = !q || norm(card.dataset.nombre).indexOf(q) >= 0;
      const show = okCat && okQ;
      card.hidden = !show;
      if (show) shown++;
    });
    if (catCount) catCount.textContent = `${shown} de ${CATALOGO.length} fragancias`;
  }

  renderCatalog();
  applyCatalogFilter();

  if (catSearch) catSearch.addEventListener("input", () => { query = catSearch.value.trim(); applyCatalogFilter(); });
  if (catChips) catChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".cat-chip");
    if (!chip) return;
    currentCat = chip.dataset.cat;
    $$(".cat-chip").forEach((c) => {
      const on = c === chip;
      c.classList.toggle("on", on);
      c.setAttribute("aria-pressed", String(on));
    });
    applyCatalogFilter();
  });

  if ((PAGE === "inicio" || PAGE === "catalogo") && grid) {
    grid.addEventListener("click", (e) => {
      if (e.target.closest("[data-add]")) return;
      const card = e.target.closest(".product");
      if (!card) return;
      const name = card.dataset.nombre;
      if (name) location.href = "producto.html?p=" + encodeURIComponent(name);
    });
  }

  if (PAGE === "catalogo") {
    const targetName = new URLSearchParams(location.search).get("p");
    if (targetName) {
      const target = $$("#productGrid .product").find((c) => c.dataset.nombre === targetName);
      if (target) {
        target.classList.add("flash");
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    }
  }

/* ---------- Página de producto (producto.html) — layout tienda ---------- */
  const PP_DESC = {
    arabe: "Aroma árabe premium: dulce, intenso y de estela prolongada. Pensado para quienes buscan fijación de horas y un perfume que no pasa desapercibido.",
    dama: "Una fragancia femenina elegante y versátil, para el día a día o tus ocasiones especiales. Notas que se adaptan a tu piel desde la primera pulverización.",
    hombre: "Una fragancia masculina con carácter: fresca, amaderada o aromática, con la fijación que necesitas durante todo el día."
  };

  function productTarget() {
    const q = new URLSearchParams(location.search);
    const p = q.get("p");
    if (p) return CATALOGO.find((x) => x.n === p);
    const i = q.get("i");
    if (i != null) return CATALOGO[parseInt(i, 10)];
    return null;
  }

  function waOrderUrl(name, qty) {
    const u = unitPrice(name) || 0;
    const lines = ["Hola Auré Parfums, quiero pedir:", ""];
    lines.push(qty + " × " + name + (u ? " (" + fmtCOP(u) + ")" : ""));
    if (u) lines.push("Total estimado: " + fmtCOP(u * qty));
    lines.push("", "Gracias.");
    return "https://wa.me/573059279731?text=" + encodeURIComponent(lines.join("\n"));
  }

  function galleryViews(it) {
    const out = [{ src: it.img || MONOGRAM, label: "Vista frontal" }];
    const m = /\/perfume\/o\.(\d+)\.(?:jpg|png)$/i.exec(it.img || "");
    if (m) out.push({ src: "https://fimgs.net/mdimg/perfume-thumbs/375x500." + m[1] + ".jpg", label: "Vista envase" });
    out.push({ src: MONOGRAM, label: "Marca" });
    return out;
  }

  function cardItemHtml(it) {
    return `
        <article class="glass product" data-nombre="${escapeAttr(it.n)}" data-cat="${escapeAttr(it.c || "")}">
          <div class="product-visual" data-tint="${escapeAttr(TINTS[it.c] || "gold")}">
            <img class="product-img" width="300" height="300" decoding="async" loading="lazy"
              src="${escapeAttr(it.img || "")}" alt="Perfume ${escapeAttr(it.n)}">
          </div>
          <div class="product-body">
            <span class="badge">${BADGES[it.c] || "Perfume"}</span>
            <h3>${escapeHtml(it.n)}</h3>
            <p class="notes">Eau de Parfum · 50 ml</p>
            <div class="product-row">
              <span class="price"><small>$</small><span class="price-value"></span></span>
              <button class="btn btn-primary add-btn" data-add>
                <span class="add-label">Añadir</span>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              </button>
            </div>
          </div>
        </article>`;
  }

  function productDetailHtml(it) {
    const views = galleryViews(it);
    const thumbs = views.map((v, i) => `
          <button type="button" class="pp-thumb${i === 0 ? " on" : ""}" data-view="${i}" aria-label="${escapeAttr(v.label)}">
            <img src="${escapeAttr(v.src)}" alt="${escapeAttr(v.label)}">
          </button>`).join("\n");
    return `
      <article class="product pp-layout glass" data-nombre="${escapeAttr(it.n)}" data-cat="${escapeAttr(it.c || "")}">
        <!-- Panel izquierdo: imágenes del producto -->
        <div class="pp-gallery">
          <div class="pp-thumbs" role="tablist" aria-label="Galería del producto">${thumbs}</div>
          <div class="pp-main">
            <img class="product-img pp-main-img" width="480" height="480" decoding="async"
              src="${escapeAttr(views[0].src)}" alt="Perfume ${escapeAttr(it.n)}">
          </div>
        </div>
        <!-- Panel central: detalles y opciones -->
        <div class="pp-info">
          <span class="badge">${BADGES[it.c] || "Perfume"}</span>
          <h1>${escapeHtml(it.n)}</h1>
          <p class="pp-subtitle">${escapeHtml(PP_DESC[it.c] || PP_DESC.hombre)}</p>
          <div class="pp-rating">
            <span class="pp-stars" aria-hidden="true">★★★★★</span>
            <b>4.9</b>
            <span>(194 valoraciones)</span>
            <span class="pp-sold">+1.000 vendidos</span>
          </div>
          <div class="pp-price-box">
            <span class="pp-price"><small>$</small><span class="price-value"></span><small> COP</small></span>
            <p class="pp-price-note">Precio por frasco de 50 ml, con descuento por cantidad y cupón promocional de −$6.350 en compras superiores a $57.000.</p>
          </div>
          <div class="pp-variants">
            <span class="pp-label">Presentación / Set</span>
            <div class="pp-variant-row">
              <button type="button" class="pp-variant on" data-v="0">50 ml · Envase original</button>
              <button type="button" class="pp-variant muted" data-v="1">30 ml · Viajero<span>Consultar</span></button>
              <button type="button" class="pp-variant muted" data-v="2">Set ahorro 2×50 ml<span>Consultar</span></button>
            </div>
          </div>
          <ul class="pp-features">
            <li>Fragancia original de las grandes casas de la perfumería.</li>
            <li>Envase de 50 ml · Eau de Parfum de alta concentración.</li>
            <li>Envío a toda Colombia y recogida en persona.</li>
          </ul>
        </div>
        <!-- Panel derecho: compra y envío -->
        <aside class="pp-buy">
          <div class="pp-seller">
            <b>Auré Parfums × XCRSCREW</b>
            <span>Vendedor verificado</span>
          </div>
          <div class="pp-choice">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/></svg>
            Sello Choice · Compromiso Auré
          </div>
          <div class="pp-buy-block">
            <h3>Envío</h3>
            <ul>
              <li>Envío gratis a partir de $39.000.</li>
              <li>Entrega estimada: 3 a 7 días hábiles.</li>
            </ul>
          </div>
          <div class="pp-buy-block">
            <h3>Garantías</h3>
            <ul>
              <li>Cupón si hay entrega tardía.</li>
              <li>Reembolsos por pérdida o daño.</li>
              <li>Devoluciones dentro de 60 días.</li>
            </ul>
          </div>
          <div class="pp-buy-block">
            <h3>Cantidad · <span class="pp-avail">17 disponibles</span></h3>
            <div class="pp-qty">
              <button type="button" id="bdec" aria-label="Restar">−</button>
              <input id="pqty" type="number" min="1" max="17" value="1" inputmode="numeric" aria-label="Cantidad">
              <button type="button" id="binc" aria-label="Sumar">+</button>
            </div>
            <p class="pp-total-line" id="ptotal" role="status"></p>
            <button class="btn buy-now" id="pbuy">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></svg>
              Comprar ahora
            </button>
            <button class="btn btn-primary btn-block add-btn" data-add>
              <span class="add-label">Agregar al carrito</span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l1.2 12.2a1.6 1.6 0 0 1-1.6 1.8H6.4a1.6 1.6 0 0 1-1.6-1.8L6 7z"/></svg>
            </button>
          </div>
          <a class="pp-back" href="catalogo.html">← Volver al catálogo completo</a>
        </aside>
      </article>`;
  }

  function renderProductPage() {
    const holder = $("#productDetail");
    if (!holder) return;
    const it = productTarget();
    if (!it) {
      holder.innerHTML = `
        <div class="pp-missing glass">
          <h1>Perfume no encontrado</h1>
          <p>Ese perfume no está en nuestro catálogo.</p>
          <a class="btn btn-primary" href="catalogo.html">Ver los 161 perfumes</a>
        </div>`;
      return;
    }
    const crumb = $("#crumbName");
    if (crumb) crumb.textContent = it.n;
    document.title = it.n + " — AURÉ PARFUMS × XCRSCREW";
    holder.innerHTML = productDetailHtml(it);

    const views = galleryViews(it);
    const mainImg = holder.querySelector(".pp-main-img");
    if (mainImg) mainImg.addEventListener("error", () => {
      if (mainImg.getAttribute("src") !== MONOGRAM) mainImg.setAttribute("src", MONOGRAM);
    });

    holder.querySelectorAll(".pp-thumb").forEach((th, idx) => {
      th.addEventListener("click", () => {
        const v = views[idx];
        if (!v || !mainImg) return;
        mainImg.setAttribute("src", v.src);
        holder.querySelectorAll(".pp-thumb").forEach((t) => t.classList.toggle("on", t === th));
      });
      const im = th.querySelector("img");
      if (im) im.addEventListener("error", () => {
        if (im.getAttribute("src") !== MONOGRAM) im.setAttribute("src", MONOGRAM);
      });
    });

    const qtyEl = $("#pqty");
    const totalEl = $("#ptotal");
    const u = unitPrice(it.n) || 0;
    const refreshQty = () => {
      let q = parseInt(qtyEl.value, 10);
      if (!q || q < 1) q = 1;
      if (q > 17) q = 17;
      qtyEl.value = q;
      if (totalEl) totalEl.textContent = u ? (q > 1 ? q + " × " + fmtCOP(u) + " = " + fmtCOP(u * q) : "Total: " + fmtCOP(u)) : "Precio por definir";
    };
    if (qtyEl) qtyEl.addEventListener("input", refreshQty);
    const binc = $("#binc");
    const bdec = $("#bdec");
    if (binc) binc.addEventListener("click", () => { if (qtyEl) { qtyEl.value = Math.min(17, (parseInt(qtyEl.value, 10) || 1) + 1); refreshQty(); } });
    if (bdec) bdec.addEventListener("click", () => { if (qtyEl) { qtyEl.value = Math.max(1, (parseInt(qtyEl.value, 10) || 1) - 1); refreshQty(); } });
    refreshQty();

    const buy = $("#pbuy");
    if (buy) buy.addEventListener("click", () => {
      const q = parseInt(qtyEl.value, 10) || 1;
      window.open(waOrderUrl(it.n, q), "_blank", "noopener");
    });

    holder.querySelectorAll(".pp-variant").forEach((vv) => {
      vv.addEventListener("click", () => {
        if (vv.classList.contains("muted")) {
          showToast("Escríbenos por WhatsApp para esta presentación");
          window.open(waOrderUrl(it.n, parseInt(qtyEl.value, 10) || 1), "_blank", "noopener");
          return;
        }
        holder.querySelectorAll(".pp-variant").forEach((t) => t.classList.toggle("on", t === vv));
      });
    });

    const rg = $("#relatedGrid");
    if (rg) {
      const same = CATALOGO.filter((x) => x.c === it.c && x.n !== it.n).slice(0, 8);
      rg.innerHTML = same.map(cardItemHtml).join("\n");
      rg.querySelectorAll(".product-img").forEach((img) => img.addEventListener("error", () => {
        if (img.getAttribute("src") !== MONOGRAM) img.setAttribute("src", MONOGRAM);
      }));
      rg.addEventListener("click", (e) => {
        if (e.target.closest("[data-add]")) return;
        const card = e.target.closest(".product");
        if (!card) return;
        location.href = "producto.html?p=" + encodeURIComponent(card.dataset.nombre);
      });
    }
    paintPrices();
  }

  if (PAGE === "producto") renderProductPage();  /* ---------- Events: add buttons ---------- */
  $$("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (btn.getAttribute("aria-disabled")) {
        showToast("Precio por definir");
        return;
      }
      const card = btn.closest(".product");
      const imgEl = card.querySelector(".product-img");
      addToCart(card.dataset.nombre,
        (imgEl && imgEl.getAttribute("src")) || "");
    });
  });

  /* ---------- Events: cart drawer actions ---------- */
  cartItemsEl.addEventListener("click", (e) => {
    const li = e.target.closest("[data-name]");
    if (!li) return;
    const name = li.dataset.name;
    const item = cart.get(name);
    if (!item) return;

    if (e.target.closest("[data-inc]")) item.qty += 1;
    else if (e.target.closest("[data-dec]")) item.qty = Math.max(1, item.qty - 1);
    else if (e.target.closest("[data-remove]")) {
      cart.delete(name);
      persistAndRender();
      showToast(item.nombre + " eliminado");
      return;
    } else return;
    persistAndRender();
  });

  $("#cartBtn").addEventListener("click", openCart);
  $("#closeCart").addEventListener("click", closeCart);
  scrim.addEventListener("click", closeCart);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });

  $("#checkoutBtn").addEventListener("click", () => {
    if (cart.size === 0) { showToast("Añade algo primero"); return; }
    const lines = [];
    let total = 0;
    cart.forEach((it) => {
      const sub = itemSubtotal(it);
      total += sub;
      lines.push(`• ${it.nombre} x${it.qty} = ${fmtCOP(sub)}`);
    });
    const msg = lines.join("\n") + `\n\nTotal: ${fmtCOP(total)}\nEl pedido se paga por adelantado antes del envío`;
    window.open(
      `https://wa.me/573059279731?text=${encodeURIComponent("Hola Auré Parfums, quiero hacer este pedido:\n\n" + msg)}`,
      "_blank", "noopener");
    cart.clear();
    persistAndRender();
    setTimeout(closeCart, 400);
  });

  /* ---------- Mobile menu ---------- */
  const menuBtn = $("#menuBtn");
  const mobileMenu = $("#mobileMenu");

  function toggleMenu(force) {
    const open = force !== undefined ? force : mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuBtn.classList.toggle("active", open);
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", () => toggleMenu());
  $$(".mobile-menu a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));

  /* ---------- Nav shadow on scroll ---------- */
  const nav = $("#nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("in"));
  }

  /* Stagger children */
  $$("[data-stagger]").forEach((group) => {
    Array.from(group.children).forEach((child, i) => {
      child.style.setProperty("--d", `${(i % 3) * 0.1}s`);
    });
  });

  /* ---------- Newsletter / Contacto (Formspree o mailto) ---------- */
  const newsForm = $("#newsForm");
  const newsMsg = $("#newsMsg");
  const FORMSPREE = (CFG.formspree && typeof CFG.formspree === "string" && CFG.formspree.indexOf("https://formspree.io/") === 0)
    ? CFG.formspree
    : null;
  if (newsForm) newsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#newsEmail").value.trim();
    newsMsg.classList.remove("ok", "err");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newsMsg.classList.add("err");
      newsMsg.textContent = "Escribe un correo válido.";
      return;
    }
    const name = $("#newsName").value.trim();
    const text = $("#newsMsgText").value.trim();
    if (FORMSPREE) {
      newsMsg.textContent = "Enviando…";
      try {
        const resp = await fetch(FORMSPREE, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            nombre: name,
            email: email,
            message: text,
            _subject: "Mensaje desde la web AURÉ PARFUMS × XCRSCREW"
          })
        });
        if (!resp.ok) throw new Error("HTTP " + resp.status);
        newsMsg.classList.add("ok");
        newsMsg.textContent = "¡Mensaje enviado! Te responderemos lo más pronto posible.";
        newsForm.reset();
      } catch (_) {
        newsMsg.classList.add("err");
        newsMsg.textContent = "No se pudo enviar el mensaje. Inténtalo de nuevo o escríbenos por WhatsApp.";
      }
      return;
    }
    const subject = encodeURIComponent("Nuevo mensaje AURÉ PARFUMS × XCRSCREW");
    const body = encodeURIComponent("De: " + (name || "sin nombre") + "\nCorreo: " + email + "\n\n" + text);
    window.location.href = `mailto:estebancorreaappdata456@gmail.com?subject=${subject}&body=${body}`;
    newsMsg.classList.add("ok");
    newsMsg.textContent = "Se abrió tu correo para continuar. ¡Gracias!";
    newsForm.reset();
  });

  /* ---------- Theme toggle ---------- */
  const themeBtn = $("#themeBtn");
  function syncThemeIcons(theme) {
    const sun = themeBtn.querySelector(".icon-sun");
    const moon = themeBtn.querySelector(".icon-moon");
    if (sun) sun.style.display = theme === "dark" ? "none" : "block";
    if (moon) moon.style.display = theme === "dark" ? "block" : "none";
  }
  function applyTheme(theme) {
    const clean = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", clean);
    syncThemeIcons(clean);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", clean === "dark" ? "#171310" : "#f5efe6");
    try { localStorage.setItem("aure_theme", clean); } catch (e) {}
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem("aure_theme"); } catch (e) {}
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
  themeBtn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  /* ---------- Barra XCRSCREW × AURÉ PARFUMS ---------- */
  const VIEW_KEY = "aure_view";
  function readView() {
    try { if (localStorage.getItem(VIEW_KEY) === "xcr") return "xcr"; } catch (e) {}
    return "parfums";
  }
  function applyView(v) {
    const next = v === "xcr" ? "xcr" : "parfums";
    document.body.setAttribute("data-view", next);
    $$("[data-view-panel]").forEach((p) => {
      p.hidden = p.dataset.viewPanel !== next;
    });
    $$(".view-tab").forEach((b) => {
      const on = b.dataset.view === next;
      b.setAttribute("aria-selected", String(on));
    });
    try { localStorage.setItem(VIEW_KEY, next); } catch (e) {}
    window.scrollTo({ top: 0 });
  }
  $$(".view-tab").forEach((b) => b.addEventListener("click", () => applyView(b.dataset.view)));

  /* ---------- Reseñas ---------- */
  const starPick = $("#starPick");
  const starBtns = starPick ? Array.from(starPick.querySelectorAll("[data-star]")) : [];
  let rating = 5;
  function paintStars() {
    starBtns.forEach((b, i) => {
      const on = i < rating;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }
  if (starBtns.length) {
    starBtns.forEach((b, i) => {
      b.addEventListener("click", () => { rating = i + 1; paintStars(); });
      b.addEventListener("mouseenter", () => starBtns.forEach((x, j) => x.classList.toggle("on", j <= i)));
      b.addEventListener("mouseleave", paintStars);
    });
    starPick.setAttribute("aria-valuetext", rating + " de 5 estrellas");
    paintStars();
  }
  const reviewForm = $("#reviewForm");
  if (reviewForm) {
    reviewForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameEl = $("#revName");
      const textEl = $("#revText");
      const msgEl = $("#revMsg");
      const text = textEl.value.trim();
      if (!text) {
        msgEl.textContent = "Escribe tu reseña primero.";
        msgEl.className = "form-msg err";
        return;
      }
      const name = nameEl.value.trim();
      const lines = ["★ " + rating + " de 5", `"${text}"`];
      if (name) lines.push("— " + name);
      const url = "https://wa.me/573059279731?text=" +
        encodeURIComponent("Hola Auré Parfums, dejo esta reseña:\n\n" + lines.join("\n"));
      window.open(url, "_blank", "noopener");
      msgEl.textContent = "Gracias. Tu reseña se abrió en WhatsApp lista para enviar.";
      msgEl.className = "form-msg ok";
      textEl.value = "";
    });
  }

  /* ---------- Init ---------- */
  loadCart();
  persistAndRender();
  paintPrices();
  applyView(readView());
})();

/* bump animation (kept outside for reuse) */
document.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = `@keyframes bump { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 100%{transform:scale(1)} }`;
  document.head.appendChild(style);
});