(() => {
  // Never run inside user web apps opened in Antigravity's split embedded browser
  if (!window.electronNative && !document.querySelector('.agy-shell')) {
    return 'Skipped non-Antigravity page';
  }

  const THEMES = /*__THEMES_PLACEHOLDER__*/{};
  const THEME_KEYS = Object.keys(THEMES);
  const DEFAULT_THEME_KEY = THEME_KEYS[0] || 'Default';

  const STORAGE_THEME = 'agy_theme_v3';
  const STORAGE_BUBBLE = 'agy_bubble_v3';
  const STORAGE_INPUT = 'agy_input_v3';
  const STORAGE_DIMMING = 'agy_dimming_v3';
  const STORAGE_WP_ENABLED = 'agy_wp_enabled_v3';
  const STORAGE_CUSTOM_WP = 'agy_custom_wp_v3';
  const STORAGE_USER_AVATAR = 'agy_user_avatar_v3';
  const STORAGE_AGENT_AVATAR = 'agy_agent_avatar_v3';
  const STORAGE_GLASS_BLUR = 'agy_glass_blur_v3';
  const STORAGE_AVATAR_SIZE = 'agy_avatar_size_v3';
  const STORAGE_AVATAR_RADIUS = 'agy_avatar_radius_v3';
  const STORAGE_QUOTA_SIDEBAR = 'agy_quota_sidebar_v1';
  const STORAGE_QUOTA_TITLEBAR = 'agy_quota_titlebar_v1';
  const STORAGE_QUOTA_CACHE = 'agy_quota_cache_v1';
  const STORAGE_QUOTA_EXPANDED = 'agy_quota_expanded_v1';

  const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const REFRESH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`;
  const BOLT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

  const INPUT_STYLES = {
    'sync': {
      label: 'Synced Ornament Frame',
      desc: 'Follows the active theme borders & decorative SVG ornament'
    },
    'double_gold': {
      label: 'Amber Gold Double Border',
      desc: 'Warm metallic double border with corner filigree'
    },
    'glass': {
      label: 'Translucent Crystal Glass',
      desc: 'Lets more of your background artwork shine through'
    },
    'minimal': {
      label: 'Minimal Clean',
      desc: 'Sleek subtle border without top decorative stickers'
    }
  };

  function getState() {
    const init = window.__AGY_INITIAL_CONFIG__ || {};
    const rawTheme = localStorage.getItem(STORAGE_THEME) || init.themeName || DEFAULT_THEME_KEY;
    const themeName = THEMES[rawTheme] ? rawTheme : DEFAULT_THEME_KEY;
    const rawBubble = localStorage.getItem(STORAGE_BUBBLE) || init.bubbleName || themeName;
    const bubbleName = THEMES[rawBubble] ? rawBubble : themeName;
    const inputStyle = localStorage.getItem(STORAGE_INPUT) || init.inputStyle || 'sync';
    const dimming = parseInt(localStorage.getItem(STORAGE_DIMMING) || (init.dimming !== undefined ? init.dimming : '69'), 10);
    const wpEnabled = localStorage.getItem(STORAGE_WP_ENABLED) !== null
      ? localStorage.getItem(STORAGE_WP_ENABLED) !== 'false'
      : (init.wpEnabled !== undefined ? init.wpEnabled : true);
    const customWp = localStorage.getItem(STORAGE_CUSTOM_WP) || init.customWp || '';
    const userAvatar = localStorage.getItem(STORAGE_USER_AVATAR) ?? init.userAvatar ?? '';
    const agentAvatar = localStorage.getItem(STORAGE_AGENT_AVATAR) ?? init.agentAvatar ?? '';
    const rawBlur = localStorage.getItem(STORAGE_GLASS_BLUR) ?? init.glassBlur;
    const glassBlur = rawBlur !== undefined && rawBlur !== null && rawBlur !== '' ? parseInt(rawBlur, 10) : 3;
    const rawAvSize = localStorage.getItem(STORAGE_AVATAR_SIZE) ?? init.avatarSize;
    const avatarSize = rawAvSize !== undefined && rawAvSize !== null && rawAvSize !== '' ? parseInt(rawAvSize, 10) : 32;
    const rawAvRad = localStorage.getItem(STORAGE_AVATAR_RADIUS) ?? init.avatarRadius;
    const avatarRadius = rawAvRad !== undefined && rawAvRad !== null && rawAvRad !== '' ? parseInt(rawAvRad, 10) : 50;
    const showQuotaSidebar = localStorage.getItem(STORAGE_QUOTA_SIDEBAR) !== null
      ? localStorage.getItem(STORAGE_QUOTA_SIDEBAR) !== 'false'
      : (init.showQuotaSidebar !== undefined ? init.showQuotaSidebar : true);
    const showQuotaTitlebar = localStorage.getItem(STORAGE_QUOTA_TITLEBAR) !== null
      ? localStorage.getItem(STORAGE_QUOTA_TITLEBAR) !== 'false'
      : (init.showQuotaTitlebar !== undefined ? init.showQuotaTitlebar : true);
    return { themeName, bubbleName, inputStyle, dimming, wpEnabled, customWp, userAvatar, agentAvatar, glassBlur, avatarSize, avatarRadius, showQuotaSidebar, showQuotaTitlebar };
  }

  // Downscale user/agent avatar uploads to 192x192 WebP once so theme_config.json stays tiny
  function compressAvatarFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const size = 192;
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const natW = img.naturalWidth || size;
          const natH = img.naturalHeight || size;
          const side = Math.min(natW, natH);
          const sx = Math.max(0, Math.floor((natW - side) / 2));
          const sy = Math.max(0, Math.floor((natH - side) / 2));
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          const out = canvas.toDataURL('image/webp', 0.88);
          canvas.width = 0;
          canvas.height = 0;
          callback(out && out.startsWith('data:image/webp') ? out : String(reader.result || ''));
        } catch (e) {
          callback(String(reader.result || ''));
        }
      };
      img.onerror = () => callback(String(reader.result || ''));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  }

  // Downscale custom wallpaper uploads to max 2560px WebP so localStorage & theme_config.json stay compact
  function compressWallpaperFile(file, callback) {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 2560;
          const natW = img.naturalWidth || 1920;
          const natH = img.naturalHeight || 1080;
          const longest = Math.max(natW, natH);
          if (file.type === 'image/webp' && longest <= maxDim && file.size <= 1200 * 1024) {
            callback(raw);
            return;
          }
          const scale = longest > maxDim ? maxDim / longest : 1;
          const w = Math.max(1, Math.round(natW * scale));
          const h = Math.max(1, Math.round(natH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            callback(raw);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL('image/webp', 0.86);
          canvas.width = 0;
          canvas.height = 0;
          callback(out && out.startsWith('data:image/webp') ? out : raw);
        } catch (e) {
          callback(raw);
        }
      };
      img.onerror = () => callback(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  }

  const MAX_BLUR_CACHE = 4;

  // Convert large base64 data: URIs into tiny ~60-byte blob: Object URLs so Blink never
  // parses or inherits 700 KB CSS strings across thousands of DOM nodes.
  function toShortBlobUrl(uri) {
    if (!uri || !uri.startsWith('data:') || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return uri;
    }
    const cache = window.__AGY_BLOB_CACHE__ instanceof Map
      ? window.__AGY_BLOB_CACHE__
      : (window.__AGY_BLOB_CACHE__ = new Map());
    const key = `${uri.slice(0, 80)}|${uri.length}|${uri.slice(-24)}`;
    const existing = cache.get(key);
    if (existing) return existing;
    try {
      const comma = uri.indexOf(',');
      if (comma === -1) return uri;
      const meta = uri.slice(5, comma);
      const dataPart = uri.slice(comma + 1);
      const mime = (meta.split(';')[0] || 'application/octet-stream').trim();
      let blob;
      if (meta.includes(';base64')) {
        const bin = atob(dataPart);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        blob = new Blob([decodeURIComponent(dataPart)], { type: mime });
      }
      const objUrl = URL.createObjectURL(blob);
      cache.set(key, objUrl);
      while (cache.size > 16) {
        const oldestKey = cache.keys().next().value;
        const oldUrl = cache.get(oldestKey);
        cache.delete(oldestKey);
        if (oldUrl && oldUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(oldUrl); } catch (e) {}
        }
      }
      return objUrl;
    } catch (e) {
      return uri;
    }
  }

  function putBlurCache(key, val) {
    const cache = window.__AGY_BLUR_CACHE__ || (window.__AGY_BLUR_CACHE__ = new Map());
    if (cache.has(key)) cache.delete(key);
    cache.set(key, val);
    while (cache.size > MAX_BLUR_CACHE) {
      const oldestKey = cache.keys().next().value;
      const oldVal = cache.get(oldestKey);
      cache.delete(oldestKey);
      if (typeof oldVal === 'string' && oldVal.startsWith('blob:')) {
        try { URL.revokeObjectURL(oldVal); } catch (e) {}
      }
    }
  }

  function flushMetricsStyle() {
    const ms = window.__AGY_METRICS_STATE__ || (window.__AGY_METRICS_STATE__ = {
      glassBg: '',
      beforeClip: '',
      holeClip: ''
    });
    let css = '';
    if (ms.glassBg || ms.beforeClip) {
      css += '.agy-shell::before{';
      if (ms.glassBg) css += `background-image:${ms.glassBg}!important;`;
      if (ms.beforeClip) css += `clip-path:${ms.beforeClip}!important;`;
      css += '}';
    }
    if (ms.holeClip) {
      css += `body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"]::after{clip-path:${ms.holeClip}!important;}`;
    }
    if (css === window.__AGY_LAST_METRICS_CSS__) return;
    window.__AGY_LAST_METRICS_CSS__ = css;
    let el = document.getElementById('antigravity-custom-theme-metrics');
    if (!el) {
      el = document.createElement('style');
      el.id = 'antigravity-custom-theme-metrics';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  // Pre-bake L-shaped header/sidebar glass blur (debounced + LRU-capped + blob: URL) to avoid per-frame GPU backdrop readback
  function syncPrebakedGlass(wpUrl, overlayRgb, overlayAlpha, tintBg, blurStr, deferMs = 0) {
    if (window.__AGY_BLUR_TIMER__) {
      clearTimeout(window.__AGY_BLUR_TIMER__);
      window.__AGY_BLUR_TIMER__ = 0;
    }
    const ms = window.__AGY_METRICS_STATE__ || (window.__AGY_METRICS_STATE__ = { glassBg: '', beforeClip: '', holeClip: '' });
    if (!wpUrl) {
      ms.glassBg = '';
      flushMetricsStyle();
      return;
    }
    const key = `${wpUrl.slice(0, 64)}|${wpUrl.length}|${overlayRgb}|${overlayAlpha.toFixed(3)}|${tintBg}|${blurStr}`;
    const cache = window.__AGY_BLUR_CACHE__ instanceof Map
      ? window.__AGY_BLUR_CACHE__
      : (window.__AGY_BLUR_CACHE__ = new Map());
    const cached = cache.get(key);
    if (cached) {
      putBlurCache(key, cached);
      ms.glassBg = 'url("' + cached + '")';
      flushMetricsStyle();
      return;
    }

    const gen = (window.__AGY_BLUR_GEN__ = (window.__AGY_BLUR_GEN__ || 0) + 1);
    const runBake = () => {
      if (window.__AGY_BLUR_GEN__ !== gen) return;
      const img = new Image();
      img.onload = () => {
        if (window.__AGY_BLUR_GEN__ !== gen) return;
        try {
          const w = 640;
          const h = Math.max(180, Math.round((img.naturalHeight || 1440) * (w / (img.naturalWidth || 2560))));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const pxMatch = String(blurStr !== undefined ? blurStr : '3px').match(/(\d+(?:\.\d+)?)/);
          const scaledBlur = Math.max(0, Math.min(16, Math.round((pxMatch ? parseFloat(pxMatch[1]) : 3) * 0.75)));
          ctx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none';
          ctx.drawImage(img, -12, -12, w + 24, h + 24);
          ctx.filter = 'none';
          ctx.fillStyle = `rgba(${overlayRgb}, ${overlayAlpha})`;
          ctx.fillRect(0, 0, w, h);
          if (tintBg) {
            ctx.fillStyle = tintBg;
            ctx.fillRect(0, 0, w, h);
          }
          const applyBakedUrl = (bakedUrl) => {
            canvas.width = 0;
            canvas.height = 0;
            if (!bakedUrl || window.__AGY_BLUR_GEN__ !== gen) {
              if (bakedUrl && bakedUrl.startsWith('blob:')) {
                try { URL.revokeObjectURL(bakedUrl); } catch (e) {}
              }
              return;
            }
            putBlurCache(key, bakedUrl);
            const curMs = window.__AGY_METRICS_STATE__ || (window.__AGY_METRICS_STATE__ = { glassBg: '', beforeClip: '', holeClip: '' });
            curMs.glassBg = 'url("' + bakedUrl + '")';
            flushMetricsStyle();
          };
          if (typeof canvas.toBlob === 'function' && typeof URL.createObjectURL === 'function') {
            canvas.toBlob((blob) => {
              if (blob) applyBakedUrl(URL.createObjectURL(blob));
              else applyBakedUrl(canvas.toDataURL('image/webp', 0.85));
            }, 'image/webp', 0.85);
          } else {
            applyBakedUrl(canvas.toDataURL('image/webp', 0.85));
          }
        } catch (e) {}
      };
      img.src = wpUrl;
    };

    if (deferMs > 0) {
      window.__AGY_BLUR_TIMER__ = setTimeout(runBake, deferMs);
    } else {
      runBake();
    }
  }

  function persistThemeConfig(st, debounce) {
    if (typeof window.agySaveThemeConfig !== 'function') return;
    if (window.__AGY_SAVE_TIMER__) {
      clearTimeout(window.__AGY_SAVE_TIMER__);
      window.__AGY_SAVE_TIMER__ = 0;
    }
    const flush = () => {
      window.__AGY_SAVE_TIMER__ = 0;
      try {
        window.agySaveThemeConfig(JSON.stringify(st));
      } catch (e) {}
    };
    if (debounce) {
      window.__AGY_SAVE_TIMER__ = setTimeout(flush, 200);
    } else {
      flush();
    }
  }

  function applyTheme(overrides = {}, opts = {}) {
    const st = { ...getState(), ...overrides };
    try {
      localStorage.setItem(STORAGE_THEME, st.themeName);
      localStorage.setItem(STORAGE_BUBBLE, st.bubbleName);
      localStorage.setItem(STORAGE_INPUT, st.inputStyle);
      localStorage.setItem(STORAGE_DIMMING, String(st.dimming));
      localStorage.setItem(STORAGE_WP_ENABLED, String(st.wpEnabled));
      if (overrides.customWp !== undefined) {
        localStorage.setItem(STORAGE_CUSTOM_WP, overrides.customWp);
      }
      if (overrides.userAvatar !== undefined) {
        localStorage.setItem(STORAGE_USER_AVATAR, overrides.userAvatar);
      }
      if (overrides.agentAvatar !== undefined) {
        localStorage.setItem(STORAGE_AGENT_AVATAR, overrides.agentAvatar);
      }
      if (overrides.glassBlur !== undefined) {
        localStorage.setItem(STORAGE_GLASS_BLUR, String(st.glassBlur));
      }
      if (overrides.avatarSize !== undefined) {
        localStorage.setItem(STORAGE_AVATAR_SIZE, String(st.avatarSize));
      }
      if (overrides.avatarRadius !== undefined) {
        localStorage.setItem(STORAGE_AVATAR_RADIUS, String(st.avatarRadius));
      }
      if (overrides.showQuotaSidebar !== undefined) {
        localStorage.setItem(STORAGE_QUOTA_SIDEBAR, String(st.showQuotaSidebar));
      }
      if (overrides.showQuotaTitlebar !== undefined) {
        localStorage.setItem(STORAGE_QUOTA_TITLEBAR, String(st.showQuotaTitlebar));
      }
    } catch (e) {}

    if (!opts.skipSave) {
      persistThemeConfig(st, Boolean(opts.debounceSave));
    }

    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const bubbleTheme = THEMES[st.bubbleName] || mainTheme;
    const rawWpUrl = st.customWp || mainTheme.wallpaper || '';
    const wpUrl = toShortBlobUrl(rawWpUrl);

    const oldLegacy = document.getElementById('antigravity-ho-ly-chibi-theme');
    if (oldLegacy) oldLegacy.remove();

    let styleEl = document.getElementById('antigravity-custom-theme-active');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'antigravity-custom-theme-active';
      document.head.appendChild(styleEl);
    }

    const overlayAlpha = mainTheme.clearBackdrop
      ? Math.min(0.92, Math.max(0.0, ((st.dimming - 10) / 82) * 0.85))
      : Math.min(0.92, Math.max(0.12, (st.dimming / 100) * 0.78));
    const overlayRgb = mainTheme.overlayRgb || '10, 7, 6';
    const bgPosition = mainTheme.bgPosition || 'center center';
    const secondaryGlowStop = mainTheme.secondaryGlow
      ? `, radial-gradient(circle at 22% 72%, ${mainTheme.secondaryGlow} 0%, transparent 55%)`
      : '';

    let bgLayers = '';
    if (wpUrl) {
      bgLayers = mainTheme.clearBackdrop
        ? `linear-gradient(180deg, rgba(${overlayRgb}, ${overlayAlpha}) 0%, rgba(${overlayRgb}, ${overlayAlpha}) 100%), url("${wpUrl}")`
        : `radial-gradient(circle at 75% 40%, ${mainTheme.glow} 0%, transparent 65%)${secondaryGlowStop}, linear-gradient(180deg, rgba(${overlayRgb}, ${overlayAlpha * 0.85}) 0%, rgba(${overlayRgb}, ${overlayAlpha}) 100%), url("${wpUrl}")`;
    } else {
      bgLayers = mainTheme.pureBg || `radial-gradient(circle at 75% 30%, ${mainTheme.glow} 0%, transparent 60%), linear-gradient(160deg, rgba(${overlayRgb}, 0.96) 0%, #070910 100%)`;
    }

    const wpCss = st.wpEnabled ? `
      .agy-shell {
        background-image: ${bgLayers} !important;
        background-size: cover !important;
        background-position: ${bgPosition} !important;
        background-repeat: no-repeat !important;
        image-rendering: auto !important;
      }
      .agy-sheet,
      .agy-inset-shell,
      .browser-hole-opaque,
      [data-main-content-body="true"],
      [data-side-panel-body="true"],
      [class*="agy-inset-shell"],
      [class*="--shell-canvas"],
      .agy-shell div.absolute.bottom-0.pointer-events-none,
      .agy-shell [class*="z-50"] .pointer-events-none.right-full,
      .agy-shell [data-main-content-body="true"] .bg-background,
      .agy-shell [data-side-panel-body="true"] .bg-background,
      .agy-shell [data-testid="sidebar-split"] .bg-background {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      /* Browser split-pane hole cutout: keep wallpaper & L-glass visible outside [data-browser-hole] without covering live BrowserView */
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"]::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background-image: ${bgLayers};
        background-size: cover;
        background-position: ${bgPosition};
        background-repeat: no-repeat;
        clip-path: var(--agy-hole-clip, none);
        will-change: transform;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] > :not([data-has-browser-hole="true"]):not([data-browser-hole]:not([data-browser-hole="false"])):not(.settings-modal-container),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] .browser-hole-opaque:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-pane-id]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-tiling-pane]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-main-content-header]:not([data-has-browser-hole="true"]),
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-side-panel-strip]:not([data-has-browser-hole="true"]) {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] :is([data-main-content-body], [data-side-panel-body]):not([data-has-browser-hole="true"]) {
        box-shadow: none !important;
      }
      body[data-has-browser-hole="true"] .agy-shell[data-agy-hole-active="1"] [data-split-sash] {
        background: rgba(56, 189, 248, 0.14) !important;
        background-image: none !important;
      }
    ` : `
      .agy-shell {
        background: #111113 !important;
      }
    `;

    const defaultCornerSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M2 20 L2 6 Q2 2 6 2 L20 2' stroke='%23fbbf24' stroke-width='1.5' fill='none' opacity='0.65'/%3E%3Ccircle cx='6' cy='6' r='2' fill='%23fbbf24' opacity='0.75'/%3E%3C/svg%3E";
    const cornerFiligreeUrl = toShortBlobUrl(bubbleTheme.cornerSvg || defaultCornerSvg);
    const stickerUrl = toShortBlobUrl(bubbleTheme.sticker || '');

    const bubbleStickerCss = stickerUrl ? (bubbleTheme.isOrnament ? `
      .group\\/user-input-step {
        padding-top: 18px !important;
      }
      .agy-user-bubble-frame::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: ${bubbleTheme.stickerRight}px;
        width: ${bubbleTheme.stickerW}px;
        height: ${bubbleTheme.stickerH}px;
        background-image: url("${stickerUrl}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 25;
        pointer-events: none;
      }
    ` : `
      .group\\/user-input-step {
        padding-top: ${Math.max(36, Math.abs(bubbleTheme.stickerTop) + 8)}px !important;
      }
      .agy-user-bubble-frame::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: ${bubbleTheme.stickerRight}px;
        width: ${bubbleTheme.stickerW}px;
        height: ${bubbleTheme.stickerH}px;
        background-image: url("${stickerUrl}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        z-index: 25;
        pointer-events: none;
      }
    `) : `
      .agy-user-bubble-frame::before { display: none !important; }
    `;

    const showInputSticker = st.inputStyle !== 'minimal' && stickerUrl;
    const inputStickerCss = showInputSticker ? (bubbleTheme.isOrnament ? `
      .surface-composer {
        margin-top: 16px !important;
        overflow: visible !important;
      }
      .surface-composer::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop}px;
        right: 16px;
        width: ${bubbleTheme.stickerW + 8}px;
        height: ${bubbleTheme.stickerH + 2}px;
        background-image: url("${stickerUrl}");
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 30;
        pointer-events: none;
      }
      .surface-composer::after {
        content: "";
        position: absolute;
        bottom: 3px;
        left: 4px;
        width: 16px;
        height: 16px;
        background-image: url("${cornerFiligreeUrl}");
        background-size: contain;
        background-repeat: no-repeat;
        transform: rotate(180deg);
        z-index: 25;
        pointer-events: none;
        opacity: 0.78;
      }
    ` : `
      .surface-composer {
        margin-top: 28px !important;
        overflow: visible !important;
      }
      .surface-composer::before {
        content: "";
        position: absolute;
        top: ${bubbleTheme.stickerTop - 4}px;
        right: 16px;
        width: ${bubbleTheme.stickerW + 6}px;
        height: ${bubbleTheme.stickerH + 6}px;
        background-image: url("${stickerUrl}");
        background-size: contain;
        background-position: bottom center;
        background-repeat: no-repeat;
        z-index: 30;
        pointer-events: none;
      }
      .surface-composer::after { display: none !important; }
    `) : `
      .surface-composer::before,
      .surface-composer::after { display: none !important; }
    `;

    const inputCardBg =
      st.inputStyle === 'glass'
        ? (bubbleTheme.inputGlassBg || 'rgba(20, 15, 13, 0.52)')
        : st.inputStyle === 'double_gold'
        ? 'linear-gradient(145deg, rgba(44, 28, 20, 0.90) 0%, rgba(24, 15, 12, 0.92) 100%)'
        : (bubbleTheme.inputCardBg || 'rgba(28, 19, 16, 0.88)');

    const inputOuterBorder =
      st.inputStyle === 'double_gold'
        ? 'linear-gradient(135deg, #f59e0b 0%, rgba(217, 119, 6, 0.35) 50%, #fbbf24 100%)'
        : bubbleTheme.frameBg;

    const sidebarBg = mainTheme.sidebarBg || 'rgba(14, 10, 8, 0.68)';
    const sidebarHoverBg = mainTheme.sidebarHoverBg || 'rgba(255, 255, 255, 0.08)';
    const btnBg = mainTheme.btnBg || 'rgba(48, 30, 22, 0.62)';
    const modalBg = mainTheme.modalBg || 'rgba(14, 12, 12, 0.96)';
    const innerBubbleBorder = bubbleTheme.isScroll
      ? '2px solid #78350f'
      : (bubbleTheme.innerBorder || '1px solid rgba(255, 255, 255, 0.06)');

    const isLight = Boolean(mainTheme.isLight);
    const uiInk = mainTheme.uiTextColor || (isLight ? '#0f172a' : 'rgba(248, 250, 252, 0.96)');
    const uiMutedInk = mainTheme.uiMutedColor || (isLight ? '#334155' : 'rgba(241, 245, 249, 0.92)');
    const uiShadow = isLight ? 'none' : '0 1px 4px rgba(0, 0, 0, 0.92), 0 0 8px rgba(0, 0, 0, 0.68)';
    const pillBg = mainTheme.pillBg || (isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(6, 11, 24, 0.78)');
    const pillHoverBg = mainTheme.pillHoverBg || (isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(10, 18, 38, 0.92)');
    const pillText = mainTheme.pillTextColor || (isLight ? '#0f172a' : '#f8fafc');
    const pillBorder = mainTheme.pillBorder || (isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.16)');
    const preCodeBg = isLight ? `rgba(${overlayRgb}, 0.72)` : `rgba(${overlayRgb}, 0.56)`;

    const effectiveUserAvatar = toShortBlobUrl(st.userAvatar === 'none' ? '' : (st.userAvatar || mainTheme.userAvatar || ''));
    const effectiveAgentAvatar = toShortBlobUrl(st.agentAvatar === 'none' ? '' : (st.agentAvatar || mainTheme.agentAvatar || ''));
    const avSize = Math.min(52, Math.max(22, Number(st.avatarSize) || 32));
    const avAgentSize = Math.max(22, avSize - 2);
    const avRadius = Math.min(50, Math.max(0, Number.isFinite(Number(st.avatarRadius)) ? Number(st.avatarRadius) : 50));

    const avatarCss = `
      ${effectiveUserAvatar ? `
      .agy-shell [data-testid="user-message"] {
        position: relative !important;
        padding-right: ${avSize + 10}px !important;
      }
      .agy-shell [data-testid="user-message"]::after {
        content: "";
        position: absolute;
        right: 0;
        bottom: 6px;
        width: ${avSize}px;
        height: ${avSize}px;
        border-radius: ${avRadius}%;
        background-image: url("${effectiveUserAvatar}");
        background-size: cover;
        background-position: center;
        border: 1.5px solid ${mainTheme.primary};
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${mainTheme.glow};
        pointer-events: none;
      }
      ` : ''}
      ${effectiveAgentAvatar ? `
      .agy-shell [data-testid="agent-response"] {
        position: relative !important;
        padding-left: ${avAgentSize + 22}px !important;
        min-height: ${avAgentSize + 20}px !important;
      }
      .agy-shell [data-testid="agent-response"]::before {
        content: "";
        position: absolute;
        top: 12px;
        left: 12px;
        width: ${avAgentSize}px;
        height: ${avAgentSize}px;
        border-radius: ${avRadius}%;
        background-image: url("${effectiveAgentAvatar}");
        background-size: cover;
        background-position: center;
        border: 1.5px solid ${mainTheme.secondary || mainTheme.primary};
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 8px ${mainTheme.secondaryGlow || mainTheme.glow};
        pointer-events: none;
      }
      ` : ''}
    `;

    const sidebarEnhanceCss = isLight ? `
      .agy-shell .bg-sidebar a,
      .agy-shell .bg-sidebar span,
      .agy-shell .bg-sidebar button {
        color: ${uiInk};
      }
      .agy-shell .bg-sidebar .text-muted-foreground,
      .agy-shell .bg-sidebar .text-secondary-foreground {
        color: ${uiMutedInk} !important;
      }
    ` : (mainTheme.sidebarEnhanceText ? `
      .agy-shell .bg-sidebar .text-muted-foreground,
      .agy-shell .bg-sidebar .text-secondary-foreground {
        color: ${uiMutedInk} !important;
      }
    ` : '');

    const aiCardCss = mainTheme.aiCardBg ? `
      /* Translucent reading card for AI responses (zero live backdrop-filter, lightweight shadow) */
      .agy-shell [data-testid="agent-response"] {
        background: ${mainTheme.aiCardBg} !important;
        ${isLight ? `color: ${uiInk} !important;` : ''}
        backdrop-filter: none !important;
        border: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(255, 255, 255, 0.1)')} !important;
        border-radius: 14px !important;
        padding: 12px 16px !important;
        box-shadow: none !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-bleed,
      .agy-shell [data-testid="agent-response"] .md-table-host {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        margin-inline: 0 !important;
        left: auto !important;
        right: auto !important;
        transform: none !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-scroll {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 2px !important;
        box-sizing: border-box !important;
        /* Keep standard scrollbar-width: auto so Chromium does not disable ::-webkit-scrollbar */
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] .md-table-frame {
        /* .md-table-frame sits INSIDE .md-table-scroll; forcing width:100% + overflow:hidden hid overflow from .md-table-scroll */
        width: fit-content !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        transform: none !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-math-display, .katex-display) {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        padding-bottom: 4px !important;
        box-sizing: border-box !important;
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] :not(.md-math-display):not(.katex-display) > .katex {
        display: inline-block !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        vertical-align: middle !important;
        box-sizing: border-box !important;
        scrollbar-width: auto !important;
        scrollbar-color: auto !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar {
        height: 8px !important;
        display: block !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar-track {
        background: ${isLight ? 'rgba(15, 23, 42, 0.06)' : 'rgba(255, 255, 255, 0.06)'} !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar-thumb {
        background: ${isLight ? 'rgba(15, 23, 42, 0.34)' : 'rgba(148, 163, 184, 0.48)'} !important;
        border-radius: 9999px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(.md-table-scroll, .md-math-display, .katex-display, :not(.md-math-display):not(.katex-display) > .katex)::-webkit-scrollbar-thumb:hover {
        background: ${isLight ? 'rgba(15, 23, 42, 0.54)' : 'rgba(148, 163, 184, 0.72)'} !important;
      }
      .agy-shell [data-testid="agent-response"] table {
        width: 100% !important;
        min-width: 100% !important;
        max-width: none !important;
        margin: 0 !important;
        table-layout: auto !important;
        box-sizing: border-box !important;
      }
      .agy-shell [data-testid="agent-response"] :is(th, td) {
        max-width: none !important;
        white-space: normal !important;
        word-break: normal !important;
        overflow-wrap: break-word !important;
        padding: 8px 12px !important;
      }
      .agy-shell [data-testid="agent-response"] :is(td, th) .inline-pill-wrap {
        min-width: 0 !important;
      }
      ${isLight ? `
      .agy-shell [data-main-content-body="true"],
      .agy-shell [data-testid="agent-response"] :is(p, li, span, code, h1, h2, h3, h4, strong, td, th) {
        color: ${uiInk};
      }
      ` : ''}
      .agy-shell [data-main-content-body="true"] h1,
      .agy-shell [data-main-content-body="true"] h2 {
        text-shadow: ${isLight ? 'none' : '0 2px 10px rgba(0, 0, 0, 0.85)'};
      }
    ` : '';

    const useUnifiedGlass = Boolean(st.wpEnabled && wpUrl && mainTheme.unifiedGlass);
    if (useUnifiedGlass && typeof syncShellMetrics === 'function') {
      syncShellMetrics();
    }
    if (useUnifiedGlass) {
      const effectiveBlur = Number.isFinite(st.glassBlur) ? `${st.glassBlur}px` : (mainTheme.headerBlur || '3px');
      syncPrebakedGlass(wpUrl, overlayRgb, overlayAlpha, mainTheme.headerBg || '', effectiveBlur, opts.debounceSave ? 80 : 0);
    } else {
      syncPrebakedGlass(null);
    }

    const sidePanelCss = st.wpEnabled ? `
      /* Frosted pre-baked glass + dark/light reading scrim for right-side Artifact / Text / Diff split panels */
      body:not([data-has-browser-hole="true"]) .agy-shell [data-side-panel-body="true"]:not([data-has-browser-hole="true"]) {
        background: ${mainTheme.aiCardBg || `rgba(${overlayRgb}, 0.72)`} !important;
        ${isLight ? `color: ${uiInk} !important;` : ''}
        backdrop-filter: none !important;
        border-left: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)')} !important;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04) !important;
      }
      body:not([data-has-browser-hole="true"]) .agy-shell [data-side-panel-body="true"]:not([data-has-browser-hole="true"]) pre {
        background: ${preCodeBg} !important;
        border: 1px solid ${mainTheme.aiCardBorder || (isLight ? 'rgba(15, 23, 42, 0.14)' : 'rgba(255, 255, 255, 0.14)')} !important;
        border-radius: 10px !important;
      }
      .agy-shell [data-side-panel-body="true"] :is(h1, h2, h3, h4) {
        ${isLight ? `color: ${uiInk} !important;` : ''}
        text-shadow: ${isLight ? 'none' : '0 1px 6px rgba(0, 0, 0, 0.85)'};
      }
    ` : '';

    const headerCss = mainTheme.headerBg ? `
      /* Frosted top titlebar & seamless L-shaped unified glass (zero live backdrop-filter) */
      ${useUnifiedGlass ? `
      .agy-shell {
        position: relative !important;
      }
      .agy-shell > div:first-of-type {
        position: relative !important;
        z-index: 3 !important;
      }
      .agy-shell > div:not(:first-of-type) {
        position: relative !important;
        z-index: 2 !important;
      }
      .agy-shell::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background-color: ${mainTheme.headerBg};
        background-image: none;
        background-size: cover;
        background-position: ${bgPosition};
        background-repeat: no-repeat;
        backdrop-filter: none !important;
        will-change: transform;
        clip-path: polygon(0 0, 100% 0, 100% 75px, 256px 75px, 256px 100%, 0 100%);
      }
      .agy-shell [class*="@container/titlebar"] {
        background: transparent !important;
        backdrop-filter: none !important;
        border-bottom: 1px solid ${mainTheme.headerBorder || 'rgba(56, 189, 248, 0.10)'} !important;
      }
      ` : `
      .agy-shell [class*="@container/titlebar"] {
        background: ${mainTheme.headerBg} !important;
        backdrop-filter: none !important;
        border-bottom: 1px solid ${mainTheme.headerBorder || 'rgba(56, 189, 248, 0.15)'} !important;
      }
      `}
      .agy-shell [class*="@container/titlebar"] [data-testid="breadcrumb-segment"],
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] button,
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] span {
        color: ${uiInk} !important;
        text-shadow: ${uiShadow};
      }
      .agy-shell [class*="@container/titlebar"] [data-testid="pane-titlebar-toolbar"] button.border {
        background: ${isLight ? 'rgba(255, 255, 255, 0.56)' : 'rgba(6, 11, 24, 0.36)'} !important;
        border-color: ${pillBorder} !important;
      }
    ` : '';

    const sidebarOuterCss = useUnifiedGlass ? `
      .agy-shell aside,
      .agy-shell [data-sidebar="true"],
      .agy-shell .bg-sidebar:not(.surface-opaque) {
        background: transparent !important;
        backdrop-filter: none !important;
      }
    ` : `
      .agy-shell aside,
      .agy-shell [data-sidebar="true"],
      .agy-shell .bg-sidebar:not(.surface-opaque) {
        background: ${sidebarBg} !important;
        backdrop-filter: none !important;
      }
    `;

    styleEl.textContent = `
      ${wpCss}

      /* Translucent themed glass sidebar (unified via ::before when unifiedGlass is active) */
      ${sidebarOuterCss}
      .agy-shell .bg-sidebar:not(.surface-opaque) .bg-sidebar:not(.surface-opaque),
      .agy-shell [data-sidebar="true"] .bg-sidebar:not(.surface-opaque),
      .agy-shell .bg-sidebar:not(.surface-opaque) [class*="group/headerbtn"],
      .agy-shell .bg-sidebar:not(.surface-opaque) [class*="group/section-header"] {
        background: transparent !important;
        backdrop-filter: none !important;
      }
      /* Keep floating menubar dropdowns & opaque popovers readable (never inherit transparent sidebar bg) */
      .agy-shell .surface-opaque.bg-sidebar,
      .agy-shell .surface-opaque.border-menu-border {
        background: ${modalBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, ${isLight ? '0.18' : '0.65'}) !important;
        backdrop-filter: none !important;
      }
      /* Preserve virtual list positioning; hide sticky headers only while scrolled */
      .agy-shell .bg-sidebar .agy-scrolled > .w-full.relative > .bg-sidebar[style*="position: sticky"] {
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.14s ease !important;
      }
      .agy-shell .bg-sidebar [class*="group/headerbtn"]:hover,
      .agy-shell .bg-sidebar a:hover {
        background: ${sidebarHoverBg} !important;
      }
      ${sidebarEnhanceCss}
      ${aiCardCss}
      ${sidePanelCss}
      ${avatarCss}
      ${headerCss}

      /* "+ New Conversation" button glow */
      .agy-button-custom.border.border-border {
        background: ${btnBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3) !important;
      }

      /* User Chat Bubble Double-Border Frame & Ornament */
      .agy-user-bubble-frame {
        background: ${bubbleTheme.frameBg} !important;
        border-radius: ${bubbleTheme.isScroll ? '6px' : '14px'} !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28) !important;
        position: relative !important;
        overflow: visible !important;
        padding: 1.2px !important;
      }

      .agy-user-bubble-frame::after {
        content: "";
        position: absolute;
        top: 3px;
        left: 3px;
        width: ${bubbleTheme.isOrnament ? '16px' : '14px'};
        height: ${bubbleTheme.isOrnament ? '16px' : '14px'};
        background-image: url("${cornerFiligreeUrl}");
        background-size: contain;
        background-repeat: no-repeat;
        pointer-events: none;
        opacity: ${bubbleTheme.isOrnament ? '0.85' : '0.65'};
      }

      .agy-user-bubble {
        background: ${bubbleTheme.bg} !important;
        border-radius: ${bubbleTheme.isScroll ? '5px' : '13px'} !important;
        padding: 8px 16px !important;
        color: ${bubbleTheme.textColor} !important;
        border: ${innerBubbleBorder} !important;
        overflow: visible !important;
        font-weight: 450 !important;
      }

      .agy-user-bubble * {
        color: ${bubbleTheme.textColor} !important;
      }

      /* Double-Border Input Composer */
      .surface-composer {
        background: ${inputOuterBorder} !important;
        border-radius: 16px !important;
        padding: 1.5px !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5), 0 0 14px ${bubbleTheme.glow} !important;
        position: relative !important;
      }

      .surface-composer-card {
        background: ${inputCardBg} !important;
        backdrop-filter: none !important;
        border-radius: 14.5px !important;
        border: ${bubbleTheme.innerBorder || '1px solid rgba(255, 255, 255, 0.07)'} !important;
      }

      /* High-contrast pill badges for top composer bar (adaptive light/dark theme) */
      .surface-composer [data-testid="project-selector-trigger"],
      .surface-composer [data-testid="branch-pill-trigger"],
      .surface-composer [aria-label="Select Environment"],
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"] {
        background: ${pillBg} !important;
        color: ${pillText} !important;
        border: 1px solid ${pillBorder} !important;
        border-radius: 9999px !important;
        font-weight: 500 !important;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.25) !important;
        margin: 1px 2px !important;
        transition: background-color 0.15s ease, border-color 0.15s ease !important;
      }
      .surface-composer [data-testid="branch-pill-trigger"],
      .surface-composer [aria-label="Select Environment"],
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button:not([data-testid="project-selector-trigger"]),
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"]:not([data-testid="project-selector-trigger"]) {
        padding-left: 8px !important;
        padding-right: 7px !important;
        gap: 4px !important;
      }
      .surface-composer [data-testid="project-selector-trigger"]:hover,
      .surface-composer [data-testid="branch-pill-trigger"]:hover,
      .surface-composer [aria-label="Select Environment"]:hover,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button:hover,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"]:hover {
        background: ${pillHoverBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        color: ${pillText} !important;
      }
      .surface-composer [data-testid="project-selector-trigger"] *,
      .surface-composer [data-testid="branch-pill-trigger"] *,
      .surface-composer [aria-label="Select Environment"] *,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] button *,
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] [role="button"] * {
        color: ${pillText} !important;
      }
      .surface-composer > :not(.surface-composer-card) [data-testid="input-box-bottom-toolbar"] .ml-auto > * {
        background: ${pillBg} !important;
        color: ${pillText} !important;
        border-radius: 9999px !important;
        padding: 2px 8px !important;
      }

      ${bubbleStickerCss}
      ${inputStickerCss}

      @media (max-width: 640px) {
        .agy-user-bubble-frame::before,
        .surface-composer::before {
          transform: scale(0.78);
          transform-origin: bottom right;
        }
      }

      .settings-modal-container {
        background: ${modalBg} !important;
        border: 1px solid ${mainTheme.borderColor} !important;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.75), 0 0 24px ${mainTheme.glow} !important;
        backdrop-filter: none !important;
      }

      #agy-custom-theme-modal-dialog {
        background: ${modalBg} !important;
        border-color: ${mainTheme.borderColor} !important;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px ${mainTheme.glow} !important;
      }
      #agy-custom-theme-modal-header {
        background: ${mainTheme.modalHeaderBg || 'rgba(22, 16, 14, 0.85)'} !important;
      }
      #agy-custom-theme-badge {
        color: ${mainTheme.primary} !important;
        border-color: ${mainTheme.borderColor} !important;
        background: ${mainTheme.glow} !important;
      }
      #agy-custom-theme-sidebar-btn svg {
        color: ${mainTheme.primary} !important;
      }
      #agy-quota-sidebar-card {
        background: ${isLight ? 'rgba(255, 255, 255, 0.72)' : (mainTheme.cardBg || 'rgba(12, 18, 34, 0.78)')};
        border: 1px solid ${mainTheme.borderColor};
        color: ${uiInk};
      }
      #agy-quota-titlebar-pill {
        background: ${pillBg};
        border: 1px solid ${pillBorder};
        color: ${pillText};
      }
      #agy-quota-titlebar-pill:hover {
        background: ${pillHoverBg};
        border-color: ${mainTheme.borderColor};
      }
      #agy-quota-popover {
        background: ${modalBg};
        border: 1px solid ${mainTheme.borderColor};
        box-shadow: 0 16px 40px rgba(0, 0, 0, ${isLight ? '0.20' : '0.72'});
        color: #f4f4f5;
      }
      @keyframes agyQuotaSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .agy-quota-spinning {
        animation: agyQuotaSpin 0.8s linear infinite;
      }
    `;

    syncTitleBarOverlay(st);
    scheduleTitleBarSync(st);
    if (typeof refreshQuotaWidgets === 'function') {
      refreshQuotaWidgets();
    }
  }

  function syncTitleBarOverlay(stOverride) {
    const st = stOverride || getState();
    const activeTh = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY] || {};
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      try {
        window.electronNative.setTitleBarOverlay({
          color: st.wpEnabled ? '#00000000' : '#111114',
          symbolColor: (st.wpEnabled && activeTh.isLight) ? '#0f172a' : '#f8fafc'
        });
      } catch (e) {}
    }
  }

  function clearTitleBarTimers() {
    if (Array.isArray(window.__AGY_TBO_TIMERS__)) {
      window.__AGY_TBO_TIMERS__.forEach(id => clearTimeout(id));
    }
    window.__AGY_TBO_TIMERS__ = [];
  }

  function scheduleTitleBarSync(stOverride) {
    clearTitleBarTimers();
    const st = stOverride || getState();
    syncTitleBarOverlay(st);
    [300, 900, 2000, 4000, 7000].forEach(ms => {
      window.__AGY_TBO_TIMERS__.push(setTimeout(() => syncTitleBarOverlay(), ms));
    });
  }

  function removeCustomTheme() {
    clearTitleBarTimers();
    if (window.__AGY_SAVE_TIMER__) { clearTimeout(window.__AGY_SAVE_TIMER__); window.__AGY_SAVE_TIMER__ = 0; }
    if (window.__AGY_BLUR_TIMER__) { clearTimeout(window.__AGY_BLUR_TIMER__); window.__AGY_BLUR_TIMER__ = 0; }
    if (window.__AGY_TICK_TIMER__) { clearTimeout(window.__AGY_TICK_TIMER__); window.__AGY_TICK_TIMER__ = 0; }
    if (window.__AGY_QUOTA_TIMER__) { clearInterval(window.__AGY_QUOTA_TIMER__); window.__AGY_QUOTA_TIMER__ = 0; }
    if (window.__AGY_BLUR_CACHE__ instanceof Map) {
      window.__AGY_BLUR_CACHE__.forEach((v) => {
        if (typeof v === 'string' && v.startsWith('blob:')) {
          try { URL.revokeObjectURL(v); } catch (e) {}
        }
      });
      window.__AGY_BLUR_CACHE__.clear();
    }
    if (window.__AGY_BLOB_CACHE__ instanceof Map) {
      window.__AGY_BLOB_CACHE__.forEach((v) => {
        if (typeof v === 'string' && v.startsWith('blob:')) {
          try { URL.revokeObjectURL(v); } catch (e) {}
        }
      });
      window.__AGY_BLOB_CACHE__.clear();
    }
    if (window.__AGY_SHELL_RO__) {
      try { window.__AGY_SHELL_RO__.disconnect(); } catch (e) {}
      window.__AGY_SHELL_RO__ = null;
    }
    if (window.__AGY_MODAL_OBSERVER__) {
      try { window.__AGY_MODAL_OBSERVER__.disconnect(); } catch (e) {}
      window.__AGY_MODAL_OBSERVER__ = null;
    }
    if (window.__AGY_SCROLL_AC__) {
      try { window.__AGY_SCROLL_AC__.abort(); } catch (e) {}
    }
    const styleEl = document.getElementById('antigravity-custom-theme-active');
    if (styleEl) styleEl.remove();
    const metricsEl = document.getElementById('antigravity-custom-theme-metrics');
    if (metricsEl) metricsEl.remove();
    window.__AGY_LAST_METRICS_CSS__ = '';
    window.__AGY_METRICS_STATE__ = { glassBg: '', beforeClip: '', holeClip: '' };
    const navBtn = document.getElementById('agy-custom-theme-sidebar-btn');
    if (navBtn) navBtn.remove();
    const settingsBtn = document.getElementById('agy-custom-theme-settings-btn');
    if (settingsBtn) settingsBtn.remove();
    const modal = document.getElementById('agy-custom-theme-modal-backdrop');
    if (modal) modal.remove();
    const quotaCard = document.getElementById('agy-quota-sidebar-card');
    if (quotaCard) quotaCard.remove();
    const quotaPill = document.getElementById('agy-quota-titlebar-pill');
    if (quotaPill) quotaPill.remove();
    const quotaPop = document.getElementById('agy-quota-popover');
    if (quotaPop) quotaPop.remove();
    const quotaHideStyle = document.getElementById('agy-quota-sync-hide-style');
    if (quotaHideStyle) quotaHideStyle.remove();
    const shell = document.querySelector('.agy-shell');
    if (shell) {
      if (shell.dataset.agyHoleActive) delete shell.dataset.agyHoleActive;
      if (shell.dataset.agySideGlass) delete shell.dataset.agySideGlass;
      ['--agy-hole-clip', '--agy-l-glass-bg', '--agy-sidebar-w', '--agy-hdr-h', '--agy-side-l', '--agy-side-t', '--agy-side-r', '--agy-side-b'].forEach((p) => shell.style.removeProperty(p));
    }
    if (window.electronNative && typeof window.electronNative.setTitleBarOverlay === 'function') {
      try {
        window.electronNative.setTitleBarOverlay({ color: '#111114', symbolColor: '#f8fafc' });
      } catch (e) {}
    }
  }

  window.__ANTIGRAVITY_APPLY_CUSTOM_THEME__ = applyTheme;
  window.__ANTIGRAVITY_REMOVE_CUSTOM_THEME__ = removeCustomTheme;
  window.__ANTIGRAVITY_OPEN_THEME_MODAL__ = openCustomThemeModal;

  applyTheme();

  function openCustomThemeModal() {
    let backdrop = document.getElementById('agy-custom-theme-modal-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'agy-custom-theme-modal-backdrop';
      backdrop.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px;
        background: rgba(0, 0, 0, 0.65);
        backdrop-filter: blur(10px);
      `;

      backdrop.innerHTML = `
        <div id="agy-custom-theme-modal-dialog" style="background: rgba(16, 12, 11, 0.97); border: 1.2px solid rgba(212, 148, 106, 0.35); border-radius: 18px; width: 100%; max-width: 900px; height: 86vh; max-height: 860px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.9), 0 0 32px rgba(224, 142, 85, 0.25); font-family: system-ui, -apple-system, sans-serif;">
          <div id="agy-custom-theme-modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 26px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(22, 16, 14, 0.85);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 17px; font-weight: 600; color: #f4f4f5; letter-spacing: -0.2px;">Custom Theme Studio</span>
              <span id="agy-custom-theme-badge" style="font-size: 11.5px; padding: 2.5px 9px; border-radius: 9999px; background: rgba(224, 142, 85, 0.2); color: #e08e55; font-weight: 500; border: 1px solid rgba(224, 142, 85, 0.3);">${THEME_KEYS.length} Preset${THEME_KEYS.length > 1 ? 's' : ''}</span>
            </div>
            <button id="agy-theme-modal-close-btn" type="button" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: #d4d4d8; cursor: pointer; width: 30px; height: 30px; border-radius: 8px; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.15s ease;">✕</button>
          </div>
          <div id="agy-theme-modal-body" style="flex: 1; overflow-y: auto; height: 100%;"></div>
        </div>
      `;

      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.style.display = 'none';
      });
      backdrop.querySelector('#agy-theme-modal-close-btn').addEventListener('click', () => {
        backdrop.style.display = 'none';
      });
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && backdrop.style.display !== 'none') {
          backdrop.style.display = 'none';
        }
      }, window.__AGY_SCROLL_AC__ ? { signal: window.__AGY_SCROLL_AC__.signal } : undefined);
    }

    backdrop.style.display = 'flex';
    const body = backdrop.querySelector('#agy-theme-modal-body');
    renderThemePanels(body);
  }

  function renderThemePanels(container) {
    const st = getState();
    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const effUserAv = st.userAvatar === 'none' ? '' : (st.userAvatar || mainTheme.userAvatar || '');
    const effAgentAv = st.agentAvatar === 'none' ? '' : (st.agentAvatar || mainTheme.agentAvatar || '');

    container.innerHTML = `
      <div id="agy-theme-scroll-container" style="padding: 24px 32px 48px 32px; max-width: 860px; margin: 0 auto; overflow-y: auto; height: 100%; color: #f4f4f5;">
        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mainTheme.cardBg || 'rgba(22, 16, 14, 0.72)'}; border-radius: 12px; padding: 16px 20px; margin-bottom: 14px; display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 14.5px; font-weight: 600; color: #f4f4f5; margin-bottom: 2px;">Wallpaper, Pre-Baked Blur & Config</div>
              <div style="font-size: 12.5px; color: #a1a1aa;">Balance artwork clarity, 120fps pre-baked frosted glass blur, or share config JSON.</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #d4d4d8; cursor: pointer;">
                <input id="agy-wp-toggle" type="checkbox" ${st.wpEnabled ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Backdrop
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #d4d4d8; cursor: pointer;">
                <input id="agy-quota-sb-toggle" type="checkbox" ${st.showQuotaSidebar ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Sidebar Quota
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #d4d4d8; cursor: pointer;">
                <input id="agy-quota-tb-toggle" type="checkbox" ${st.showQuotaTitlebar ? 'checked' : ''} style="accent-color: ${mainTheme.primary}; cursor: pointer;" />
                Titlebar Quota
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa;">
                Dim
                <input id="agy-dim-slider" type="range" min="15" max="92" value="${st.dimming}" style="width: 96px; cursor: pointer; accent-color: #ffffff; height: 5px;" />
                <span id="agy-dim-val" style="min-width: 32px; text-align: right;">${st.dimming}%</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa;">
                Blur
                <input id="agy-blur-slider" type="range" min="0" max="16" value="${st.glassBlur}" style="width: 78px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
                <span id="agy-blur-val" style="min-width: 30px; text-align: right;">${st.glassBlur}px</span>
              </label>
              <label style="padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Custom Image
                <input id="agy-wp-upload" type="file" accept="image/*" style="display: none;" />
              </label>
              <button id="agy-export-btn" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Export JSON
              </button>
              <button id="agy-import-toggle" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.16); color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Import JSON
              </button>
              <button id="agy-reset-btn" type="button" style="padding: 5px 10px; border-radius: 8px; background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                Reset
              </button>
            </div>
          </div>
          <div id="agy-import-box" style="display: none; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.08);">
            <textarea id="agy-import-text" rows="3" placeholder='Paste exported theme config JSON here (e.g. {"themeName":"WLOP Cosmic","dimming":45,...})' style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.35); color: #f4f4f5; border: 1px solid ${mainTheme.borderColor}; border-radius: 8px; padding: 8px 10px; font-family: monospace; font-size: 12px; resize: vertical;"></textarea>
            <div style="display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
              <span id="agy-import-msg" style="font-size: 12px; color: #fca5a5;"></span>
              <button id="agy-import-apply" type="button" style="padding: 5px 12px; border-radius: 7px; background: ${mainTheme.primary}; color: #090d16; font-weight: 600; font-size: 12px; border: none; cursor: pointer;">Apply JSON</button>
            </div>
          </div>
        </div>

        <div style="border: 1px solid ${mainTheme.borderColor}; background: ${mainTheme.cardBg || 'rgba(22, 16, 14, 0.72)'}; border-radius: 12px; padding: 14px 20px; margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #f4f4f5; margin-bottom: 2px;">Chat Avatars (User & AI Agent)</div>
              <div style="font-size: 12px; color: #a1a1aa;">Profile badges rendered beside chat messages (auto-compressed WebP).</div>
            </div>
            <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="agy-user-av-preview" style="width: 30px; height: 30px; border-radius: ${st.avatarRadius}%; border: 1.5px solid ${mainTheme.primary}; background: rgba(255,255,255,0.06) ${effUserAv ? `url('${effUserAv}') center/cover no-repeat` : ''}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #a1a1aa;">${effUserAv ? '' : 'U'}</div>
                <label style="padding: 4px 10px; border-radius: 7px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                  User
                  <input id="agy-user-av-upload" type="file" accept="image/*" style="display: none;" />
                </label>
                <button id="agy-user-av-clear" type="button" style="padding: 4px 8px; border-radius: 7px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.14); color: #a1a1aa; font-size: 11.5px; cursor: pointer;">Off</button>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div id="agy-agent-av-preview" style="width: 30px; height: 30px; border-radius: ${st.avatarRadius}%; border: 1.5px solid ${mainTheme.secondary || mainTheme.primary}; background: rgba(255,255,255,0.06) ${effAgentAv ? `url('${effAgentAv}') center/cover no-repeat` : ''}; display: flex; align-items: center; justify-content: center; font-size: 11px; color: #a1a1aa;">${effAgentAv ? '' : 'AI'}</div>
                <label style="padding: 4px 10px; border-radius: 7px; background: rgba(255, 255, 255, 0.08); border: 1px solid ${mainTheme.borderColor}; color: #f4f4f5; font-size: 12px; cursor: pointer; white-space: nowrap;">
                  Agent
                  <input id="agy-agent-av-upload" type="file" accept="image/*" style="display: none;" />
                </label>
                <button id="agy-agent-av-clear" type="button" style="padding: 4px 8px; border-radius: 7px; background: transparent; border: 1px solid rgba(255, 255, 255, 0.14); color: #a1a1aa; font-size: 11.5px; cursor: pointer;">Off</button>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.07);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a1a1aa;">
              Size
              <input id="agy-av-size" type="range" min="22" max="52" value="${st.avatarSize}" style="width: 100px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
              <span id="agy-av-size-val" style="min-width: 34px;">${st.avatarSize}px</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a1a1aa;">
              Corner Radius
              <input id="agy-av-rad" type="range" min="0" max="50" value="${st.avatarRadius}" style="width: 100px; cursor: pointer; accent-color: ${mainTheme.primary}; height: 5px;" />
              <span id="agy-av-rad-val" style="min-width: 34px;">${st.avatarRadius}%</span>
            </label>
          </div>
        </div>

        <div style="margin-bottom: 28px;">
          <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">User Chat Bubble</div>
          <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">Mix and match bubble frame & ornament independently from the active wallpaper.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${THEME_KEYS.map(name => {
              const th = THEMES[name];
              const isSelected = name === st.bubbleName;
              const stickerTop = th.isOrnament ? Math.round((th.stickerTop || 0) * 0.85) : Math.round((th.stickerTop || 0) * 0.74);
              const stickerW = Math.round((th.stickerW || 0) * 0.78);
              const stickerH = th.isOrnament ? Math.round((th.stickerH || 0) * 0.8) : Math.round((th.stickerH || 0) * 0.78);
              return `
                <div class="agy-bubble-card" data-name="${name}" style="position: relative; border-radius: 12px; border: ${isSelected ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: ${isSelected ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)'}; padding: 24px 18px 14px 18px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; min-height: 112px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div style="display: flex; justify-content: center; align-items: center; width: 100%; margin-top: 6px; margin-bottom: 10px;">
                    <div style="position: relative; width: 192px; height: 46px; padding: 1.2px; border-radius: ${th.isScroll ? '6px' : '12px'}; background: ${th.frameBg}; box-shadow: 0 4px 14px rgba(0,0,0,0.45), 0 0 10px ${th.glow};">
                      <div style="position: relative; width: 100%; height: 100%; background: ${th.bg}; border: ${th.innerBorder || '1px solid ' + th.borderColor}; border-radius: ${th.isScroll ? '4px' : '11px'}; display: flex; align-items: center; padding: 0 16px;">
                        ${th.sticker ? `<div style="position: absolute; top: ${stickerTop}px; right: 8px; width: ${stickerW}px; height: ${stickerH}px; background-image: url('${th.sticker}'); background-size: contain; background-position: ${th.isOrnament ? 'center' : 'bottom center'}; background-repeat: no-repeat; pointer-events: none;"></div>` : ''}
                        <span style="font-size: 13.5px; font-weight: 500; color: ${th.textColor};">Hello ✨</span>
                      </div>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13.5px; font-weight: 500; color: #e4e4e7;">${name}</span>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="margin-bottom: 28px;">
          <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">Composer Style</div>
          <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">Customize the chat input frame without affecting keyboard shortcuts or attachments.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${Object.entries(INPUT_STYLES).map(([key, item]) => {
              const isSelected = key === st.inputStyle;
              const activeBubbleTh = THEMES[st.bubbleName] || mainTheme;
              const previewStickerStyle = activeBubbleTh.isOrnament
                ? 'top: -12px; right: 10px; width: 72px; height: 22px; background-position: center;'
                : 'top: -22px; right: 10px; width: 32px; height: 28px; background-position: bottom center;';
              const previewInnerBg = key === 'glass'
                ? (activeBubbleTh.inputGlassBg || 'rgba(20, 15, 13, 0.45)')
                : (activeBubbleTh.inputCardBg || 'rgba(26, 18, 15, 0.92)');
              return `
                <div class="agy-input-card" data-style="${key}" style="border-radius: 12px; border: ${isSelected ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: ${isSelected ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)'}; padding: 16px 18px; cursor: pointer; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.15s ease, background-color 0.15s ease;">
                  <div class="agy-input-preview-outer" style="position: relative; margin-top: 8px; padding: 1.5px; border-radius: 10px; background: ${key === 'double_gold' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : activeBubbleTh.frameBg};">
                    <div class="agy-input-preview-sticker" style="position: absolute; ${previewStickerStyle} background-image: url('${activeBubbleTh.sticker || ''}'); background-size: contain; background-repeat: no-repeat; display: ${key !== 'minimal' && activeBubbleTh.sticker ? 'block' : 'none'}; pointer-events: none;"></div>
                    <div class="agy-input-preview-inner" style="background: ${previewInnerBg}; border-radius: 9px; padding: 8px 12px; font-size: 12px; color: #a1a1aa; display: flex; justify-content: space-between; align-items: center;">
                      <span>Ask anything, @ to mention...</span>
                      <span class="agy-input-preview-turbo" style="color: ${activeBubbleTh.primary}; font-size: 11px;">Send →</span>
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <div style="font-size: 13.5px; font-weight: 500; color: #e4e4e7;">${item.label}</div>
                      <div style="font-size: 11.5px; color: #a1a1aa;">${item.desc}</div>
                    </div>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <div style="font-size: 15px; font-weight: 600; color: #ffffff; margin-bottom: 4px;">Theme Presets (${THEME_KEYS.length})</div>
          <div style="font-size: 12.5px; color: #a1a1aa; margin-bottom: 14px;">Complete backdrop, palette, unified L-glass, and matching ornaments.</div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
            ${THEME_KEYS.map(name => {
              const th = THEMES[name];
              const isSelected = name === st.themeName;
              const thumbBg = th.wallpaper
                ? `linear-gradient(180deg, rgba(0,0,0,0.15), rgba(14,12,12,0.85)), url('${th.wallpaper}')`
                : (th.pureBg || th.bg);
              const thumbOrnamentStyle = th.isOrnament
                ? 'right: 10px; bottom: 8px; width: 76px; height: 24px; background-position: center;'
                : 'right: 12px; bottom: 4px; width: 42px; height: 38px; background-position: bottom center;';
              return `
                <div class="agy-preset-card" data-name="${name}" style="border-radius: 12px; border: ${isSelected ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)'}; background: rgba(14, 12, 12, 0.82); overflow: hidden; cursor: pointer; display: flex; flex-direction: column; transition: border-color 0.15s ease;">
                  <div style="height: 68px; width: 100%; background-image: ${thumbBg}; background-size: cover; background-position: ${th.bgPosition || 'center'}; position: relative; display: flex; align-items: flex-end; padding: 8px 14px;">
                    ${th.sticker ? `<div style="position: absolute; ${thumbOrnamentStyle} background-image: url('${th.sticker}'); background-size: contain; background-repeat: no-repeat; pointer-events: none;"></div>` : ''}
                    <span style="font-size: 13.5px; font-weight: 600; color: #fff;">${name}</span>
                  </div>
                  <div style="padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; color: #a1a1aa;">${th.concept || ''}</span>
                    <div class="agy-card-check-slot">${isSelected ? CHECK_SVG : ''}</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    function updateInputPreviews(bName) {
      const activeTh = THEMES[bName] || THEMES[DEFAULT_THEME_KEY];
      container.querySelectorAll('.agy-input-card').forEach(card => {
        const key = card.dataset.style;
        const outer = card.querySelector('.agy-input-preview-outer');
        if (outer) {
          outer.style.background = key === 'double_gold'
            ? 'linear-gradient(135deg, #f59e0b, #fbbf24)'
            : activeTh.frameBg;
        }
        const inner = card.querySelector('.agy-input-preview-inner');
        if (inner) {
          inner.style.background = key === 'glass'
            ? (activeTh.inputGlassBg || 'rgba(20, 15, 13, 0.45)')
            : (activeTh.inputCardBg || 'rgba(26, 18, 15, 0.92)');
        }
        const sticker = card.querySelector('.agy-input-preview-sticker');
        if (sticker) {
          if (key !== 'minimal' && activeTh.sticker) {
            sticker.style.display = 'block';
            sticker.style.backgroundImage = `url('${activeTh.sticker}')`;
            if (activeTh.isOrnament) {
              sticker.style.top = '-12px';
              sticker.style.width = '72px';
              sticker.style.height = '22px';
              sticker.style.backgroundPosition = 'center';
            } else {
              sticker.style.top = '-22px';
              sticker.style.width = '32px';
              sticker.style.height = '28px';
              sticker.style.backgroundPosition = 'bottom center';
            }
          } else {
            sticker.style.display = 'none';
          }
        }
        const turbo = card.querySelector('.agy-input-preview-turbo');
        if (turbo) {
          turbo.style.color = activeTh.primary;
        }
      });
    }

    const slider = container.querySelector('#agy-dim-slider');
    const valLabel = container.querySelector('#agy-dim-val');
    slider.addEventListener('input', (e) => {
      const v = parseInt(e.target.value, 10);
      valLabel.textContent = v + '%';
      applyTheme({ dimming: v }, { debounceSave: true });
    });

    const wpToggle = container.querySelector('#agy-wp-toggle');
    wpToggle.addEventListener('change', (e) => {
      applyTheme({ wpEnabled: e.target.checked });
    });

    const quotaSbToggle = container.querySelector('#agy-quota-sb-toggle');
    if (quotaSbToggle) {
      quotaSbToggle.addEventListener('change', (e) => {
        applyTheme({ showQuotaSidebar: e.target.checked });
      });
    }
    const quotaTbToggle = container.querySelector('#agy-quota-tb-toggle');
    if (quotaTbToggle) {
      quotaTbToggle.addEventListener('change', (e) => {
        applyTheme({ showQuotaTitlebar: e.target.checked });
      });
    }

    const wpUpload = container.querySelector('#agy-wp-upload');
    wpUpload.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      compressWallpaperFile(file, (dataUrl) => {
        applyTheme({ customWp: dataUrl, wpEnabled: true });
        const toggle = container.querySelector('#agy-wp-toggle');
        if (toggle) toggle.checked = true;
      });
    });

    const userAvUpload = container.querySelector('#agy-user-av-upload');
    const userAvPreview = container.querySelector('#agy-user-av-preview');
    const userAvClear = container.querySelector('#agy-user-av-clear');
    const agentAvUpload = container.querySelector('#agy-agent-av-upload');
    const agentAvPreview = container.querySelector('#agy-agent-av-preview');
    const agentAvClear = container.querySelector('#agy-agent-av-clear');

    function syncAvPreview(el, url, fallbackText) {
      if (!el) return;
      if (url) {
        el.style.backgroundImage = `url("${url}")`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
      } else {
        el.style.backgroundImage = 'none';
        el.textContent = fallbackText;
      }
    }

    if (userAvUpload) {
      userAvUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAvatarFile(file, (dataUrl) => {
          applyTheme({ userAvatar: dataUrl });
          syncAvPreview(userAvPreview, dataUrl, 'U');
        });
      });
    }
    if (userAvClear) {
      userAvClear.addEventListener('click', () => {
        applyTheme({ userAvatar: 'none' });
        syncAvPreview(userAvPreview, '', 'U');
      });
    }
    if (agentAvUpload) {
      agentAvUpload.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        compressAvatarFile(file, (dataUrl) => {
          applyTheme({ agentAvatar: dataUrl });
          syncAvPreview(agentAvPreview, dataUrl, 'AI');
        });
      });
    }
    if (agentAvClear) {
      agentAvClear.addEventListener('click', () => {
        applyTheme({ agentAvatar: 'none' });
        syncAvPreview(agentAvPreview, '', 'AI');
      });
    }

    const blurSlider = container.querySelector('#agy-blur-slider');
    const blurLabel = container.querySelector('#agy-blur-val');
    if (blurSlider) {
      blurSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (blurLabel) blurLabel.textContent = v + 'px';
        applyTheme({ glassBlur: v }, { debounceSave: true });
      });
    }

    const avSizeSlider = container.querySelector('#agy-av-size');
    const avSizeVal = container.querySelector('#agy-av-size-val');
    if (avSizeSlider) {
      avSizeSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (avSizeVal) avSizeVal.textContent = v + 'px';
        applyTheme({ avatarSize: v }, { debounceSave: true });
      });
    }

    const avRadSlider = container.querySelector('#agy-av-rad');
    const avRadVal = container.querySelector('#agy-av-rad-val');
    if (avRadSlider) {
      avRadSlider.addEventListener('input', (e) => {
        const v = parseInt(e.target.value, 10);
        if (avRadVal) avRadVal.textContent = v + '%';
        if (userAvPreview) userAvPreview.style.borderRadius = v + '%';
        if (agentAvPreview) agentAvPreview.style.borderRadius = v + '%';
        applyTheme({ avatarRadius: v }, { debounceSave: true });
      });
    }

    const exportBtn = container.querySelector('#agy-export-btn');
    const importToggle = container.querySelector('#agy-import-toggle');
    const importBox = container.querySelector('#agy-import-box');
    const importText = container.querySelector('#agy-import-text');
    const importApply = container.querySelector('#agy-import-apply');
    const importMsg = container.querySelector('#agy-import-msg');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = JSON.stringify(getState(), null, 2);
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(json).then(() => {
            exportBtn.textContent = 'Copied ✓';
            setTimeout(() => { exportBtn.textContent = 'Export JSON'; }, 1500);
          }).catch(() => {
            if (importBox && importText) {
              importBox.style.display = 'flex';
              importText.value = json;
              importText.select();
            }
          });
        } else if (importBox && importText) {
          importBox.style.display = 'flex';
          importText.value = json;
          importText.select();
        }
      });
    }
    if (importToggle && importBox) {
      importToggle.addEventListener('click', () => {
        importBox.style.display = importBox.style.display === 'none' ? 'flex' : 'none';
        if (importMsg) importMsg.textContent = '';
      });
    }
    if (importApply && importText) {
      importApply.addEventListener('click', () => {
        try {
          const parsed = JSON.parse(importText.value.trim());
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('Config must be a JSON object');
          }
          const allowed = {};
          const keys = ['themeName', 'bubbleName', 'inputStyle', 'dimming', 'wpEnabled', 'customWp', 'userAvatar', 'agentAvatar', 'glassBlur', 'avatarSize', 'avatarRadius', 'showQuotaSidebar', 'showQuotaTitlebar'];
          keys.forEach((k) => {
            if (parsed[k] !== undefined) allowed[k] = parsed[k];
          });
          applyTheme(allowed);
          renderThemePanels(container);
        } catch (err) {
          if (importMsg) importMsg.textContent = 'Invalid JSON: ' + err.message;
        }
      });
    }

    const resetBtn = container.querySelector('#agy-reset-btn');
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_CUSTOM_WP);
      localStorage.removeItem(STORAGE_USER_AVATAR);
      localStorage.removeItem(STORAGE_AGENT_AVATAR);
      localStorage.removeItem(STORAGE_GLASS_BLUR);
      localStorage.removeItem(STORAGE_AVATAR_SIZE);
      localStorage.removeItem(STORAGE_AVATAR_RADIUS);
      localStorage.removeItem(STORAGE_THEME);
      localStorage.removeItem(STORAGE_BUBBLE);
      localStorage.removeItem(STORAGE_INPUT);
      localStorage.removeItem(STORAGE_DIMMING);
      localStorage.removeItem(STORAGE_WP_ENABLED);
      localStorage.removeItem(STORAGE_QUOTA_SIDEBAR);
      localStorage.removeItem(STORAGE_QUOTA_TITLEBAR);
      applyTheme({
        themeName: DEFAULT_THEME_KEY,
        bubbleName: DEFAULT_THEME_KEY,
        inputStyle: 'sync',
        dimming: 69,
        wpEnabled: true,
        customWp: '',
        userAvatar: '',
        agentAvatar: '',
        glassBlur: 3,
        avatarSize: 32,
        avatarRadius: 50,
        showQuotaSidebar: true,
        showQuotaTitlebar: true
      });
      const defTh = THEMES[DEFAULT_THEME_KEY] || {};
      syncAvPreview(userAvPreview, defTh.userAvatar || '', 'U');
      syncAvPreview(agentAvPreview, defTh.agentAvatar || '', 'AI');
      if (userAvPreview) userAvPreview.style.borderRadius = '50%';
      if (agentAvPreview) agentAvPreview.style.borderRadius = '50%';
      if (slider) slider.value = 69;
      if (valLabel) valLabel.textContent = '69%';
      if (blurSlider) blurSlider.value = 3;
      if (blurLabel) blurLabel.textContent = '3px';
      if (avSizeSlider) avSizeSlider.value = 32;
      if (avSizeVal) avSizeVal.textContent = '32px';
      if (avRadSlider) avRadSlider.value = 50;
      if (avRadVal) avRadVal.textContent = '50%';
      if (wpToggle) wpToggle.checked = true;
      if (quotaSbToggle) quotaSbToggle.checked = true;
      if (quotaTbToggle) quotaTbToggle.checked = true;

      container.querySelectorAll('.agy-preset-card').forEach(c => {
        const isSel = c.dataset.name === DEFAULT_THEME_KEY;
        c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        const slot = c.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
      container.querySelectorAll('.agy-bubble-card').forEach(b => {
        const isSel = b.dataset.name === DEFAULT_THEME_KEY;
        b.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        b.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
        const slot = b.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
      container.querySelectorAll('.agy-input-card').forEach(c => {
        const isSel = c.dataset.style === 'sync';
        c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
        c.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
        const slot = c.querySelector('.agy-card-check-slot');
        if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
      });
      updateInputPreviews(DEFAULT_THEME_KEY);
    });

    container.querySelectorAll('.agy-preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        applyTheme({ themeName: name, bubbleName: name, customWp: '' });

        container.querySelectorAll('.agy-preset-card').forEach(c => {
          const isSel = c.dataset.name === name;
          c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          const slot = c.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        container.querySelectorAll('.agy-bubble-card').forEach(b => {
          const isSel = b.dataset.name === name;
          b.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          b.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
          const slot = b.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        updateInputPreviews(name);
      });
    });

    container.querySelectorAll('.agy-bubble-card').forEach(card => {
      card.addEventListener('click', () => {
        const name = card.dataset.name;
        applyTheme({ bubbleName: name });

        container.querySelectorAll('.agy-bubble-card').forEach(b => {
          const isSel = b.dataset.name === name;
          b.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          b.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
          const slot = b.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });

        updateInputPreviews(name);
      });
    });

    container.querySelectorAll('.agy-input-card').forEach(card => {
      card.addEventListener('click', () => {
        const styleKey = card.dataset.style;
        applyTheme({ inputStyle: styleKey });

        container.querySelectorAll('.agy-input-card').forEach(c => {
          const isSel = c.dataset.style === styleKey;
          c.style.border = isSel ? '1.5px solid #f4f4f5' : '1px solid rgba(255, 255, 255, 0.12)';
          c.style.background = isSel ? 'rgba(42, 34, 30, 0.68)' : 'rgba(14, 12, 12, 0.78)';
          const slot = c.querySelector('.agy-card-check-slot');
          if (slot) slot.innerHTML = isSel ? CHECK_SVG : '';
        });
      });
    });
  }

  function injectMainSidebarButton() {
    if (document.getElementById('agy-custom-theme-sidebar-btn')) return;

    const sidebars = Array.from(
      document.querySelectorAll('[data-testid="sidebar-split"] > :first-child, aside, [data-sidebar="true"], .bg-sidebar')
    );
    let customSpan = null;
    for (const sb of sidebars) {
      const spans = Array.from(sb.querySelectorAll('span'));
      customSpan = spans.find(s => s.textContent?.trim() === 'Customizations');
      if (customSpan) break;
    }
    if (!customSpan) return;

    const row = customSpan.closest('a, button, div[role="button"], .group\\/headerbtn') || customSpan.parentElement;
    if (!row || !row.parentNode) return;

    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-sidebar-btn';
    btn.type = 'button';
    btn.className = 'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer select-none';
    btn.style.cssText = 'text-align: left;';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Custom theme</span>
    `;

    row.parentNode.insertBefore(btn, row.nextSibling);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
  }

  function injectSettingsModalButton() {
    const modal = document.querySelector('.settings-modal-container');
    if (!modal || document.getElementById('agy-custom-theme-settings-btn')) return;

    const headers = Array.from(modal.querySelectorAll('h2, h3'));
    const appearanceHeader = headers.find(h => h.textContent?.trim() === 'Appearance');
    if (!appearanceHeader) return;

    let targetContainer = appearanceHeader.parentElement;
    while (targetContainer && !targetContainer.className.includes('justify-between') && targetContainer !== modal) {
      targetContainer = targetContainer.parentElement;
    }

    if (!targetContainer || !targetContainer.parentNode) return;

    Array.from(targetContainer.parentNode.children).forEach(child => {
      if (child.id === 'agy-custom-theme-settings-btn') child.remove();
    });

    const btn = document.createElement('button');
    btn.id = 'agy-custom-theme-settings-btn';
    btn.type = 'button';
    btn.className = 'select-none rounded px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer text-white';
    btn.style.cssText = 'background: linear-gradient(135deg, #e08e55 0%, #b45309 100%); border: 1px solid rgba(251, 191, 36, 0.4); box-shadow: 0 2px 10px rgba(224, 142, 85, 0.3); margin-top: 8px; margin-bottom: 8px; display: inline-flex; align-items: center; gap: 6px;';
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <span>Open Custom Theme Studio</span>
    `;

    targetContainer.parentNode.insertBefore(btn, targetContainer.nextSibling);

    btn.addEventListener('click', () => {
      window.__ANTIGRAVITY_OPEN_THEME_MODAL__();
    });
  }

  function hookSidebarScroll() {
    if (!window.__AGY_SCROLL_AC__) return;
    const scrollers = document.querySelectorAll('.agy-shell .bg-sidebar .overflow-y-auto');
    scrollers.forEach(sc => {
      if (sc.dataset.agyScrollBound) return;
      sc.dataset.agyScrollBound = '1';
      const sync = () => sc.classList.toggle('agy-scrolled', sc.scrollTop > 2);
      sync();
      sc.addEventListener('scroll', sync, { passive: true, signal: window.__AGY_SCROLL_AC__.signal });
    });
  }

  function syncShellMetrics() {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    const ms = window.__AGY_METRICS_STATE__ || (window.__AGY_METRICS_STATE__ = {
      glassBg: '',
      beforeClip: '',
      holeClip: ''
    });

    const split = shell.querySelector('[data-testid="sidebar-split"]');
    const sidebarPane = split ? split.firstElementChild : null;
    const titleBar = shell.querySelector('[class*="@container/titlebar"]');
    const sw = sidebarPane ? Math.round(sidebarPane.getBoundingClientRect().width) : 0;
    const shellRect = shell.getBoundingClientRect();
    const hdrBottom = titleBar ? Math.round(titleBar.getBoundingClientRect().bottom - shellRect.top) : 35;

    const baseLClip = `polygon(0 0, 100% 0, 100% ${hdrBottom}px, ${sw}px ${hdrBottom}px, ${sw}px 100%, 0 100%)`;

    const hasHoleAttr = document.body.getAttribute('data-has-browser-hole') === 'true';
    const holeEl = hasHoleAttr ? shell.querySelector('[data-browser-hole]:not([data-browser-hole="false"])') : null;
    if (holeEl) {
      if (window.__AGY_SHELL_RO__ && window.__AGY_HOLE_EL__ !== holeEl) {
        try { window.__AGY_SHELL_RO__.observe(holeEl); } catch (e) {}
        window.__AGY_HOLE_EL__ = holeEl;
      }
      const hRect = holeEl.getBoundingClientRect();
      if (hRect.width > 1 && hRect.height > 1) {
        const l = Math.max(0, Math.round(hRect.left - shellRect.left));
        const t = Math.max(0, Math.round(hRect.top - shellRect.top));
        const r = Math.max(l, Math.round(hRect.right - shellRect.left));
        const b = Math.max(t, Math.round(hRect.bottom - shellRect.top));
        ms.beforeClip = baseLClip;
        ms.holeClip = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${l}px ${t}px, ${r}px ${t}px, ${r}px ${b}px, ${l}px ${b}px, ${l}px ${t}px)`;
        if (shell.dataset.agyHoleActive !== '1') {
          shell.dataset.agyHoleActive = '1';
        }
        flushMetricsStyle();
        return;
      }
    }
    window.__AGY_HOLE_EL__ = null;
    if (shell.dataset.agyHoleActive) {
      delete shell.dataset.agyHoleActive;
    }
    ms.holeClip = '';

    const sideBody = shell.querySelector('[data-side-panel-body="true"]');
    if (sideBody) {
      if (window.__AGY_SHELL_RO__ && window.__AGY_SIDE_EL__ !== sideBody) {
        try { window.__AGY_SHELL_RO__.observe(sideBody); } catch (e) {}
        window.__AGY_SIDE_EL__ = sideBody;
      }
      const sRect = sideBody.getBoundingClientRect();
      const hasContent = sideBody.children.length > 0;
      if (hasContent && sRect.width > 24 && sRect.height > 24 && sRect.left < shellRect.right - 8 && sRect.right > shellRect.left + 8) {
        const sl = Math.max(sw, Math.round(sRect.left - shellRect.left));
        const st = Math.max(hdrBottom, Math.round(sRect.top - shellRect.top));
        const sr = Math.min(Math.round(shellRect.width), Math.max(sl, Math.round(sRect.right - shellRect.left)));
        const sb = Math.min(Math.round(shellRect.height), Math.max(st, Math.round(sRect.bottom - shellRect.top)));
        if (sr - sl > 20 && sb - st > 20) {
          ms.beforeClip = `polygon(evenodd, 0 0, 100% 0, 100% ${hdrBottom}px, ${sw}px ${hdrBottom}px, ${sw}px 100%, 0 100%, 0 0, ${sl}px ${st}px, ${sr}px ${st}px, ${sr}px ${sb}px, ${sl}px ${sb}px, ${sl}px ${st}px)`;
          flushMetricsStyle();
          return;
        }
      }
    } else {
      window.__AGY_SIDE_EL__ = null;
    }
    ms.beforeClip = baseLClip;
    flushMetricsStyle();
  }

  function scheduleMetricsSync() {
    if (window.__AGY_METRICS_RAF__) return;
    window.__AGY_METRICS_RAF__ = requestAnimationFrame(() => {
      window.__AGY_METRICS_RAF__ = 0;
      syncShellMetrics();
    });
  }

  function hookShellMetrics(forceSync = false) {
    const shell = document.querySelector('.agy-shell');
    if (!shell) return;
    let needsSync = forceSync;
    if (!shell.dataset.agyTboMounted) {
      shell.dataset.agyTboMounted = '1';
      // Strip any legacy inline CSS vars left by older versions so .agy-shell never inherits bloat.
      if (shell.dataset.agySideGlass) delete shell.dataset.agySideGlass;
      ['--agy-hole-clip', '--agy-l-glass-bg', '--agy-sidebar-w', '--agy-hdr-h', '--agy-side-l', '--agy-side-t', '--agy-side-r', '--agy-side-b'].forEach((p) => {
        if (shell.style.getPropertyValue(p)) shell.style.removeProperty(p);
      });
      flushMetricsStyle();
      scheduleTitleBarSync();
      needsSync = true;
    }
    if (!window.__AGY_SHELL_RO__ && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(scheduleMetricsSync);
      ro.observe(shell);
      const sidebarPane = shell.querySelector('[data-testid="sidebar-split"]')?.firstElementChild;
      if (sidebarPane) ro.observe(sidebarPane);
      window.__AGY_SHELL_RO__ = ro;
      needsSync = true;
    }
    if (!needsSync) {
      const hasHoleAttr = document.body.getAttribute('data-has-browser-hole') === 'true';
      const holeEl = hasHoleAttr ? shell.querySelector('[data-browser-hole]:not([data-browser-hole="false"])') : null;
      const sideBody = shell.querySelector('[data-side-panel-body="true"]');
      const sideHasContent = Boolean(sideBody && sideBody.children.length > 0);
      if (
        holeEl !== window.__AGY_HOLE_EL__ ||
        sideBody !== window.__AGY_SIDE_EL__ ||
        sideHasContent !== Boolean(window.__AGY_SIDE_HAS_CONTENT__)
      ) {
        window.__AGY_SIDE_HAS_CONTENT__ = sideHasContent;
        needsSync = true;
      }
    }
    if (needsSync) {
      syncShellMetrics();
    }
  }

  // ============================================================================
  // Quota HUD (Pure UI/DOM — mirrors Antigravity's Settings -> Models & Usage)
  // Zero undocumented API probing, zero token reading, zero live blur.
  // ============================================================================

  function readQuotaCache() {
    try {
      const raw = localStorage.getItem(STORAGE_QUOTA_CACHE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.groups) && parsed.groups.length > 0) {
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function saveQuotaCache(data) {
    try {
      localStorage.setItem(STORAGE_QUOTA_CACHE, JSON.stringify(data));
    } catch (e) {}
  }

  function parseDurationMs(str) {
    if (!str) return null;
    const s = String(str).toLowerCase();
    if (/less than\s+1\s+min|<\s*1\s*min/i.test(s)) return 30 * 1000;
    let totalMs = 0;
    let matched = false;
    const patterns = [
      [/(\d+)\s*d(?:ays?)?/g, 86400000],
      [/(\d+)\s*h(?:ours?|rs?)?/g, 3600000],
      [/(\d+)\s*m(?:in(?:ute)?s?)?/g, 60000],
      [/(\d+)\s*s(?:ec(?:ond)?s?)?/g, 1000]
    ];
    for (const [re, mult] of patterns) {
      let m;
      while ((m = re.exec(s)) !== null) {
        totalMs += parseInt(m[1], 10) * mult;
        matched = true;
      }
    }
    return matched && totalMs > 0 ? totalMs : null;
  }

  function formatCountdown(refreshAt) {
    if (!refreshAt) return '';
    const diff = refreshAt - Date.now();
    if (diff <= 0) return 'Reset!';
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remM = mins % 60;
    if (hrs < 24) return remM > 0 ? `${hrs}h ${String(remM).padStart(2, '0')}m` : `${hrs}h`;
    const days = Math.floor(hrs / 24);
    const remH = hrs % 24;
    return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
  }

  function formatAge(syncedAt) {
    if (!syncedAt) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - syncedAt) / 1000));
    if (diffSec < 45) return 'vừa xong';
    const m = Math.floor(diffSec / 60);
    if (m < 60) return `${m}p trước`;
    const h = Math.floor(m / 60);
    return `${h}h trước`;
  }

  function shortGroupMeta(fullLabel) {
    const clean = String(fullLabel || '').trim();
    if (/gemini/i.test(clean)) return { label: 'Gemini', tag: 'G' };
    if (/claude|gpt/i.test(clean)) return { label: 'Claude/GPT', tag: 'C' };
    const stripped = clean.replace(/\s*models?\s*$/i, '').trim() || clean;
    return { label: stripped.slice(0, 14), tag: (stripped[0] || 'M').toUpperCase() };
  }

  function shortPlanBadge(plan) {
    if (!plan) return '';
    if (/ultra/i.test(plan)) return 'Ultra';
    if (/pro/i.test(plan)) return 'Pro';
    if (/free/i.test(plan)) return 'Free';
    return plan.split(/\s+/).slice(-1)[0].slice(0, 8);
  }

  function quotaColor(pct, isLight) {
    if (pct >= 60) return isLight ? '#059669' : '#34d399';
    if (pct >= 25) return isLight ? '#d97706' : '#fbbf24';
    return isLight ? '#e11d48' : '#fb7185';
  }

  function parseQuotaFromModalText(rawText) {
    if (!rawText || !/(Weekly|Five Hour)\s+Limit\s+Remaining/i.test(rawText)) return null;
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let plan = '';
    for (const l of lines) {
      const pm = l.match(/^Your plan:\s*(.+)$/i);
      if (pm) {
        plan = pm[1].trim();
        break;
      }
    }

    const groups = [];
    let currentGroup = null;
    const now = Date.now();

    function isLikelyHeading(line) {
      if (!line || line.length > 44) return false;
      if (/^(\d{1,3}|<\s*1)\s*%$/.test(line)) return false;
      if (/^(Weekly|Five Hour)\s+Limit/i.test(line)) return false;
      if (/^You have\b|^When toggled|^Manage your|^Your plan|^Enable AI|^Choose the|^Plans the|^Carries out/i.test(line)) return false;
      if (/^(High|Medium|Low|XHigh|Models|Settings|Plan|Model Credits|Orchestrator Settings)$/i.test(line)) return false;
      return /model/i.test(line);
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isLikelyHeading(line)) {
        const meta = shortGroupMeta(line);
        currentGroup = {
          fullLabel: line,
          label: meta.label,
          tag: meta.tag,
          weekly: null,
          fiveHour: null
        };
        groups.push(currentGroup);
        continue;
      }

      const isWeekly = /^Weekly Limit Remaining$/i.test(line);
      const isFiveHour = /^Five Hour Limit Remaining$/i.test(line);
      if (!isWeekly && !isFiveHour) continue;

      if (!currentGroup) {
        const prev = i > 0 ? lines[i - 1] : 'Models';
        const meta = shortGroupMeta(prev);
        currentGroup = { fullLabel: prev, label: meta.label, tag: meta.tag, weekly: null, fiveHour: null };
        groups.push(currentGroup);
      }

      let pct = null;
      let refreshAt = null;
      let rawRefresh = '';

      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const next = lines[j];
        if (isLikelyHeading(next) || /^(Weekly|Five Hour)\s+Limit\s+Remaining$/i.test(next)) break;
        const pctMatch = next.match(/^(?:<\s*)?(\d{1,3})\s*%$/);
        if (pctMatch) {
          pct = next.startsWith('<') ? 0 : Math.min(100, Math.max(0, parseInt(pctMatch[1], 10)));
          continue;
        }
        const refMatch = next.match(/(?:refresh|resets?)\s+in\s+([^.\n]+)/i);
        if (refMatch) {
          rawRefresh = refMatch[1].trim();
          const durMs = parseDurationMs(rawRefresh);
          if (durMs) refreshAt = now + durMs;
        }
      }

      if (pct !== null) {
        const entry = { pct, refreshAt, rawRefresh };
        if (isWeekly) currentGroup.weekly = entry;
        else currentGroup.fiveHour = entry;
      }
    }

    const validGroups = groups.filter(g => g.weekly || g.fiveHour);
    if (validGroups.length === 0) return null;
    return { syncedAt: now, plan, groups: validGroups };
  }

  function findSidebarSettingsButton() {
    const sidebar = document.querySelector('[data-testid="sidebar-split"] > :first-child');
    if (!sidebar) return null;
    return Array.from(sidebar.querySelectorAll('button, a')).find(
      el => (el.innerText || '').trim() === 'Settings'
    ) || null;
  }

  function tryPassiveCaptureQuotaFromModal() {
    if (window.__AGY_QUOTA_SYNCING__) return;
    const modal = document.querySelector('.settings-modal-container');
    if (!modal) return;
    const now = Date.now();
    if (now - (window.__AGY_QUOTA_LAST_PASSIVE__ || 0) < 1800) return;
    const text = modal.innerText || '';
    if (!/Models\s*&\s*Usage/i.test(text)) return;
    const parsed = parseQuotaFromModalText(text);
    if (parsed) {
      window.__AGY_QUOTA_LAST_PASSIVE__ = now;
      saveQuotaCache(parsed);
      refreshQuotaWidgets();
    }
  }

  async function syncQuotaFromSettingsUI(openVisibleOnly = false) {
    if (window.__AGY_QUOTA_SYNCING__) return;
    const settingsBtn = findSidebarSettingsButton();
    if (!settingsBtn) return;

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__AGY_QUOTA_SYNCING__ = true;
    refreshQuotaWidgets();

    const wasAlreadyOpen = Boolean(document.querySelector('.settings-modal-container'));
    let hideStyle = null;
    let hiddenWrapper = null;
    let prevWrapperOpacity = '';
    let prevWrapperPe = '';

    try {
      if (!openVisibleOnly && !wasAlreadyOpen) {
        hideStyle = document.createElement('style');
        hideStyle.id = 'agy-quota-sync-hide-style';
        hideStyle.textContent = `.settings-modal-container { opacity: 0 !important; pointer-events: none !important; transition: none !important; }`;
        document.head.appendChild(hideStyle);
      }

      if (!wasAlreadyOpen) {
        settingsBtn.click();
      }

      let modal = null;
      for (let i = 0; i < 25; i++) {
        modal = document.querySelector('.settings-modal-container');
        if (modal) break;
        await sleep(50);
      }
      if (!modal) return;

      if (!openVisibleOnly && !wasAlreadyOpen && modal.parentElement && modal.parentElement !== document.body) {
        hiddenWrapper = modal.parentElement;
        prevWrapperOpacity = hiddenWrapper.style.opacity;
        prevWrapperPe = hiddenWrapper.style.pointerEvents;
        hiddenWrapper.style.opacity = '0';
        hiddenWrapper.style.pointerEvents = 'none';
      }

      const modelsTab = Array.from(modal.querySelectorAll('button, [role="tab"], a'))
        .find(b => /^Models$/i.test((b.innerText || '').trim()));
      if (modelsTab) {
        modelsTab.click();
      }

      if (openVisibleOnly) {
        return;
      }

      let captured = null;
      for (let i = 0; i < 32; i++) {
        await sleep(75);
        const curModal = document.querySelector('.settings-modal-container');
        if (!curModal) break;
        captured = parseQuotaFromModalText(curModal.innerText || '');
        if (captured) break;
      }

      if (captured) {
        saveQuotaCache(captured);
      }

      if (!wasAlreadyOpen) {
        const curModal = document.querySelector('.settings-modal-container');
        if (curModal) {
          const closeBtn = Array.from(curModal.querySelectorAll('button')).find(
            b => /^close$/i.test((b.getAttribute('aria-label') || '').trim())
          );
          if (closeBtn) closeBtn.click();
          for (let w = 0; w < 12; w++) {
            await sleep(50);
            if (!document.querySelector('.settings-modal-container')) break;
            if (w === 3) {
              const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true });
              document.dispatchEvent(esc);
              window.dispatchEvent(esc);
            }
          }
        }
      }
    } catch (e) {
    } finally {
      if (hiddenWrapper) {
        hiddenWrapper.style.opacity = prevWrapperOpacity;
        hiddenWrapper.style.pointerEvents = prevWrapperPe;
      }
      if (hideStyle) hideStyle.remove();
      window.__AGY_QUOTA_SYNCING__ = false;
      refreshQuotaWidgets();
    }
  }

  function getGroupSummary(g) {
    const wPct = g.weekly ? g.weekly.pct : null;
    const hPct = g.fiveHour ? g.fiveHour.pct : null;
    let minPct = 100;
    if (wPct !== null && hPct !== null) minPct = Math.min(wPct, hPct);
    else if (hPct !== null) minPct = hPct;
    else if (wPct !== null) minPct = wPct;

    // Show the soonest active reset timer (5h preferred if <100% or active, else weekly).
    let timer = '';
    if (g.fiveHour && g.fiveHour.refreshAt) timer = formatCountdown(g.fiveHour.refreshAt);
    else if (g.weekly && g.weekly.refreshAt) timer = formatCountdown(g.weekly.refreshAt);
    return { minPct, wPct, hPct, timer };
  }

  function renderQuotaPopover(anchorEl) {
    let pop = document.getElementById('agy-quota-popover');
    if (pop && pop.style.display !== 'none') {
      pop.style.display = 'none';
      return;
    }
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'agy-quota-popover';
      pop.style.cssText = 'position: fixed; z-index: 99998; width: 296px; border-radius: 13px; padding: 12px 14px; font-family: system-ui, -apple-system, sans-serif; color: #f4f4f5;';
      document.body.appendChild(pop);

      const onDocClick = (ev) => {
        const pill = document.getElementById('agy-quota-titlebar-pill');
        if (pop.style.display === 'none') return;
        if (pop.contains(ev.target) || (pill && pill.contains(ev.target))) return;
        pop.style.display = 'none';
      };
      const onKey = (ev) => {
        if (ev.key === 'Escape' && pop.style.display !== 'none') pop.style.display = 'none';
      };
      document.addEventListener('mousedown', onDocClick, window.__AGY_SCROLL_AC__ ? { signal: window.__AGY_SCROLL_AC__.signal } : undefined);
      window.addEventListener('keydown', onKey, window.__AGY_SCROLL_AC__ ? { signal: window.__AGY_SCROLL_AC__.signal } : undefined);
    }

    updateQuotaPopoverContent(pop);
    pop.style.display = 'block';
    const rect = anchorEl.getBoundingClientRect();
    const top = Math.min(window.innerHeight - 260, Math.round(rect.bottom + 6));
    const left = Math.max(12, Math.min(window.innerWidth - 308, Math.round(rect.right - 296)));
    pop.style.top = top + 'px';
    pop.style.left = left + 'px';
  }

  function updateQuotaPopoverContent(pop) {
    if (!pop) return;
    const st = getState();
    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const cache = readQuotaCache();
    const syncing = Boolean(window.__AGY_QUOTA_SYNCING__);
    const badge = cache && cache.plan ? shortPlanBadge(cache.plan) : '';

    const rowsHtml = cache ? cache.groups.map((g) => {
      const bars = [];
      if (g.fiveHour) {
        const c = quotaColor(g.fiveHour.pct, false);
        const cd = formatCountdown(g.fiveHour.refreshAt);
        bars.push(`
          <div style="margin-top: 6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:3px;">
              <span style="color:#a1a1aa;">5-Hour Limit</span>
              <span style="display:flex;align-items:center;gap:6px;">
                ${cd ? `<span style="color:#94a3b8;font-size:10.5px;">↻ ${cd}</span>` : ''}
                <strong style="color:${c};font-weight:600;">${g.fiveHour.pct}%</strong>
              </span>
            </div>
            <div style="height:5px;border-radius:999px;background:rgba(255,255,255,0.09);overflow:hidden;">
              <div style="height:100%;width:${g.fiveHour.pct}%;background:${c};border-radius:999px;"></div>
            </div>
          </div>
        `);
      }
      if (g.weekly) {
        const c = quotaColor(g.weekly.pct, false);
        const cd = formatCountdown(g.weekly.refreshAt);
        bars.push(`
          <div style="margin-top: 6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-bottom:3px;">
              <span style="color:#a1a1aa;">Weekly Limit</span>
              <span style="display:flex;align-items:center;gap:6px;">
                ${cd ? `<span style="color:#94a3b8;font-size:10.5px;">↻ ${cd}</span>` : ''}
                <strong style="color:${c};font-weight:600;">${g.weekly.pct}%</strong>
              </span>
            </div>
            <div style="height:5px;border-radius:999px;background:rgba(255,255,255,0.09);overflow:hidden;">
              <div style="height:100%;width:${g.weekly.pct}%;background:${c};border-radius:999px;"></div>
            </div>
          </div>
        `);
      }
      return `
        <div style="padding:8px 10px;border-radius:9px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);margin-top:8px;">
          <div style="font-size:12px;font-weight:600;color:#f4f4f5;">${g.fullLabel}</div>
          ${bars.join('')}
        </div>
      `;
    }).join('') : `
      <div style="padding:14px 8px;text-align:center;font-size:12px;color:#a1a1aa;">
        Chưa có dữ liệu quota.<br/>Bấm <strong>Sync ngay</strong> để lấy từ Settings → Models.
      </div>
    `;

    pop.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:${mainTheme.primary};display:inline-flex;">${BOLT_ICON_SVG}</span>
          <span style="font-size:13px;font-weight:600;color:#f4f4f5;">Model Quota</span>
          ${badge ? `<span style="font-size:10px;padding:1px 6px;border-radius:999px;background:${mainTheme.glow};color:${mainTheme.primary};border:1px solid ${mainTheme.borderColor};font-weight:600;">${badge}</span>` : ''}
        </div>
        <span style="font-size:10.5px;color:#71717a;">${cache ? formatAge(cache.syncedAt) : ''}</span>
      </div>
      ${rowsHtml}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.08);">
        <button id="agy-quota-pop-sync" type="button" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;padding:5px 10px;border-radius:8px;background:${mainTheme.glow};border:1px solid ${mainTheme.borderColor};color:${mainTheme.primary};font-size:11.5px;font-weight:600;cursor:pointer;">
          <span class="${syncing ? 'agy-quota-spinning' : ''}" style="display:inline-flex;">${REFRESH_ICON_SVG}</span>
          <span>${syncing ? 'Đang đồng bộ...' : 'Sync ngay'}</span>
        </button>
        <button id="agy-quota-pop-open" type="button" style="padding:5px 10px;border-radius:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#d4d4d8;font-size:11.5px;cursor:pointer;">
          Models ↗
        </button>
      </div>
    `;

    const syncBtn = pop.querySelector('#agy-quota-pop-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncQuotaFromSettingsUI(false);
      });
    }
    const openBtn = pop.querySelector('#agy-quota-pop-open');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pop.style.display = 'none';
        syncQuotaFromSettingsUI(true);
      });
    }
  }

  function injectOrUpdateSidebarQuotaCard() {
    const st = getState();
    const existing = document.getElementById('agy-quota-sidebar-card');
    if (!st.showQuotaSidebar) {
      if (existing) existing.remove();
      return;
    }

    const settingsBtn = findSidebarSettingsButton();
    if (!settingsBtn || !settingsBtn.parentElement) return;

    let card = existing;
    if (!card || card.parentElement !== settingsBtn.parentElement) {
      if (card) card.remove();
      card = document.createElement('div');
      card.id = 'agy-quota-sidebar-card';
      card.style.cssText = 'border-radius: 10px; padding: 7px 9px; margin-bottom: 5px; font-family: system-ui, -apple-system, sans-serif; user-select: none;';
      settingsBtn.parentElement.insertBefore(card, settingsBtn);
    }

    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const isLight = Boolean(mainTheme.isLight);
    const mutedCol = isLight ? '#475569' : '#94a3b8';
    const trackBg = isLight ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.09)';
    const cache = readQuotaCache();
    const syncing = Boolean(window.__AGY_QUOTA_SYNCING__);
    const expanded = localStorage.getItem(STORAGE_QUOTA_EXPANDED) === 'true';
    const badge = cache && cache.plan ? shortPlanBadge(cache.plan) : '';
    const renderKey = `${st.themeName}|${isLight}|${syncing}|${expanded}|${cache ? cache.syncedAt : 0}|${Math.floor(Date.now() / 30000)}`;
    if (card.dataset.agyRenderKey === renderKey) return;
    card.dataset.agyRenderKey = renderKey;

    let bodyHtml = '';
    if (!cache) {
      bodyHtml = `
        <button id="agy-quota-sb-init" type="button" style="width:100%;margin-top:6px;padding:5px 8px;border-radius:7px;background:${mainTheme.glow};border:1px solid ${mainTheme.borderColor};color:${mainTheme.primary};font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;">
          <span class="${syncing ? 'agy-quota-spinning' : ''}" style="display:inline-flex;">${REFRESH_ICON_SVG}</span>
          <span>${syncing ? 'Đang lấy quota...' : 'Bấm để sync Quota'}</span>
        </button>
      `;
    } else {
      bodyHtml = cache.groups.map((g) => {
        const s = getGroupSummary(g);
        const col = quotaColor(s.minPct, isLight);
        const tip = [
          g.fiveHour ? `5h: ${g.fiveHour.pct}%${g.fiveHour.refreshAt ? ' (reset ' + formatCountdown(g.fiveHour.refreshAt) + ')' : ''}` : '',
          g.weekly ? `Weekly: ${g.weekly.pct}%${g.weekly.refreshAt ? ' (reset ' + formatCountdown(g.weekly.refreshAt) + ')' : ''}` : ''
        ].filter(Boolean).join(' • ');

        if (!expanded) {
          return `
            <div title="${tip}" style="margin-top:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;line-height:1.25;margin-bottom:3px;">
                <span style="font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${g.label}</span>
                <span style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                  ${s.timer ? `<span style="font-size:10px;color:${mutedCol};">${s.timer}</span>` : ''}
                  <strong style="color:${col};font-weight:650;">${s.minPct}%</strong>
                </span>
              </div>
              <div style="height:4px;border-radius:999px;background:${trackBg};overflow:hidden;">
                <div style="height:100%;width:${s.minPct}%;background:${col};border-radius:999px;"></div>
              </div>
            </div>
          `;
        }

        const subBars = [];
        if (g.fiveHour) {
          const c5 = quotaColor(g.fiveHour.pct, isLight);
          const t5 = formatCountdown(g.fiveHour.refreshAt);
          subBars.push(`
            <div style="margin-top:4px;">
              <div style="display:flex;justify-content:space-between;font-size:10px;color:${mutedCol};margin-bottom:2px;">
                <span>5h${t5 ? ' · ' + t5 : ''}</span>
                <strong style="color:${c5};">${g.fiveHour.pct}%</strong>
              </div>
              <div style="height:3.5px;border-radius:999px;background:${trackBg};overflow:hidden;">
                <div style="height:100%;width:${g.fiveHour.pct}%;background:${c5};border-radius:999px;"></div>
              </div>
            </div>
          `);
        }
        if (g.weekly) {
          const cw = quotaColor(g.weekly.pct, isLight);
          const tw = formatCountdown(g.weekly.refreshAt);
          subBars.push(`
            <div style="margin-top:4px;">
              <div style="display:flex;justify-content:space-between;font-size:10px;color:${mutedCol};margin-bottom:2px;">
                <span>Tuần${tw ? ' · ' + tw : ''}</span>
                <strong style="color:${cw};">${g.weekly.pct}%</strong>
              </div>
              <div style="height:3.5px;border-radius:999px;background:${trackBg};overflow:hidden;">
                <div style="height:100%;width:${g.weekly.pct}%;background:${cw};border-radius:999px;"></div>
              </div>
            </div>
          `);
        }
        return `
          <div style="margin-top:7px;padding-top:5px;border-top:1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)'};">
            <div style="font-size:11px;font-weight:600;">${g.label}</div>
            ${subBars.join('')}
          </div>
        `;
      }).join('');

      if (expanded) {
        bodyHtml += `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px;padding-top:5px;border-top:1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)'};font-size:10px;color:${mutedCol};">
            <span>Cập nhật ${formatAge(cache.syncedAt)}</span>
            <button id="agy-quota-sb-models" type="button" style="background:transparent;border:none;color:${mainTheme.primary};font-size:10.5px;cursor:pointer;padding:0;font-weight:500;">Models ↗</button>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div id="agy-quota-sb-head" style="display:flex;justify-content:space-between;align-items:center;gap:4px;cursor:pointer;">
        <div style="display:flex;align-items:center;gap:5px;min-width:0;">
          <span style="color:${mainTheme.primary};display:inline-flex;flex-shrink:0;">${BOLT_ICON_SVG}</span>
          <span style="font-size:11.5px;font-weight:650;letter-spacing:0.1px;">Quota</span>
          ${badge ? `<span style="font-size:9.5px;padding:0.5px 5px;border-radius:999px;background:${mainTheme.glow};color:${mainTheme.primary};border:1px solid ${mainTheme.borderColor};font-weight:600;">${badge}</span>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button id="agy-quota-sb-sync" type="button" title="Đồng bộ Quota từ Settings → Models" style="background:transparent;border:none;color:${mutedCol};cursor:pointer;padding:2px;display:inline-flex;align-items:center;border-radius:4px;">
            <span class="${syncing ? 'agy-quota-spinning' : ''}" style="display:inline-flex;">${REFRESH_ICON_SVG}</span>
          </button>
          <span style="font-size:10px;color:${mutedCol};padding:0 1px;">${expanded ? '▴' : '▾'}</span>
        </div>
      </div>
      <div id="agy-quota-sb-body" style="cursor:pointer;">${bodyHtml}</div>
    `;

    const syncBtn = card.querySelector('#agy-quota-sb-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncQuotaFromSettingsUI(false);
      });
    }
    const initBtn = card.querySelector('#agy-quota-sb-init');
    if (initBtn) {
      initBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncQuotaFromSettingsUI(false);
      });
    }
    const modelsBtn = card.querySelector('#agy-quota-sb-models');
    if (modelsBtn) {
      modelsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        syncQuotaFromSettingsUI(true);
      });
    }
    const toggleExpand = () => {
      if (!readQuotaCache()) {
        syncQuotaFromSettingsUI(false);
        return;
      }
      localStorage.setItem(STORAGE_QUOTA_EXPANDED, expanded ? 'false' : 'true');
      injectOrUpdateSidebarQuotaCard();
    };
    const head = card.querySelector('#agy-quota-sb-head');
    const body = card.querySelector('#agy-quota-sb-body');
    if (head) head.addEventListener('click', toggleExpand);
    if (body) body.addEventListener('click', toggleExpand);
  }

  function injectOrUpdateTitlebarQuotaPill() {
    const st = getState();
    const existing = document.getElementById('agy-quota-titlebar-pill');
    if (!st.showQuotaTitlebar) {
      if (existing) existing.remove();
      const pop = document.getElementById('agy-quota-popover');
      if (pop) pop.style.display = 'none';
      return;
    }

    const toolbar = document.querySelector('[data-testid="pane-titlebar-toolbar"]');
    if (!toolbar) return;

    let pill = existing;
    if (!pill || pill.parentElement !== toolbar) {
      if (pill) pill.remove();
      pill = document.createElement('button');
      pill.id = 'agy-quota-titlebar-pill';
      pill.type = 'button';
      pill.style.cssText = 'display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; margin-right: 6px; border-radius: 9999px; font-size: 11px; font-weight: 550; cursor: pointer; white-space: nowrap; -webkit-app-region: no-drag; font-family: system-ui, -apple-system, sans-serif; transition: border-color 0.15s ease, background-color 0.15s ease;';
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        renderQuotaPopover(pill);
      });
      toolbar.insertBefore(pill, toolbar.firstChild);
    }

    const mainTheme = THEMES[st.themeName] || THEMES[DEFAULT_THEME_KEY];
    const isLight = Boolean(mainTheme.isLight);
    const cache = readQuotaCache();
    const syncing = Boolean(window.__AGY_QUOTA_SYNCING__);
    const pillKey = `${st.themeName}|${isLight}|${syncing}|${cache ? cache.syncedAt : 0}|${Math.floor(Date.now() / 30000)}`;
    if (pill.dataset.agyRenderKey === pillKey) return;
    pill.dataset.agyRenderKey = pillKey;

    if (!cache) {
      pill.title = 'Bấm để xem hoặc đồng bộ Model Quota';
      pill.innerHTML = `
        <span class="${syncing ? 'agy-quota-spinning' : ''}" style="color:${mainTheme.primary};display:inline-flex;">${syncing ? REFRESH_ICON_SVG : BOLT_ICON_SVG}</span>
        <span>${syncing ? 'Sync...' : 'Quota'}</span>
      `;
      return;
    }

    let overallMin = 100;
    let urgentTimer = '';
    const parts = cache.groups.slice(0, 2).map((g) => {
      const s = getGroupSummary(g);
      if (s.minPct < overallMin) overallMin = s.minPct;
      if (!urgentTimer && s.timer) urgentTimer = s.timer;
      const col = quotaColor(s.minPct, isLight);
      return `<span style="display:inline-flex;align-items:center;gap:2px;"><span style="opacity:0.75;">${g.tag}</span><strong style="color:${col};font-weight:650;">${s.minPct}%</strong></span>`;
    });

    const dotCol = quotaColor(overallMin, isLight);
    pill.title = `Model Quota (${cache.plan || 'Antigravity'}) • Cập nhật ${formatAge(cache.syncedAt)} — Bấm để xem chi tiết`;
    pill.innerHTML = `
      <span style="width:6px;height:6px;border-radius:999px;background:${dotCol};flex-shrink:0;"></span>
      ${parts.join('<span style="opacity:0.35;">·</span>')}
      ${urgentTimer ? `<span style="opacity:0.65;font-size:10px;margin-left:1px;">${urgentTimer}</span>` : ''}
    `;
  }

  function refreshQuotaWidgets() {
    injectOrUpdateSidebarQuotaCard();
    injectOrUpdateTitlebarQuotaPill();
    const pop = document.getElementById('agy-quota-popover');
    if (pop && pop.style.display !== 'none') {
      updateQuotaPopoverContent(pop);
    }
  }

  window.__ANTIGRAVITY_SYNC_QUOTA__ = syncQuotaFromSettingsUI;

  function tick(forceMetrics = false) {
    injectMainSidebarButton();
    injectSettingsModalButton();
    injectOrUpdateSidebarQuotaCard();
    injectOrUpdateTitlebarQuotaPill();
    tryPassiveCaptureQuotaFromModal();
    hookSidebarScroll();
    hookShellMetrics(forceMetrics);
  }

  function isOwnQuotaMutation(m) {
    const t = m && m.target;
    if (!t || t.nodeType !== 1) return false;
    return Boolean(t.closest && t.closest('#agy-quota-sidebar-card, #agy-quota-titlebar-pill, #agy-quota-popover'));
  }

  function scheduleTick(mutations) {
    if (Array.isArray(mutations) && mutations.length > 0 && mutations.every(isOwnQuotaMutation)) {
      return;
    }
    const attrChanged = Array.isArray(mutations) && mutations.some((m) => m.type === 'attributes');
    if (attrChanged) {
      window.__AGY_FORCE_METRICS__ = true;
      if (window.__AGY_TICK_TIMER__) {
        clearTimeout(window.__AGY_TICK_TIMER__);
        window.__AGY_TICK_TIMER__ = 0;
      }
      if (!window.__AGY_TICK_RAF__) {
        window.__AGY_TICK_RAF__ = requestAnimationFrame(() => {
          window.__AGY_TICK_RAF__ = 0;
          const force = Boolean(window.__AGY_FORCE_METRICS__);
          window.__AGY_FORCE_METRICS__ = false;
          tick(force);
        });
      }
      return;
    }
    if (window.__AGY_TICK_RAF__ || window.__AGY_TICK_TIMER__) return;
    const mounted = Boolean(document.getElementById('agy-custom-theme-sidebar-btn'));
    if (!mounted) {
      window.__AGY_TICK_RAF__ = requestAnimationFrame(() => {
        window.__AGY_TICK_RAF__ = 0;
        tick(false);
      });
    } else {
      window.__AGY_TICK_TIMER__ = setTimeout(() => {
        window.__AGY_TICK_TIMER__ = 0;
        tick(false);
      }, 120);
    }
  }

  clearTitleBarTimers();
  if (window.__AGY_SAVE_TIMER__) {
    clearTimeout(window.__AGY_SAVE_TIMER__);
    window.__AGY_SAVE_TIMER__ = 0;
  }
  if (window.__AGY_BLUR_TIMER__) {
    clearTimeout(window.__AGY_BLUR_TIMER__);
    window.__AGY_BLUR_TIMER__ = 0;
  }
  if (window.__AGY_TICK_TIMER__) {
    clearTimeout(window.__AGY_TICK_TIMER__);
    window.__AGY_TICK_TIMER__ = 0;
  }
  if (window.__AGY_QUOTA_TIMER__) {
    clearInterval(window.__AGY_QUOTA_TIMER__);
    window.__AGY_QUOTA_TIMER__ = 0;
  }
  if (window.__AGY_TICK_RAF__) {
    cancelAnimationFrame(window.__AGY_TICK_RAF__);
    window.__AGY_TICK_RAF__ = 0;
  }
  if (window.__AGY_METRICS_RAF__) {
    cancelAnimationFrame(window.__AGY_METRICS_RAF__);
    window.__AGY_METRICS_RAF__ = 0;
  }
  window.__AGY_LAST_METRICS_CSS__ = '';
  if (window.__AGY_SHELL_RO__) {
    try { window.__AGY_SHELL_RO__.disconnect(); } catch (e) {}
    window.__AGY_SHELL_RO__ = null;
  }
  if (window.__AGY_SCROLL_AC__) {
    try { window.__AGY_SCROLL_AC__.abort(); } catch (e) {}
  }
  window.__AGY_SCROLL_AC__ = new AbortController();
  window.addEventListener('load', () => scheduleTitleBarSync(), { signal: window.__AGY_SCROLL_AC__.signal });
  window.addEventListener('focus', () => syncTitleBarOverlay(), { signal: window.__AGY_SCROLL_AC__.signal });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncTitleBarOverlay();
  }, { signal: window.__AGY_SCROLL_AC__.signal });
  document.querySelectorAll('[data-agy-scroll-bound]').forEach(el => delete el.dataset.agyScrollBound);
  document.querySelectorAll('[data-agy-tbo-mounted]').forEach(el => delete el.dataset.agyTboMounted);
  const staleBackdrop = document.getElementById('agy-custom-theme-modal-backdrop');
  if (staleBackdrop) staleBackdrop.remove();
  const staleSidebarBtn = document.getElementById('agy-custom-theme-sidebar-btn');
  if (staleSidebarBtn) staleSidebarBtn.remove();
  const staleSettingsBtn = document.getElementById('agy-custom-theme-settings-btn');
  if (staleSettingsBtn) staleSettingsBtn.remove();
  const staleQuotaCard = document.getElementById('agy-quota-sidebar-card');
  if (staleQuotaCard) staleQuotaCard.remove();
  const staleQuotaPill = document.getElementById('agy-quota-titlebar-pill');
  if (staleQuotaPill) staleQuotaPill.remove();
  const staleQuotaPop = document.getElementById('agy-quota-popover');
  if (staleQuotaPop) staleQuotaPop.remove();
  const staleQuotaHide = document.getElementById('agy-quota-sync-hide-style');
  if (staleQuotaHide) staleQuotaHide.remove();
  window.__AGY_QUOTA_SYNCING__ = false;

  // Lightweight 30s tick solely for live countdown display (0% CPU, zero DOM reflow on .agy-shell)
  window.__AGY_QUOTA_TIMER__ = setInterval(() => {
    if (!document.hidden && readQuotaCache()) {
      refreshQuotaWidgets();
    }
  }, 30000);

  window.__AGY_HOLE_EL__ = null;
  window.__AGY_SIDE_EL__ = null;
  window.__AGY_SIDE_HAS_CONTENT__ = false;
  window.__AGY_FORCE_METRICS__ = false;
  if (window.__AGY_MODAL_OBSERVER__) {
    window.__AGY_MODAL_OBSERVER__.disconnect();
  }
  window.__AGY_MODAL_OBSERVER__ = new MutationObserver(scheduleTick);
  window.__AGY_MODAL_OBSERVER__.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-has-browser-hole', 'data-browser-hole']
  });
  tick(true);

  return 'Antigravity Custom Theme Engine Ready!';
})();
