import { ChiptuneSynth } from './core/audio';
import { CloudSyncService } from './core/cloud';
import { InputManager } from './core/input';
import { GBC_HEIGHT, GBC_SCALE, GBC_WIDTH } from './core/pixel-renderer';
import { ACHIEVEMENTS, CartridgeStorage, formatDuration } from './core/storage';
import { CARTRIDGE_REGISTRY } from './games/registry';
import {
  pokemonBlueCartridge,
  pokemonCrystalCartridge,
  pokemonGoldCartridge,
  pokemonPinballCartridge,
  pokemonPuzzleCartridge,
  pokemonRedCartridge,
  pokemonSilverCartridge,
  pokemonTcgCartridge,
  pokemonYellowCartridge,
} from './games/pocket-monsters';
import { romLoaderCartridge } from './games/rom-loader';
import { GBCSystemOS } from './games/system-os';
import { SHELL_THEMES } from './stage/gbc-model';
import { StageScene } from './stage/stage-scene';

function bootstrap(): void {
  const storage = new CartridgeStorage();
  const gameIds = CARTRIDGE_REGISTRY.map((c) => c.id);
  const cloud = new CloudSyncService(storage, gameIds);

  const initialMuted = storage.getSetting('muted', 'false') === 'true';
  const audio = new ChiptuneSynth(initialMuted);
  const input = new InputManager();

  // Offscreen 640x576 (4x 160x144) canvas for the 3D Game Boy screen
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = GBC_WIDTH * GBC_SCALE;
  screenCanvas.height = GBC_HEIGHT * GBC_SCALE;
  const screenCtx = screenCanvas.getContext('2d')!;
  screenCtx.imageSmoothingEnabled = false;

  // DOM References
  const stageContainer = document.getElementById('stage')!;
  const gateEl = document.getElementById('gate')!;
  const btnPowerGate = document.getElementById('btn-power-gate')!;
  const activeCartLabel = document.getElementById('active-cart-label')!;
  const visitorCountEl = document.getElementById('visitor-count')!;
  const liveStatus = document.getElementById('live-status')!;

  const btnEject = document.getElementById('btn-eject')!;
  const btnLibrary = document.getElementById('btn-library')!;
  const btnShell = document.getElementById('btn-shell')!;
  const shellSwatch = document.getElementById('shell-swatch')!;
  const shellLabel = document.getElementById('shell-label')!;
  const btnZoom = document.getElementById('btn-zoom')!;
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnMute = document.getElementById('btn-mute')!;
  const iconSoundOn = document.getElementById('icon-sound-on')!;
  const iconSoundOff = document.getElementById('icon-sound-off')!;
  const muteLabel = document.getElementById('mute-label')!;

  const tiltHud = document.getElementById('tilt-hud');
  const tiltBubbleDot = document.getElementById('tilt-bubble-dot');
  const tiltAngleReadout = document.getElementById('tilt-angle-readout');

  const cartDialog = document.getElementById('cartridge-dialog') as HTMLDialogElement;
  const dialogCartGrid = document.getElementById('dialog-cart-grid')!;
  const romFileInput = document.getElementById('rom-file-input') as HTMLInputElement;
  const romFilenameStatus = document.getElementById('rom-filename-status')!;

  // Hub Tabs & Panels
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.hub-tab');
  const panelLibrary = document.getElementById('tab-panel-library')!;
  const panelHistory = document.getElementById('tab-panel-history')!;
  const panelMempak = document.getElementById('tab-panel-mempak')!;

  const historyTableBody = document.getElementById('history-table-body')!;
  const badgeGrid = document.getElementById('badge-grid')!;
  const activityList = document.getElementById('activity-list')!;

  // Memory Pak & Cloud Elements
  const callsignForm = document.getElementById('callsign-form') as HTMLFormElement;
  const callsignInput = document.getElementById('player-callsign-input') as HTMLInputElement;
  const btnCopyPak = document.getElementById('btn-copy-pak')!;
  const btnDownloadPak = document.getElementById('btn-download-pak')!;
  const mempakImportForm = document.getElementById('mempak-import-form') as HTMLFormElement;
  const mempakCodeInput = document.getElementById('mempak-code-input') as HTMLTextAreaElement;
  const mempakFeedback = document.getElementById('mempak-feedback')!;

  const cloudStatusText = document.getElementById('cloud-status-text')!;
  const btnGoogleLogin = document.getElementById('btn-google-login')!;
  const btnGuestLogin = document.getElementById('btn-guest-login')!;
  const btnCloudSyncNow = document.getElementById('btn-cloud-sync-now')!;
  const btnCloudLogout = document.getElementById('btn-cloud-logout')!;
  const firebaseConfigForm = document.getElementById('firebase-config-form') as HTMLFormElement;
  const firebaseConfigInput = document.getElementById('firebase-config-input') as HTMLTextAreaElement;
  const leaderboardTableBody = document.getElementById('leaderboard-table-body')!;

  // Prevent text/element selection, dragging, and context menus outside dialog inputs
  const isDialogInput = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('.cart-dialog input, .cart-dialog textarea'));
  };
  document.addEventListener('selectstart', (e) => {
    if (!isDialogInput(e.target)) e.preventDefault();
  });
  document.addEventListener('dragstart', (e) => {
    if (!isDialogInput(e.target)) e.preventDefault();
  });
  document.addEventListener('contextmenu', (e) => {
    if (!isDialogInput(e.target)) e.preventDefault();
  });

  // Fullscreen & Mobile Play Mode (collapses mobile browser URL bar and requests tilt permission)
  const syncFullscreenUI = () => {
    const isFs = Boolean(
      document.fullscreenElement ||
        (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    );
    btnFullscreen?.setAttribute('aria-pressed', String(isFs));
  };
  document.addEventListener('fullscreenchange', syncFullscreenUI);
  document.addEventListener('webkitfullscreenchange', syncFullscreenUI);

  const requestFullscreenSafe = () => {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (
      !document.fullscreenElement &&
      !(document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement
    ) {
      try {
        if (typeof docEl.requestFullscreen === 'function') {
          docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
        } else if (typeof docEl.webkitRequestFullscreen === 'function') {
          docEl.webkitRequestFullscreen();
        }
      } catch {
        // Ignore if blocked outside user gesture
      }
    }
  };

  const enterMobilePlayMode = () => {
    const isTouchOrMobile =
      window.matchMedia?.('(pointer: coarse)').matches ||
      window.innerWidth <= 900 ||
      'ontouchstart' in window;
    if (isTouchOrMobile) {
      window.scrollTo(0, 1);
    }
  };

  // Mandatory light-dismiss fallback for browsers without native <dialog closedby="any">
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    cartDialog.addEventListener('click', (event) => {
      if (event.target !== cartDialog) return;
      const rect = cartDialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (isDialogContent) return;
      cartDialog.close();
    });
  }

  let stageScene: StageScene;

  const systemOS = new GBCSystemOS(
    {
      width: GBC_WIDTH,
      height: GBC_HEIGHT,
      audio,
      storage,
      exitToMenu: () => {
        if (window.location.search) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        systemOS.returnToCarousel();
      },
      openRomFilePicker: () => romFileInput.click(),
    },
    {
      onCartridgeChanged: (cart) => {
        if (!cart) {
          activeCartLabel.textContent = 'CARTRIDGE MENU';
          return;
        }
        activeCartLabel.textContent = cart.title;
        liveStatus.textContent = `Selected cartridge: ${cart.title} (${cart.genre})`;
        stageScene?.getModel().setCartridgeAppearance(cart.cartridgeColor, cart.accentColor);
      },
    }
  );

  const powerOnConsole = () => {
    if (!systemOS.isPoweredOn()) {
      enterMobilePlayMode();
      systemOS.powerOn();
      stageScene.getModel().setPowerState(true);
      gateEl.hidden = true;
      liveStatus.textContent = 'Game Boy Color powered on. Use arrow keys or WASD to select a game.';
    }
  };

  stageScene = new StageScene(stageContainer, screenCanvas, {
    onVirtualButton: (btn, pressed) => {
      if (pressed) {
        powerOnConsole();
        audio.unlock();
      }
      input.setVirtualButton(btn, pressed);
    },
    onPowerToggle: () => {
      powerOnConsole();
      audio.unlock();
    },
    onScreenTap: (gbcX, gbcY) => {
      audio.unlock();
      if (!systemOS.isPoweredOn()) {
        powerOnConsole();
        return;
      }
      const consumed = systemOS.handleScreenTap(gbcX, gbcY);
      if (!consumed) {
        input.pulseButton('a', 110);
        input.pulseButton('start', 110);
      }
    },
  });

  // Sync physical 3D button depression with keyboard/touch/gamepad input
  input.onButtonChange((btn, pressed) => {
    stageScene.getModel().setButtonState(btn, pressed);
  });

  input.onAnyInput(() => {
    powerOnConsole();
  });

  btnPowerGate.addEventListener('click', () => {
    powerOnConsole();
    stageContainer.focus();
  });

  // Upper-Right Phone Tilt & Angle Monitor Toggle Button (TILT ON / OFF) + Touch-Drag Tilt Pad
  const syncTiltToggleUI = () => {
    const enabled = input.isTiltEnabled();
    tiltHud?.setAttribute('aria-pressed', String(enabled));
    tiltHud?.classList.toggle('is-active', enabled);
    if (!enabled) {
      if (tiltAngleReadout) tiltAngleReadout.textContent = 'TILT OFF';
      if (tiltBubbleDot) tiltBubbleDot.style.transform = 'translate(0px, 0px)';
    }
  };
  syncTiltToggleUI();

  let tiltDragPointerId: number | null = null;
  let tiltDragStartX = 0;
  let tiltDragStartY = 0;
  let tiltDidDrag = false;

  tiltHud?.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    tiltDragPointerId = e.pointerId;
    tiltDragStartX = e.clientX;
    tiltDragStartY = e.clientY;
    tiltDidDrag = false;
    try {
      tiltHud.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors
    }
  });

  tiltHud?.addEventListener('pointermove', (e) => {
    if (tiltDragPointerId === null || e.pointerId !== tiltDragPointerId) return;
    const dx = e.clientX - tiltDragStartX;
    const dy = e.clientY - tiltDragStartY;
    if (Math.hypot(dx, dy) > 6) {
      tiltDidDrag = true;
      if (!input.isTiltEnabled()) {
        input.setTiltEnabled(true);
        syncTiltToggleUI();
      }
      input.setManualTilt(dx / 42, dy / 42, true);
    }
  });

  const endTiltHudDrag = (e: PointerEvent) => {
    if (tiltDragPointerId === null || e.pointerId !== tiltDragPointerId) return;
    tiltDragPointerId = null;
    if (tiltDidDrag) {
      input.setManualTilt(0, 0, false);
    }
  };
  tiltHud?.addEventListener('pointerup', endTiltHudDrag);
  tiltHud?.addEventListener('pointercancel', endTiltHudDrag);

  tiltHud?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (tiltDidDrag) {
      tiltDidDrag = false;
      return;
    }
    const enabled = input.toggleTiltEnabled();
    if (enabled) {
      input.requestTiltPermission().catch(() => {});
    }
    syncTiltToggleUI();
    audio.unlock();
    audio.playButtonClick();
    liveStatus.textContent = enabled
      ? 'Phone tilt sensor turned ON and calibrated to 0°, 0°.'
      : 'Phone tilt sensor turned OFF.';
    stageContainer.focus();
  });

  // Visitor Counter initialization (sadok.mx style)
  cloud.recordAndGetVisitorCount().then((count) => {
    visitorCountEl.textContent = `#${count.toLocaleString('en-US')}`;
  });

  // Auto-push to cloud when local high scores or saves mutate
  storage.onStateMutated(() => {
    if (cloud.getUser()) {
      cloud.pushToCloud().catch(() => {});
    }
  });

  // Shell Theme initialization & cycling
  const urlShell = new URLSearchParams(window.location.search).get('shell');
  const initialShellId = urlShell || storage.getSetting('shell', 'atomic-purple');
  let themeIdx = Math.max(
    0,
    SHELL_THEMES.findIndex((t) => t.id === initialShellId)
  );
  const applyShellTheme = (idx: number) => {
    const theme = SHELL_THEMES[idx % SHELL_THEMES.length];
    stageScene.getModel().setShellTheme(theme);
    shellSwatch.style.backgroundColor = theme.cssHex;
    shellLabel.textContent = theme.name;
    storage.setSetting('shell', theme.id);
  };
  applyShellTheme(themeIdx);

  btnShell.addEventListener('click', () => {
    themeIdx = (themeIdx + 1) % SHELL_THEMES.length;
    applyShellTheme(themeIdx);
    audio.playButtonClick();
    stageContainer.focus();
  });

  // Mute button UI sync
  const syncMuteUI = () => {
    const muted = audio.isMuted();
    btnMute.setAttribute('aria-pressed', String(muted));
    iconSoundOn.toggleAttribute('hidden', muted);
    iconSoundOff.toggleAttribute('hidden', !muted);
    muteLabel.textContent = muted ? 'MUTED' : 'SOUND ON';
    storage.setSetting('muted', String(muted));
  };
  syncMuteUI();

  btnMute.addEventListener('click', () => {
    audio.setMuted(!audio.isMuted());
    syncMuteUI();
    stageContainer.focus();
  });

  // Camera Zoom Toggle
  btnZoom.addEventListener('click', () => {
    const nextZoom = !stageScene.isZoomedIn();
    stageScene.setZoomedIn(nextZoom);
    btnZoom.setAttribute('aria-pressed', String(nextZoom));
    audio.playButtonClick();
    stageContainer.focus();
  });

  // Fullscreen Toggle
  btnFullscreen?.addEventListener('click', () => {
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } else if (
      typeof docEl.requestFullscreen === 'function' ||
      typeof docEl.webkitRequestFullscreen === 'function'
    ) {
      requestFullscreenSafe();
    } else {
      // iOS Safari standard tab: toggle screen zoom + show quick instruction for hiding bottom URL bar
      const nextZoom = !stageScene.isZoomedIn();
      stageScene.setZoomedIn(nextZoom);
      btnZoom.setAttribute('aria-pressed', String(nextZoom));
      btnFullscreen.setAttribute('aria-pressed', String(nextZoom));
      liveStatus.textContent =
        'iPhone Full Screen: Tap Safari [aA] -> Hide Toolbar, or Share -> Add to Home Screen for zero URL bar.';
    }
    window.scrollTo(0, 1);
    audio.playButtonClick();
    stageContainer.focus();
  });

  // Upper-Left Settings Menu Toggle & Auto-Close
  const settingsNav = document.getElementById('settings-nav');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const setSettingsOpen = (open: boolean) => {
    if (!settingsNav || !btnSettingsToggle) return;
    settingsNav.classList.toggle('is-open', open);
    btnSettingsToggle.setAttribute('aria-expanded', String(open));
  };
  btnSettingsToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = settingsNav?.classList.contains('is-open') ?? false;
    setSettingsOpen(!isOpen);
    audio.playButtonClick();
  });
  document.addEventListener('pointerdown', (e) => {
    if (settingsNav?.classList.contains('is-open') && !settingsNav.contains(e.target as Node)) {
      setSettingsOpen(false);
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsNav?.classList.contains('is-open')) {
      setSettingsOpen(false);
    }
  });

  // Eject / Return to Cartridge Carousel Menu
  btnEject.addEventListener('click', () => {
    setSettingsOpen(false);
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    powerOnConsole();
    systemOS.returnToCarousel();
    stageContainer.focus();
  });

  cartDialog.addEventListener('close', () => {
    stageContainer.focus();
  });

  // --- Hub Modal Dialog Tabs & Rendering ---

  const switchHubTab = (tabName: string) => {
    tabBtns.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.tab === tabName));
    });
    panelLibrary.toggleAttribute('hidden', tabName !== 'library');
    panelHistory.toggleAttribute('hidden', tabName !== 'history');
    panelMempak.toggleAttribute('hidden', tabName !== 'mempak');

    if (tabName === 'library') renderLibraryCards();
    if (tabName === 'history') renderPlayHistoryTab();
    if (tabName === 'mempak') renderMempakAndCloudTab();
  };

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchHubTab(btn.dataset.tab ?? 'library');
      audio.playButtonClick();
    });
  });

  const renderLibraryCards = () => {
    dialogCartGrid.innerHTML = '';
    for (const cart of CARTRIDGE_REGISTRY) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cart-card';
      const hi = storage.getHighScore(cart.id);
      const stat = storage.getGamePlayStat(cart.id);

      const top = document.createElement('div');
      top.className = 'cart-card-top';

      const titleSpan = document.createElement('span');
      titleSpan.className = 'cart-card-title';
      titleSpan.textContent = cart.title;

      const genreSpan = document.createElement('span');
      genreSpan.className = 'cart-card-genre';
      genreSpan.textContent = cart.genre;

      top.append(titleSpan, genreSpan);

      const sub = document.createElement('div');
      sub.className = 'cart-card-sub';
      sub.textContent = `${cart.subtitle} · Best: ${hi} · Played: ${formatDuration(stat.totalSeconds)}`;

      btn.append(top, sub);
      btn.addEventListener('click', () => {
        cartDialog.close();
        powerOnConsole();
        systemOS.launchCartridgeById(cart.id);
      });
      dialogCartGrid.appendChild(btn);
    }
  };

  const renderPlayHistoryTab = () => {
    historyTableBody.innerHTML = '';
    for (const cart of CARTRIDGE_REGISTRY) {
      const stat = storage.getGamePlayStat(cart.id);
      const hi = storage.getHighScore(cart.id);

      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = cart.title;

      const tdSessions = document.createElement('td');
      tdSessions.textContent = String(stat.sessions);

      const tdTime = document.createElement('td');
      tdTime.textContent = formatDuration(stat.totalSeconds);

      const tdScore = document.createElement('td');
      tdScore.textContent = hi.toLocaleString('en-US');

      const tdLast = document.createElement('td');
      tdLast.textContent = stat.lastPlayedIso ? stat.lastPlayedIso.slice(0, 10) : 'Never';

      tr.append(th, tdSessions, tdTime, tdScore, tdLast);
      historyTableBody.appendChild(tr);
    }

    // Achievements / Badges
    badgeGrid.innerHTML = '';
    const unlocked = storage.getUnlockedAchievements();
    for (const ach of ACHIEVEMENTS) {
      const isUnl = unlocked.includes(ach.id);
      const card = document.createElement('div');
      card.className = `badge-card${isUnl ? ' is-unlocked' : ''}`;

      const title = document.createElement('div');
      title.className = 'badge-title';
      title.textContent = `${ach.icon} ${ach.title} ${isUnl ? '✓' : '(LOCKED)'}`;

      const desc = document.createElement('div');
      desc.className = 'badge-desc';
      desc.textContent = ach.description;

      card.append(title, desc);
      badgeGrid.appendChild(card);
    }

    // Recent Activity Log
    activityList.innerHTML = '';
    const logs = storage.getActivityLog();
    if (logs.length === 0) {
      const li = document.createElement('li');
      li.className = 'activity-item';
      li.textContent = 'No games launched yet — power on the console to start logging history!';
      activityList.appendChild(li);
    } else {
      for (const entry of logs) {
        const li = document.createElement('li');
        li.className = 'activity-item';

        const msg = document.createElement('span');
        msg.textContent = entry.message;

        const time = document.createElement('span');
        time.className = 'activity-time';
        time.textContent = entry.timestampIso.slice(11, 19);

        li.append(msg, time);
        activityList.appendChild(li);
      }
    }
  };

  const renderMempakAndCloudTab = async () => {
    callsignInput.value = storage.getCallsign();
    mempakCodeInput.value = storage.exportMemoryPakCode(gameIds);

    const user = cloud.getUser();
    if (!cloud.isConfigured()) {
      cloudStatusText.textContent =
        'Mode: Local Storage + Memory Pak Save Code active. Connect a Firebase project below to enable live Cloud Sync.';
      btnCloudLogout.toggleAttribute('hidden', true);
    } else if (user) {
      cloudStatusText.textContent = `Connected to Firebase Cloud (${user.isAnonymous ? 'Guest UID: ' + user.uid.slice(0, 8) : user.email ?? user.displayName}) — Auto-Sync Active!`;
      btnCloudLogout.toggleAttribute('hidden', false);
    } else {
      cloudStatusText.textContent = 'Firebase Ready! Sign in with Google or Cloud Guest to sync across devices.';
      btnCloudLogout.toggleAttribute('hidden', true);
    }

    // Populate Leaderboard Table across games
    leaderboardTableBody.innerHTML = '';
    const featuredGames = CARTRIDGE_REGISTRY.slice(0, 3);
    for (const cart of featuredGames) {
      const entries = await cloud.fetchLeaderboard(cart.id);
      for (const e of entries.slice(0, 2)) {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = e.displayName;

        const tdGame = document.createElement('td');
        tdGame.textContent = cart.title;

        const tdScore = document.createElement('td');
        tdScore.textContent = e.score.toLocaleString('en-US');

        const tdSrc = document.createElement('td');
        tdSrc.textContent = e.updatedAtIso;

        tr.append(th, tdGame, tdScore, tdSrc);
        leaderboardTableBody.appendChild(tr);
      }
    }
  };

  btnLibrary.addEventListener('click', () => {
    renderLibraryCards();
    cartDialog.showModal();
  });

  // Memory Pak & Callsign Handlers
  callsignForm.addEventListener('submit', (e) => {
    e.preventDefault();
    storage.setCallsign(callsignInput.value);
    mempakFeedback.textContent = `Callsign updated to "${storage.getCallsign()}"!`;
    mempakCodeInput.value = storage.exportMemoryPakCode(gameIds);
  });

  btnCopyPak.addEventListener('click', async () => {
    const code = storage.exportMemoryPakCode(gameIds);
    mempakCodeInput.value = code;
    try {
      await navigator.clipboard.writeText(code);
      mempakFeedback.textContent = 'Copied Memory Pak Save Code to clipboard!';
    } catch {
      mempakCodeInput.select();
      mempakFeedback.textContent = 'Selected code! Press Cmd+C / Ctrl+C to copy.';
    }
  });

  btnDownloadPak.addEventListener('click', () => {
    const payload = storage.buildPayload(gameIds);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pocket-arcade-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    mempakFeedback.textContent = 'Downloaded .json save backup!';
  });

  mempakImportForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = storage.importMemoryPakCode(mempakCodeInput.value);
    mempakFeedback.textContent = res.message;
    if (res.ok) {
      audio.playPowerUp();
    }
  });

  // Cloud Sync Handlers
  cloud.onStatusChange(() => {
    if (cartDialog.open && !panelMempak.hasAttribute('hidden')) {
      renderMempakAndCloudTab();
    }
  });

  btnGoogleLogin.addEventListener('click', async () => {
    const res = await cloud.signInWithGoogle();
    cloudStatusText.textContent = res.message;
  });

  btnGuestLogin.addEventListener('click', async () => {
    const res = await cloud.signInGuestCloud();
    cloudStatusText.textContent = res.message;
  });

  btnCloudSyncNow.addEventListener('click', async () => {
    if (!cloud.getUser()) {
      cloudStatusText.textContent = 'Sign in with Google or Cloud Guest first to sync!';
      return;
    }
    await cloud.pullFromCloud();
    const ok = await cloud.pushToCloud();
    cloudStatusText.textContent = ok ? 'Synced play history & scores to Firestore!' : 'Cloud sync failed.';
    renderMempakAndCloudTab();
  });

  btnCloudLogout.addEventListener('click', async () => {
    await cloud.signOutCloud();
    renderMempakAndCloudTab();
  });

  firebaseConfigForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = cloud.saveCustomFirebaseConfig(firebaseConfigInput.value);
    cloudStatusText.textContent = res.message;
    renderMempakAndCloudTab();
  });

  // Custom .gb / .gbc ROM file input handler (routes Red/Blue ROMs to their dedicated cartridges)
  romFileInput.addEventListener('change', async () => {
    const file = romFileInput.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const currentCart = systemOS.getSelectedCartridge();
    const lowerName = file.name.toLowerCase();

    let targetCart = romLoaderCartridge;
    if (currentCart.id === 'pokemon-red' || lowerName.includes('red')) {
      targetCart = pokemonRedCartridge;
    } else if (currentCart.id === 'pokemon-blue' || lowerName.includes('blue')) {
      targetCart = pokemonBlueCartridge;
    } else if (currentCart.id === 'pokemon-yellow' || lowerName.includes('yellow')) {
      targetCart = pokemonYellowCartridge;
    } else if (currentCart.id === 'pokemon-gold' || lowerName.includes('gold')) {
      targetCart = pokemonGoldCartridge;
    } else if (currentCart.id === 'pokemon-silver' || lowerName.includes('silver')) {
      targetCart = pokemonSilverCartridge;
    } else if (currentCart.id === 'pokemon-crystal' || lowerName.includes('crystal')) {
      targetCart = pokemonCrystalCartridge;
    } else if (currentCart.id === 'pokemon-tcg' || lowerName.includes('tcg') || lowerName.includes('card')) {
      targetCart = pokemonTcgCartridge;
    } else if (currentCart.id === 'pokemon-pinball' || lowerName.includes('pinball')) {
      targetCart = pokemonPinballCartridge;
    } else if (currentCart.id === 'pokemon-puzzle' || lowerName.includes('puzzle')) {
      targetCart = pokemonPuzzleCartridge;
    }

    targetCart.onRomLoaded?.(file.name, bytes);
    romFilenameStatus.textContent = `Loaded: ${file.name} (${Math.round(bytes.length / 1024)} KB) -> ${targetCart.title}`;
    if (cartDialog.open) cartDialog.close();
    powerOnConsole();
    systemOS.launchCartridgeById(targetCart.id);
  });

  // Initialize cartridge colors for initial selection
  const firstCart = systemOS.getSelectedCartridge();
  stageScene.getModel().setCartridgeAppearance(firstCart.cartridgeColor, firstCart.accentColor);

  // Support URL query params (?cart=pokemon-red, ?cart=pokemon-blue, ?carousel=1) for deep-linking & simulator testing
  const urlParams = new URLSearchParams(window.location.search);
  const autoCart = urlParams.get('cart');
  const autoCarousel = urlParams.get('carousel');
  if (autoCart) {
    powerOnConsole();
    systemOS.launchCartridgeById(autoCart);
  } else if (autoCarousel === '1') {
    powerOnConsole();
    systemOS.returnToCarousel();
  }

  // Main 60fps animation loop
  let lastTime = performance.now();
  const animate = (now: number) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const elapsed = now / 1000;

    const inputState = input.poll();
    const tiltOn = input.isTiltEnabled();
    stageScene.setDeviceTilt(tiltOn ? inputState.tilt.x : 0, tiltOn ? inputState.tilt.y : 0);

    if (tiltBubbleDot) {
      const dotX = tiltOn ? Math.max(-5, Math.min(5, inputState.tilt.x * 5)) : 0;
      const dotY = tiltOn ? Math.max(-5, Math.min(5, inputState.tilt.y * 5)) : 0;
      tiltBubbleDot.style.transform = `translate(${dotX.toFixed(1)}px, ${dotY.toFixed(1)}px)`;
    }
    if (tiltAngleReadout) {
      if (tiltOn) {
        const r = Math.round(inputState.tilt.rollDeg);
        const p = Math.round(inputState.tilt.pitchDeg);
        tiltAngleReadout.textContent = `TILT ON · ${r}°,${p}°`;
      } else {
        tiltAngleReadout.textContent = 'TILT OFF';
      }
    }
    tiltHud?.classList.toggle('is-active', tiltOn);

    systemOS.update(dt, inputState);
    systemOS.renderToScreenCanvas(screenCtx);
    stageScene.render(dt, elapsed);

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);

  // Dev diagnostic beacon so our local server can inspect the physical iPhone state in real time
  if (window.location.port === '5173' || window.location.port === '5174') {
    const sendDeviceDiag = (trigger: string) => {
      try {
        const doe = (typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : undefined) as unknown as {
          requestPermission?: unknown;
        } | undefined;
        const nav = navigator as Navigator & { audioSession?: { type?: string } };
        const payload = {
          ts: new Date().toISOString(),
          trigger,
          href: window.location.href,
          ua: navigator.userAgent,
          viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
          isSecureContext: window.isSecureContext,
          hasDeviceOrientation: typeof DeviceOrientationEvent !== 'undefined',
          hasRequestPermission: Boolean(doe && typeof doe.requestPermission === 'function'),
          sensorReceiving: input.isSensorReceiving(),
          tiltEnabled: input.isTiltEnabled(),
          tiltText: tiltAngleReadout?.textContent ?? '',
          audioState: audio.getContextState(),
          audioMuted: audio.isMuted(),
          audioSessionType: nav.audioSession?.type ?? 'unsupported',
          shellTheme: shellLabel.textContent,
          activeCart: activeCartLabel.textContent,
          poweredOn: systemOS.isPoweredOn(),
          screenPng: screenCanvas.toDataURL('image/png'),
        };
        fetch('/__diag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {
        // Ignore telemetry errors
      }
    };
    setTimeout(() => sendDeviceDiag('load'), 600);
    window.addEventListener('touchend', () => setTimeout(() => sendDeviceDiag('touchend'), 150), { passive: true });
    window.addEventListener('click', () => setTimeout(() => sendDeviceDiag('click'), 150), { passive: true });
    setInterval(() => sendDeviceDiag('heartbeat'), 5000);
  }
}

bootstrap();
