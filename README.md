# Outfit Reload 3.0 — Supabase connected frontend

## Files
- `index.html`: public storefront
- `admin.html`: owner sign-in and product management
- `config.js`: Supabase Project URL and publishable key
- `SETUP-STORE-SETTINGS.sql`: optional announcement bar settings table/policies

## Deploy
Upload all files to the root of the existing GitHub repository and commit. GitHub Pages serves the updated storefront.

## Important
The existing Supabase tables and RLS policies must be present. The admin user must exist in `auth.users` and `public.admin_users`. Storage bucket `product-images` must be public for public product image URLs; upload/update/delete policies should restrict writes to admins. Never put a Supabase secret/service-role key in frontend files.


## Storefront upgrade
- Product cards open a product details panel.
- Product details load size/colour variants and live stock from `product_variants`.
- Add-to-bag validates selected variant stock; bag is temporary for the current browser session.
- Homepage includes New Arrivals, Best Sellers, Featured Collection and Trending sections.
- Checkout/payment/order submission is not yet implemented; do not accept live payments yet.
