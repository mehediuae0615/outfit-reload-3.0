(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const host = $('wishlistGrid');
  const count = $('wishCount');
  const money = value => '৳ ' + Number(value || 0).toLocaleString('en-BD');
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const show = (html, message) => { if (count) count.textContent = message || ''; if (host) host.innerHTML = html; };
  const empty = (heading, detail, button='EXPLORE COLLECTION ↗') => `<div class="empty" style="grid-column:1/-1"><b>${heading}</b><p>${detail}</p><a class="shop" href="index.html#new">${button}</a></div>`;

  function readIds() {
    try {
      const value = JSON.parse(localStorage.getItem('or_wishlist') || '[]');
      return Array.isArray(value) ? [...new Set(value.map(String))] : [];
    } catch (_) { return []; }
  }

  async function render() {
    if (!host || !count) return;
    show('<p class="count">Loading your wishlist…</p>', 'Loading saved items…');
    const ids = readIds();
    if (!ids.length) {
      show(empty('Your wishlist is waiting.', 'Tap the heart on a product to save it here.'), '0 saved items');
      return;
    }
    show('<p class="count">Loading saved products…</p>', `${ids.length} saved item${ids.length === 1 ? '' : 's'}`);
    try {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') throw new Error('Wishlist service could not load. Refresh the page or try again later.');
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) throw new Error('Store configuration is missing.');
      const client = window.__orWishlistClient || (window.__orWishlistClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY));
      const { data, error } = await client.from('products').select('*').in('id', ids);
      if (error) throw error;
      const products = (data || []).filter(p => p && p.is_active !== false);
      if (!products.length) {
        show(empty('No available saved products.', 'These products may have been removed from the collection.', 'SHOP NOW ↗'), '0 available items');
        return;
      }
      show(products.map(p => {
        const images = Array.isArray(p.image_urls) ? p.image_urls : [];
        const img = images[0] || p.image_url || p.image || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80';
        const price = Number(p.sale_price) > 0 ? Math.min(Number(p.sale_price), Number(p.price || 0)) : Number(p.price || 0);
        return `<article class="item"><a class="photo" href="product.html?id=${encodeURIComponent(p.id)}"><img src="${safe(img)}" alt="${safe(p.name || 'Product')}" loading="lazy"></a><button class="remove" type="button" data-remove="${safe(p.id)}" aria-label="Remove from wishlist">×</button><div class="info"><p class="name">${safe(p.name || 'Product')}</p><span class="price">${money(price)}</span><br><a class="shop" href="product.html?id=${encodeURIComponent(p.id)}">VIEW PRODUCT ↗</a></div></article>`;
      }).join(''), `${products.length} saved item${products.length === 1 ? '' : 's'}`);
      host.querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => {
        const id = button.dataset.remove;
        const next = readIds().filter(value => value !== id);
        localStorage.setItem('or_wishlist', JSON.stringify(next));
        render();
      }));
    } catch (error) {
      show(`<p class="error" style="grid-column:1/-1">Wishlist could not be loaded: ${safe(error && error.message ? error.message : error)}</p>`, `${ids.length} saved item${ids.length === 1 ? '' : 's'}`);
    }
  }
  const refresh = $('refreshWishlist');
  if (refresh) refresh.addEventListener('click', render);
  window.addEventListener('storage', event => { if (event.key === 'or_wishlist') render(); });
  render();
})();
