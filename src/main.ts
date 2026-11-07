import { ChiptuneSynth } from './core/audio';
import { InputManager } from './core/input';
import { GBC_HEIGHT, GBC_SCALE, GBC_WIDTH } from './core/pixel-renderer';
import { CartridgeStorage } from './core/storage';
import { CARTRIDGE_REGISTRY } from './games/registry';
import { romLoaderCartridge } from './games/rom-loader';
import { GBCSystemOS } from './games/system-os';
import { SHELL_THEMES } from './stage/gbc-model';
import { StageScene } from './stage/stage-scene';

function bootstrap(): void {
  const storage = new CartridgeStorage();
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
  const liveStatus = document.getElementById('live-status')!;

  const btnEject = document.getElementById('btn-eject')!;
  const btnLibrary = document.getElementById('btn-library')!;
  const btnShell = document.getElementById('btn-shell')!;
  const shellSwatch = document.getElementById('shell-swatch')!;
  const shellLabel = document.getElementById('shell-label')!;
  const btnZoom = document.getElementById('btn-zoom')!;
  const btnMute = document.getElementById('btn-mute')!;
  const iconSoundOn = document.getElementById('icon-sound-on')!;
  const iconSoundOff = document.getElementById('icon-sound-off')!;
  const muteLabel = document.getElementById('mute-label')!;

  const cartDialog = document.getElementById('cartridge-dialog') as HTMLDialogElement;
  const dialogCartGrid = document.getElementById('dialog-cart-grid')!;
  const romFileInput = document.getElementById('rom-file-input') as HTMLInputElement;
  const romFilenameStatus = document.getElementById('rom-filename-status')!;

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
      exitToMenu: () => systemOS.returnToCarousel(),
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
      systemOS.powerOn();
      stageScene.getModel().setPowerState(true);
      gateEl.hidden = true;
      liveStatus.textContent = 'Game Boy Color powered on. Use arrow keys or WASD to select a game.';
    }
  };

  stageScene = new StageScene(stageContainer, screenCanvas, {
    onVirtualButton: (btn, pressed) => {
      powerOnConsole();
      input.setVirtualButton(btn, pressed);
    },
    onPowerToggle: () => {
      powerOnConsole();
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

  // Shell Theme initialization & cycling
  let themeIdx = Math.max(
    0,
    SHELL_THEMES.findIndex((t) => t.id === storage.getSetting('shell', 'atomic-purple'))
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
  });

  // Camera Zoom Toggle
  btnZoom.addEventListener('click', () => {
    const nextZoom = !stageScene.isZoomedIn();
    stageScene.setZoomedIn(nextZoom);
    btnZoom.setAttribute('aria-pressed', String(nextZoom));
    audio.playButtonClick();
  });

  // Eject / Return to Cartridge Carousel Menu
  btnEject.addEventListener('click', () => {
    powerOnConsole();
    systemOS.returnToCarousel();
  });

  // Populate Cartridge Library Modal Dialog
  const renderLibraryCards = () => {
    dialogCartGrid.innerHTML = '';
    for (const cart of CARTRIDGE_REGISTRY) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cart-card';
      const hi = storage.getHighScore(cart.id);

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
      sub.textContent = `${cart.subtitle} · Best: ${hi}`;

      btn.append(top, sub);
      btn.addEventListener('click', () => {
        cartDialog.close();
        powerOnConsole();
        systemOS.launchCartridgeById(cart.id);
      });
      dialogCartGrid.appendChild(btn);
    }
  };

  btnLibrary.addEventListener('click', () => {
    renderLibraryCards();
    cartDialog.showModal();
  });

  // Custom .gb / .gbc ROM file input handler
  romFileInput.addEventListener('change', async () => {
    const file = romFileInput.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    romLoaderCartridge.onRomLoaded?.(file.name, bytes);
    romFilenameStatus.textContent = `Loaded: ${file.name} (${Math.round(bytes.length / 1024)} KB)`;
    if (cartDialog.open) cartDialog.close();
    powerOnConsole();
    systemOS.launchCartridgeById('rom-loader');
  });

  // Initialize cartridge colors for initial selection
  const firstCart = systemOS.getSelectedCartridge();
  stageScene.getModel().setCartridgeAppearance(firstCart.cartridgeColor, firstCart.accentColor);

  // Main 60fps animation loop
  let lastTime = performance.now();
  const animate = (now: number) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    const elapsed = now / 1000;

    const inputState = input.poll();
    systemOS.update(dt, inputState);
    systemOS.renderToScreenCanvas(screenCtx);
    stageScene.render(dt, elapsed);

    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

bootstrap();
