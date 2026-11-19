// Add this file after app.js on the storefront.
(() => {
  if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const accountLink = document.querySelector('.header-user');
  async function syncCustomerSession() {
    const { data } = await sb.auth.getSession();
    const user = data?.session?.user;
    if (accountLink) {
      accountLink.href = user ? 'account.html' : 'account.html';
      accountLink.setAttribute('aria-label', user ? 'My account' : 'Sign in or create account');
      accountLink.title = user ? 'My account' : 'Sign in / Create account';
    }
    if (!user) return;
    const { data: profile } = await sb.from('customer_profiles')
      .select('full_name,phone,address')
      .eq('id', user.id).maybeSingle();
    const checkout = document.getElementById('checkoutForm');
    if (!checkout || !profile) return;
    if (profile.full_name && !checkout.elements.customer_name.value)
      checkout.elements.customer_name.value = profile.full_name;
    if (profile.phone && !checkout.elements.customer_phone.value)
      checkout.elements.customer_phone.value = profile.phone;
    if (user.email && !checkout.elements.customer_email.value)
      checkout.elements.customer_email.value = user.email;
    if (profile.address && !checkout.elements.delivery_address.value)
      checkout.elements.delivery_address.value = profile.address;
  }
  syncCustomerSession();
  sb.auth.onAuthStateChange(() => setTimeout(syncCustomerSession, 0));
})();