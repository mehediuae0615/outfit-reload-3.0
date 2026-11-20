/* Outfit Reload 3.0 — Product detail page links
   Load this file AFTER app.js on the storefront and collections pages.
   Product cards open product.html using the real Supabase product ID.
*/
(() => {
  const openProductPage = (card) => {
    const id = card?.getAttribute('data-product');
    if (!id) return;
    window.location.href = `product.html?id=${encodeURIComponent(id)}`;
  };

  document.addEventListener('click', (event) => {
    const card = event.target.closest('.product-card[data-product]');
    if (!card || event.target.closest('[data-wishlist]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openProductPage(card);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest?.('.product-card[data-product]');
    if (!card || event.target.closest?.('[data-wishlist]')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openProductPage(card);
  }, true);
})();
