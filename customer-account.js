(() => {
  const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const authPanel = $('authPanel');
  const dashboardPanel = $('dashboardPanel');
  let currentUser = null;

  function message(id, text, type = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ca-message' + (type ? ' ' + type : '');
  }
  function setBusy(button, busy, label) {
    button.disabled = busy;
    if (busy) button.dataset.originalLabel = button.textContent;
    button.textContent = busy ? label : (button.dataset.originalLabel || label);
  }
  function showAuth(mode = 'login') {
    authPanel.hidden = false;
    dashboardPanel.hidden = true;
    const signup = mode === 'signup';
    $('loginForm').hidden = signup;
    $('signupForm').hidden = !signup;
    $('loginTab').classList.toggle('active', !signup);
    $('signupTab').classList.toggle('active', signup);
    $('authTitle').textContent = signup ? 'Create your account.' : 'Welcome back.';
    $('authIntro').textContent = signup
      ? 'Create a free account to keep your orders together.'
      : 'Sign in to view your orders and manage your details.';
    message('authMessage', '');
  }
  function showDashboard() {
    authPanel.hidden = true;
    dashboardPanel.hidden = false;
  }
  function money(value) {
    return '৳ ' + Number(value || 0).toLocaleString('en-BD');
  }
  function safe(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  $('loginTab').addEventListener('click', () => showAuth('login'));
  $('signupTab').addEventListener('click', () => showAuth('signup'));

  $('signupForm').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const button = $('signupButton');
    if (values.password !== values.confirm_password) {
      message('authMessage', 'Your passwords do not match.', 'error');
      return;
    }
    if (values.password.length < 8) {
      message('authMessage', 'Use a password with at least 8 characters.', 'error');
      return;
    }
    setBusy(button, true, 'CREATING ACCOUNT…');
    message('authMessage', '');
    try {
      const { data, error } = await sb.auth.signUp({
        email: values.email.trim(),
        password: values.password,
        options: { emailRedirectTo: window.location.href, data: { full_name: values.full_name.trim() } }
      });
      if (error) throw error;
      if (data.user && data.session) {
        const { error: profileUpdateError } = await sb.from('customer_profiles')
          .update({ full_name: values.full_name.trim() })
          .eq('id', data.user.id);
        if (profileUpdateError) throw profileUpdateError;
        message('authMessage', 'Your account is ready. Opening your dashboard…', 'success');
        await loadAccount(data.user);
      } else {
        message('authMessage', 'Account created. Please check your email and confirm your address, then sign in.', 'success');
        form.reset();
        showAuth('login');
        message('authMessage', 'Account created. Please confirm your email, then sign in.', 'success');
      }
    } catch (error) {
      message('authMessage', error.message || 'Could not create your account.', 'error');
    } finally {
      setBusy(button, false, 'CREATE ACCOUNT ↗');
    }
  });

  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const button = $('loginButton');
    setBusy(button, true, 'SIGNING IN…');
    message('authMessage', '');
    try {
      const { data, error } = await sb.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password
      });
      if (error) throw error;
      await loadAccount(data.user);
    } catch (error) {
      message('authMessage', error.message || 'Could not sign in.', 'error');
    } finally {
      setBusy(button, false, 'SIGN IN ↗');
    }
  });

  $('forgotButton').addEventListener('click', async () => {
    const email = $('loginForm').elements.email.value.trim();
    if (!email) {
      message('authMessage', 'Enter your email address first, then choose Forgot password.', 'error');
      return;
    }
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });
      if (error) throw error;
      message('authMessage', 'If an account exists for this email, a password reset link has been sent.', 'success');
    } catch (error) {
      message('authMessage', error.message || 'Could not send the reset email.', 'error');
    }
  });

  async function loadAccount(user) {
    currentUser = user;
    const { data: profile, error: profileError } = await sb
      .from('customer_profiles')
      .select('id,email,full_name,phone,address,is_enabled,disable_reason')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile && profile.is_enabled === false) {
      await sb.auth.signOut();
      currentUser = null;
      showAuth('login');
      const reason = String(profile.disable_reason || '').trim();
      const disabledMessage = reason
        ? 'Your account has been disabled.\nReason: ' + reason
        : 'This customer account is currently disabled. Please contact the store.';
      message('authMessage', disabledMessage, 'error');
      $('authMessage').style.whiteSpace = 'pre-wrap';
      return;
    }
    if (!profile) {
      throw new Error('Your customer profile is not ready yet. Please contact the store for help.');
    }
    const metadataName = user.user_metadata?.full_name || '';
    if (!profile.full_name && metadataName) {
      const { error } = await sb.from('customer_profiles')
        .update({ full_name: metadataName })
        .eq('id', user.id);
      if (error) throw error;
      profile.full_name = metadataName;
    }

    showDashboard();
    const displayName = profile.full_name || user.email || 'Customer';
    $('welcomeName').textContent = 'Welcome, ' + displayName.split(' ')[0] + '.';
    $('accountEmail').textContent = user.email || '';
    const form = $('profileForm');
    form.elements.full_name.value = profile?.full_name || user.user_metadata?.full_name || '';
    form.elements.phone.value = profile?.phone || '';
    form.elements.address.value = profile?.address || '';
    await loadOrders();
  }

  $('profileForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const button = $('saveProfileButton');
    setBusy(button, true, 'SAVING…');
    message('profileMessage', '');
    try {
      const { error } = await sb.from('customer_profiles').update({
        full_name: values.full_name.trim(),
        phone: values.phone.trim() || null,
        address: values.address.trim() || null
      }).eq('id', currentUser.id);
      if (error) throw error;
      message('profileMessage', 'Your details have been saved.', 'success');
      $('welcomeName').textContent = 'Welcome, ' + values.full_name.trim().split(' ')[0] + '.';
    } catch (error) {
      message('profileMessage', error.message || 'Could not save your details.', 'error');
    } finally {
      setBusy(button, false, 'SAVE DETAILS');
    }
  });

  async function loadOrders() {
    const host = $('accountOrders');
    host.innerHTML = '<p class="ca-muted">Loading your orders…</p>';
    const { data, error } = await sb
      .from('orders')
      .select('id,order_number,status,created_at,delivery_area,subtotal,delivery_fee,total')
      .eq('customer_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      host.innerHTML = '<p class="ca-error">Orders could not be loaded: ' + safe(error.message) + '</p>';
      return;
    }
    if (!data?.length) {
      host.innerHTML = '<div class="ca-empty"><b>No account orders yet.</b><p>Your next order, placed while signed in, will appear here.</p><a href="index.html">Explore the collection ↗</a></div>';
      return;
    }
    const labels = {
      pending:'Pending', confirmed:'Confirmed', processing:'Processing',
      shipped:'Shipped', delivered:'Delivered', cancelled:'Cancelled'
    };
    host.innerHTML = data.map(order => `
      <article class="ca-order">
        <div class="ca-order-top">
          <div><b>${safe(order.order_number)}</b><small>${safe(new Date(order.created_at).toLocaleDateString('en-GB'))}</small></div>
          <span class="ca-status">${safe(labels[order.status] || order.status || 'Pending')}</span>
        </div>
        <div class="ca-order-bottom">
          <span>${order.delivery_area === 'inside_dhaka' ? 'Inside Dhaka' : 'Outside Dhaka'}</span>
          <b>${money(order.total)}</b>
        </div>
      </article>`).join('');
  }

  $('refreshOrdersButton').addEventListener('click', loadOrders);
  $('signOutButton').addEventListener('click', async () => {
    const { error } = await sb.auth.signOut();
    if (error) {
      message('profileMessage', error.message, 'error');
      return;
    }
    currentUser = null;
    showAuth('login');
  });

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      const newPassword = prompt('Enter your new password (at least 8 characters):');
      if (newPassword && newPassword.length >= 8) {
        const { error } = await sb.auth.updateUser({ password: newPassword });
        message('authMessage', error ? error.message : 'Password updated. Please sign in.', error ? 'error' : 'success');
        if (!error) await sb.auth.signOut();
      }
      return;
    }
    if (session?.user && !currentUser) {
      try { await loadAccount(session.user); }
      catch (error) { showAuth('login'); message('authMessage', error.message || 'Could not load your account.', 'error'); }
    } else if (!session?.user) {
      currentUser = null;
      showAuth('login');
    }
  });

  sb.auth.getSession().then(({ data, error }) => {
    if (error) {
      showAuth('login');
      message('authMessage', error.message, 'error');
    } else if (data.session?.user) {
      loadAccount(data.session.user).catch(error => {
        showAuth('login');
        message('authMessage', error.message || 'Could not load your account.', 'error');
      });
    } else {
      showAuth('login');
    }
  });
})();