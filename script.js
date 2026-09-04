(() => {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Cart state ---------- */
  const cart = new Map();
  const CART_KEY = "aure_cart";

  /* Escala de precios por cantidad (por ítem):
     1 frasco = 25.000 · 2 = 45.000 · 3 = 65.000 · cada extra +20.000 */
  function pricePerQty(qty) {
    if (qty <= 0) return 0;
    if (qty === 1) return 25000;
    if (qty === 2) return 45000;
    if (qty === 3) return 65000;
    return 65000 + (qty - 3) * 20000;
  }
  function fmtCOP(n) {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(n);
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
      arr.forEach(([name, data]) => {
        if (data && typeof data.qty === "number") {
          cart.set(name, { qty: data.qty, img: data.img || "" });
        }
      });
    } catch (e) {}
  }

  function renderCartCount() {
    const total = Array.from(cart.values()).reduce((s, it) => s + it.qty, 0);
    cartCountEl.hidden = total === 0;
    cartCountEl.textContent = total;
  }

  function renderCartItems() {
    if (cart.size === 0) {
      cartItemsEl.innerHTML = `<div class="cart-empty"><div class="big">∅</div><p>Tu carrito está vacío.<br>Añade una fragancia para empezar.</p></div>`;
      cartTotalEl.textContent = "$0";
      return;
    }
    let html = "";
    let total = 0;
    cart.forEach((it, name) => {
      const sub = pricePerQty(it.qty);
      total += sub;
      html += `
        <li class="cart-item" data-name="${escapeAttr(name)}">
          <img class="cart-item-img" src="${escapeAttr(it.img)}" alt="" loading="lazy">
          <div>
            <h4>${escapeHtml(name)}</h4>
            <p>${it.qty} × ${fmtCOP(pricePerQty(1))}</p>
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
    const prev = cart.get(name);
    cart.set(name, prev
      ? { ...prev, qty: prev.qty + 1 }
      : { qty: 1, img });
    persistAndRender();
    showToast(`${name} añadido al carrito`);
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

  /* ---------- Events: add buttons ---------- */
  $$("[data-add]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
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
      showToast(`${name} eliminado`);
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
    cart.forEach((it, name) => {
      const sub = pricePerQty(it.qty);
      total += sub;
      lines.push(`• ${name} x${it.qty} = ${fmtCOP(sub)}`);
    });
    const msg = lines.join("\n") + `\n\nTotal: ${fmtCOP(total)}`;
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

  /* ---------- Newsletter (mailto) ---------- */
  const newsForm = $("#newsForm");
  const newsMsg = $("#newsMsg");
  newsForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#newsEmail").value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    newsMsg.classList.remove("ok", "err");
    if (!ok) {
      newsMsg.classList.add("err");
      newsMsg.textContent = "Escribe un correo válido.";
      return;
    }
    const subject = encodeURIComponent("Nuevo suscriptor Auré Parfums");
    const body = encodeURIComponent("Buen día,\n\nUn nuevo interesado dejó su correo:\n\n" + email);
    window.location.href = `mailto:estebancorreaappdata456@gmail.com?subject=${subject}&body=${body}`;
    newsMsg.classList.add("ok");
    newsMsg.textContent = "Revisa tu correo para continuar. ¡Bienvenido!";
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

  /* ---------- Init ---------- */
  loadCart();
  persistAndRender();
})();

/* bump animation (kept outside for reuse) */
document.addEventListener("DOMContentLoaded", () => {
  const style = document.createElement("style");
  style.textContent = `@keyframes bump { 0%{transform:scale(1)} 40%{transform:scale(1.35)} 100%{transform:scale(1)} }`;
  document.head.appendChild(style);
});