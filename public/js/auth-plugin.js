/**
 * Auth Plugin - Unified authentication injection for host pages
 *
 * Drop this single script into any page to get full auth functionality:
 *   <script src="https://cloud.model.earth/auth/js/auth-plugin.js" defer></script>
 *   (localsite loads it from the path set in webroot.yaml's auth: block)
 *
 * The plugin will:
 *   1. Detect environment and configure AUTH_API_URL
 *   2. Inject sign-in/sign-out UI into #accountPanelInserts (or fallback)
 *      - #accountPanelInserts present: provider buttons rendered inline (no popup)
 *      - absent after timeout: floating Sign In button that opens the popup modal
 *   3. Check session on load and update UI accordingly
 *   4. Lazy-load auth-modal.js only when a popup is explicitly needed
 *
 * Exposes: window.showAuthModal, window.updateAuthUI, window.handleSignOut, window.authSignInWith
 */
(function () {
  'use strict';

  // -- Environment Detection & API URL ------------------------------

  var isLocalhost = ['localhost', '127.0.0.1', '::1'].indexOf(location.hostname) !== -1;

  // Default: /api on the origin this script was loaded from, since the
  // CloudRoot Worker (and chat's Node server) serve both. Local static
  // servers (8887/8888/8889) have no API, so their pages use chat's Node
  // server on port 3700.
  var scriptOrigin = document.currentScript && document.currentScript.src
    ? new URL(document.currentScript.src).origin
    : location.origin;
  var authApiUrl = window.AUTH_API_URL;
  if (!authApiUrl) {
    authApiUrl = isLocalhost && ['8887', '8888', '8889'].indexOf(new URL(scriptOrigin).port) !== -1
      ? 'http://localhost:3700/api'
      : scriptOrigin + '/api';
  }
  window.AUTH_API_URL = authApiUrl;

  // -- Provider Config ----------------------------------------------

  // Providers with no credentials configured. Greyed out on localhost, hidden in production.
  // Replaced by the server's answer once /auth/configured-providers responds.
  var UNCONFIGURED_PROVIDERS = ['facebook'];

  var PROVIDERS = [
    {
      id: 'google', label: 'Continue with Google',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>'
    },
    {
      id: 'microsoft', label: 'Continue with Microsoft',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#00a4ef"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/></svg>'
    },
    {
      id: 'discord', label: 'Continue with Discord',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.191.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>'
    },
    {
      id: 'linkedin', label: 'Continue with LinkedIn',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#0077b5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>'
    },
    {
      id: 'facebook', label: 'Continue with Facebook',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>'
    },
    {
      id: 'github', label: 'Continue with GitHub',
      svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>'
    }
  ];

  // -- Sign In ------------------------------------------------------

  function signInWith(provider) {
    if (UNCONFIGURED_PROVIDERS.indexOf(provider) !== -1) {
      alert(provider.charAt(0).toUpperCase() + provider.slice(1) + ' sign-in is not yet configured. | Please use another provider.');
      return;
    }
    window.location.href = authApiUrl + '/oauth/' + provider + '?redirect=' + encodeURIComponent(window.location.href);
  }
  window.authSignInWith = signInWith;

  // -- Logging Helper -----------------------------------------------

  function log(msg) {
    if (typeof console !== 'undefined') {
      console.log('[Auth Plugin] ' + msg);
    }
  }

  // -- Style Injection ----------------------------------------------

  var STYLE_ID = 'auth-plugin-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '#auth-plugin-signOut {' +
        'display: none;' +
        'padding: 7px 16px;' +
        'background: linear-gradient(135deg, #ff2e2ea4 0%, #ff27274d 100%);' +
        'border: 1.5px solid rgba(239,68,68,0.3);' +
        'border-radius: 7px;' +
        'color: #fef2f2;' +
        'font-size: 11pt;' +
        'font-weight: 600;' +
        'cursor: pointer;' +
        'transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);' +
        'box-shadow: 0 2px 5px rgba(220,38,38,0.3);' +
        'letter-spacing: 0.01em;' +
      '}' +
      '#auth-plugin-signOut:hover {' +
        'background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);' +
        'border-color: rgba(239,68,68,0.5);' +
        'color: #ffffff;' +
        'box-shadow: 0 3px 10px rgba(220,38,38,0.4);' +
      '}' +
      '#auth-plugin-signOut:active {' +
        'transform: scale(0.97);' +
      '}' +
      '.auth-plugin-user-info {' +
        'display: none;' +
        'text-align: center;' +
        'margin-bottom: 25px;' +
      '}' +
      '.auth-plugin-avatar {' +
        'width: 64px; height: 64px; border-radius: 50%;' +
        'object-fit: cover;' +
        'border: 2.5px solid rgba(96,165,250,0.3);' +
        'box-shadow: 0 3px 8px rgba(0,0,0,0.3);' +
        'margin: 12px auto;' +
        'display: none;' +
      '}' +
      '.auth-plugin-name {' +
        'font-size: 14.5pt; font-weight: 600; color: #f7fafc;' +
        'letter-spacing: -0.02em;' +
      '}' +
      '.auth-plugin-email {' +
        'font-size: 10pt; color: #94a3b8; font-weight: 400;' +
        'letter-spacing: 0.01em; margin-top: 3px;' +
      '}' +
      '.auth-plugin-fallback {' +
        'position: fixed; top: 8px; right: 12px; z-index: 10000;' +
      '}' +
      '.auth-inline-buttons {' +
        'display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px;' +
      '}' +
      '.auth-btn {' +
        'display: flex; align-items: center; justify-content: center; gap: 12px;' +
        'padding: 12px 16px;' +
        'border: 1px solid #E5E7EB; border-radius: 8px;' +
        'background: #FFFFFF; color: #374151;' +
        'font-size: 15px; font-weight: 500;' +
        'cursor: pointer; width: 100%;' +
        'transition: all 0.2s ease;' +
      '}' +
      '.auth-btn:hover {' +
        'background: #F9FAFB; border-color: #D1D5DB;' +
        'transform: translateY(-1px);' +
        'box-shadow: 0 2px 8px rgba(0,0,0,0.1);' +
      '}' +
      '.auth-btn:active { transform: translateY(0); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }' +
      '.auth-btn.inactive {' +
        'opacity: 0.5; cursor: not-allowed;' +
        'background: #F3F4F6; border-style: dashed; border-color: #D1D5DB;' +
      '}' +
      '.auth-btn.inactive:hover { transform: none; box-shadow: none; background: #F3F4F6; border-color: #D1D5DB; }' +
      '.auth-btn.inactive svg { filter: grayscale(100%); opacity: 0.6; }' +
      '.auth-server-status {' +
        'text-align: center; font-size: 13px; font-weight: 500;' +
        'padding: 8px 12px; margin-bottom: 8px; border-radius: 8px;' +
        'background: #F3F4F6; color: #6B7280;' +
      '}' +
      '.auth-server-status.online { background: #ECFDF5; color: #047857; }' +
      '.auth-server-status.offline { background: #FEF2F2; color: #B91C1C; }' +
      '#auth-plugin-signIn-container .sign-in-container { container-type: inline-size; }' +
      '@container (max-width: 300px) {' +
        '.auth-inline-buttons { grid-template-columns: 1fr; }' +
      '}';
    document.head.appendChild(style);
  }

  // -- Inline Provider Buttons --------------------------------------

  function buildProviderButtons() {
    var html = '<div id="auth-inline-status" class="auth-server-status">Checking auth server…</div>';
    html += '<div class="auth-inline-buttons">';
    for (var i = 0; i < PROVIDERS.length; i++) {
      var p = PROVIDERS[i];
      html += '<button class="auth-btn" onclick="authSignInWith(\'' + p.id + '\')">' +
                p.svg + ' ' + p.label +
              '</button>';
    }
    html += '</div>';
    return html;
  }

  function applyProviderVisibility(container) {
    for (var j = 0; j < PROVIDERS.length; j++) {
      var shown = container.querySelector('[onclick*="\'' + PROVIDERS[j].id + '\'"]');
      if (shown) { shown.classList.remove('inactive'); shown.style.display = ''; }
    }
    for (var i = 0; i < UNCONFIGURED_PROVIDERS.length; i++) {
      var id = UNCONFIGURED_PROVIDERS[i];
      var btn = container.querySelector('[onclick*="\'' + id + '\'"]');
      if (!btn) continue;
      if (isLocalhost) {
        btn.classList.add('inactive');
      } else {
        btn.style.display = 'none';
      }
    }
  }

  // Asks the API which providers have credentials, then re-applies visibility.
  function loadConfiguredProviders(container) {
    fetch(authApiUrl + '/auth/configured-providers')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || !Array.isArray(data.providers)) return;
        UNCONFIGURED_PROVIDERS = PROVIDERS
          .map(function (p) { return p.id; })
          .filter(function (id) { return data.providers.indexOf(id) === -1; });
        applyProviderVisibility(container);
      })
      .catch(function () {});
  }

  function checkInlineServerStatus() {
    var el = document.getElementById('auth-inline-status');
    if (!el) return;
    fetch(authApiUrl + '/auth/get-session', { credentials: 'include' })
      .then(function (res) {
        if (res.ok) {
          el.textContent = 'Auth server connected';
          el.className = 'auth-server-status online';
        } else {
          el.textContent = 'Auth server unavailable (HTTP ' + res.status + ') — sign-in won\'t work yet';
          el.className = 'auth-server-status offline';
        }
      })
      .catch(function () {
        el.textContent = 'Auth server unreachable — sign-in won\'t work yet';
        el.className = 'auth-server-status offline';
      });
  }

  // -- UI Injection -------------------------------------------------

  function buildAuthHTML() {
    return (
      '<!-- Auth Plugin: Sign Out (shown only when signed in) -->' +
      '<div style="display:flex;justify-content:flex-end;margin-bottom:12px;">' +
        '<button id="auth-plugin-signOut">🚪 Sign Out</button>' +
      '</div>' +
      '<!-- Auth Plugin: Sign-In Container -->' +
      '<div id="auth-plugin-signIn-container" style="width:100%;">' +
        '<div class="sign-in-container">' +
          buildProviderButtons() +
        '</div>' +
        '<div class="auth-plugin-user-info user-info-container">' +
          '<div style="margin-bottom:12px;margin-top:12px;">' +
            '<img class="auth-plugin-avatar" id="auth-plugin-avatar" src="" alt="">' +
          '</div>' +
          '<div>' +
            '<div class="auth-plugin-name" id="auth-plugin-name"></div>' +
            '<div class="auth-plugin-email" id="auth-plugin-email"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function attachEventListeners() {
    var signOutBtn = document.getElementById('auth-plugin-signOut');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        handleSignOut();
      });
    }
  }

  // -- Session Check & UI Update ------------------------------------

  function showUser(user, signInContainer, userInfoContainer) {
    log('User authenticated: ' + user.name);
    if (signInContainer) signInContainer.style.display = 'none';
    if (userInfoContainer) {
      userInfoContainer.style.display = 'block';
      var signOutBtn = document.getElementById('auth-plugin-signOut');
      if (signOutBtn) signOutBtn.style.display = 'inline-block';
      var avatar = document.getElementById('auth-plugin-avatar');
      if (avatar && user.image) {
        avatar.src = user.image;
        avatar.style.display = 'block';
      } else if (avatar) {
        avatar.style.display = 'none';
      }
      var nameEl = document.getElementById('auth-plugin-name');
      if (nameEl) nameEl.textContent = user.name;
      var emailEl = document.getElementById('auth-plugin-email');
      if (emailEl && user.email) emailEl.textContent = user.email;
    }
  }

  function updateAuthUI() {
    var signInContainer = document.querySelector('.sign-in-container');
    var userInfoContainer = document.querySelector('.auth-plugin-user-info') ||
                            document.querySelector('.user-info-container');

    log('Updating authentication UI state');

    // After OAuth redirect the relay encodes user info in the URL hash so we
    // never need a cross-origin get-session fetch (blocked in Chrome incognito).
    // Parse hash manually — URLSearchParams would decode %2B to + then treat + as
    // space, corrupting standard base64. Manual parsing + decodeURIComponent is safe.
    var authUserEncoded = null;
    var rawHash = location.hash.slice(1);
    rawHash.split('&').forEach(function(pair) {
      var eq = pair.indexOf('=');
      if (eq > -1 && pair.slice(0, eq) === 'auth_user') {
        authUserEncoded = decodeURIComponent(pair.slice(eq + 1));
      }
    });
    if (authUserEncoded) {
      try {
        // Accept both base64url (relay v2: -, _) and standard base64 (relay v1: +, /)
        var b64 = authUserEncoded.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        var user = JSON.parse(decodeURIComponent(atob(b64)));
        if (user && user.id) {
          history.replaceState(null, '', location.pathname + location.search);
          showUser(user, signInContainer, userInfoContainer);
          return;
        }
      } catch (e) {
        log('Error parsing auth_user from hash: ' + e);
      }
    }

    fetch(authApiUrl + '/auth/get-session', { credentials: 'include' })
      .then(function (response) {
        if (!response.ok) throw new Error('Session check failed');
        return response.json();
      })
      .then(function (result) {
        if (result && result.user) {
          showUser(result.user, signInContainer, userInfoContainer);
          return;
        }
        showSignedOut(signInContainer, userInfoContainer);
      })
      .catch(function (e) {
        log('Error checking authentication: ' + e);
        showSignedOut(signInContainer, userInfoContainer);
      });
  }

  function showSignedOut(signInContainer, userInfoContainer) {
    log('No authenticated user');
    if (signInContainer) signInContainer.style.display = 'block';
    if (userInfoContainer) userInfoContainer.style.display = 'none';
    var signOutBtn = document.getElementById('auth-plugin-signOut');
    if (signOutBtn) signOutBtn.style.display = 'none';
  }

  // -- Sign Out -----------------------------------------------------

  function handleSignOut() {
    log('Signing out user');
    fetch(authApiUrl + '/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
      .then(function () { window.location.reload(); })
      .catch(function (e) {
        log('Error during sign-out: ' + e);
        window.location.reload();
      });
  }

  // -- Popup Modal (fallback / programmatic) ------------------------

  function showAuthModal() {
    if (window.authModal) {
      window.authModal.show();
      return;
    }

    var modalPath = resolveModalPath();
    log('Lazy-loading auth modal from: ' + modalPath);

    var script = document.createElement('script');
    script.src = modalPath;
    script.onload = function () {
      if (window.authModal) {
        window.authModal.show();
      }
    };
    script.onerror = function () {
      log('Failed to load auth-modal.js');
    };
    document.head.appendChild(script);
  }

  function resolveModalPath() {
    if (window.AUTH_MODAL_PATH) return window.AUTH_MODAL_PATH;

    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (src.indexOf('auth-plugin.js') !== -1) {
        return src.replace('auth-plugin.js', 'auth-modal.js');
      }
    }

    return (window.appBaseUrl || '/') + 'auth/js/auth-modal.js';
  }

  // -- Mount Point Detection & Init ---------------------------------

  var MOUNT_ID = 'accountPanelInserts';
  var FALLBACK_MS = 15000;
  var injected = false;

  function inject(target, isFallback) {
    if (injected) return;
    injected = true;
    injectStyles();

    if (isFallback) {
      // No account panel found — floating Sign In button opens the popup modal.
      var wrapper = document.createElement('div');
      wrapper.className = 'auth-plugin-fallback local';
      wrapper.style.display = 'none';
      var btn = document.createElement('button');
      btn.id = 'auth-plugin-signIn';
      btn.className = 'btn btn-primary';
      btn.textContent = 'Sign In';
      btn.addEventListener('click', showAuthModal);
      wrapper.appendChild(btn);
      document.body.insertBefore(wrapper, document.body.firstChild);
      log('Fallback sign-in button injected');
    } else {
      // Account panel found — render provider buttons inline, no popup needed.
      target.innerHTML = buildAuthHTML() + target.innerHTML;
      attachEventListeners();
      applyProviderVisibility(target);
      loadConfiguredProviders(target);
      checkInlineServerStatus();
      log('Inline auth UI injected into #' + MOUNT_ID);
    }

    updateAuthUI();
  }

  function init() {
    var existing = document.getElementById(MOUNT_ID);
    if (existing) {
      inject(existing, false);
      return;
    }

    // template-main.html is fetched via AJAX by localsite.js, so #accountPanelInserts
    // won't exist until that async load completes. Use MutationObserver to detect it.
    log('Waiting for #' + MOUNT_ID + ' (async template load)...');

    var observeTarget = document.body || document.documentElement;
    var observer = new MutationObserver(function () {
      var el = document.getElementById(MOUNT_ID);
      if (el) {
        observer.disconnect();
        clearTimeout(fallbackTimer);
        inject(el, false);
      }
    });

    observer.observe(observeTarget, { childList: true, subtree: true });

    var fallbackTimer = setTimeout(function () {
      observer.disconnect();
      if (!injected) {
        log('#' + MOUNT_ID + ' not found after ' + FALLBACK_MS + 'ms, using fallback');
        inject(null, true);
      }
    }, FALLBACK_MS);
  }

  // -- Global API ---------------------------------------------------

  window.showAuthModal = showAuthModal;
  window.updateAuthUI = updateAuthUI;
  window.handleSignOut = handleSignOut;

  // -- Hash-based popup trigger -------------------------------------

  document.addEventListener('hashChangeEvent', function () {
    var hash = typeof getHash === 'function' ? getHash() : {};
    if (hash.popup === 'login') {
      showAuthModal();
    }
  });

  // -- Start --------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
