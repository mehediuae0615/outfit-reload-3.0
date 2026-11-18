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


## Customer Order Tracking
1. Open Supabase SQL Editor and run `CUSTOMER-ORDER-TRACKING.sql`.
2. Replace the website files in the GitHub repository with the files in this ZIP.
3. Commit changes, then open the storefront and use the Track Order link in the header or footer.
4. Test with a real order number and the same phone number used at checkout.

The lookup is performed by a SECURITY DEFINER RPC that returns order information only after both the order number and phone number match. Do not expose service-role keys in the browser.


## Website Content Manager
See `WEBSITE-CONTENT-MANAGER-SETUP.txt`. Run `CMS-DATABASE-UPGRADE.sql` once in Supabase after replacing the website files.
