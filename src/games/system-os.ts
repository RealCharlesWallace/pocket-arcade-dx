import {
  drawGBCBox,
  drawLCDSubpixelOverlay,
  drawPixelText,
  GBC_HEIGHT,
  GBC_SCALE,
  GBC_WIDTH,
} from '../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../core/types';
import { CARTRIDGE_REGISTRY } from './registry';

type SystemPhase = 'POWER_OFF' | 'BOOT' | 'CAROUSEL' | 'PLAYING' | 'PAUSED';

export class GBCSystemOS {
  private phase: SystemPhase = 'POWER_OFF';
  private bootTimer = 0;
  private selectedIndex = 0;
  private activeCartridge: GameCartridge | null = null;
  private pauseCursor = 0; // 0: Resume, 1: Restart, 2: Eject to Menu
  private time = 0;
  private transitionTimer = 0;

  private context: GameContext;
  private onCartridgeChanged: (cart: GameCartridge | null) => void;

  constructor(
    context: GameContext,
    options: {
      onCartridgeChanged: (cart: GameCartridge | null) => void;
    }
  ) {
    this.context = context;
    this.onCartridgeChanged = options.onCartridgeChanged;
  }

  isPoweredOn(): boolean {
    return this.phase !== 'POWER_OFF';
  }

  getSelectedCartridge(): GameCartridge {
    return CARTRIDGE_REGISTRY[this.selectedIndex];
  }

  powerOn(): void {
    if (this.phase !== 'POWER_OFF') return;
    this.phase = 'BOOT';
    this.bootTimer = 1.65;
    this.context.audio.playBootChime();
    this.context.storage.unlockAchievement('first-boot');
    this.onCartridgeChanged(this.getSelectedCartridge());
  }

  returnToCarousel(): void {
    if (this.activeCartridge?.cleanup) {
      this.activeCartridge.cleanup();
    }
    this.activeCartridge = null;
    this.phase = 'CAROUSEL';
    this.transitionTimer = 0.25;
    this.context.audio.startBGM('menu');
    this.onCartridgeChanged(this.getSelectedCartridge());
  }

  launchCartridgeById(id: string): void {
    const idx = CARTRIDGE_REGISTRY.findIndex((c) => c.id === id);
    if (idx === -1) return;
    this.selectedIndex = idx;
    if (this.phase === 'POWER_OFF') {
      this.powerOn();
    }
    this.launchSelectedCartridge();
  }

  launchSelectedCartridge(): void {
    if (this.activeCartridge?.cleanup) {
      this.activeCartridge.cleanup();
    }
    const cart = CARTRIDGE_REGISTRY[this.selectedIndex];
    this.activeCartridge = cart;
    this.phase = 'PLAYING';
    this.transitionTimer = 0.3;
    this.context.storage.recordGameLaunch(cart.id, cart.title);
    cart.init(this.context);
    this.onCartridgeChanged(cart);
  }

  update(dt: number, input: InputState): void {
    this.time += dt;
    if (this.transitionTimer > 0) {
      this.transitionTimer = Math.max(0, this.transitionTimer - dt);
    }

    if (this.phase === 'POWER_OFF') {
      return;
    }

    if (this.phase === 'BOOT') {
      this.bootTimer -= dt;
      if (this.bootTimer <= 0 || input.justPressed.a || input.justPressed.start) {
        this.phase = 'CAROUSEL';
        this.context.audio.startBGM('menu');
      }
      return;
    }

    if (this.phase === 'CAROUSEL') {
      if (input.justPressed.left || input.justPressed.up) {
        this.selectedIndex =
          (this.selectedIndex + CARTRIDGE_REGISTRY.length - 1) % CARTRIDGE_REGISTRY.length;
        this.context.audio.playMenuMove();
        this.onCartridgeChanged(this.getSelectedCartridge());
      } else if (input.justPressed.right || input.justPressed.down) {
        this.selectedIndex = (this.selectedIndex + 1) % CARTRIDGE_REGISTRY.length;
        this.context.audio.playMenuMove();
        this.onCartridgeChanged(this.getSelectedCartridge());
      } else if (input.justPressed.a || input.justPressed.start) {
        this.context.audio.playMenuSelect();
        this.launchSelectedCartridge();
      }
      return;
    }

    if (this.phase === 'PAUSED') {
      if (input.justPressed.select || input.justPressed.b) {
        this.context.audio.playMenuBack();
        this.phase = 'PLAYING';
        return;
      }
      if (input.justPressed.up && this.pauseCursor > 0) {
        this.pauseCursor--;
        this.context.audio.playMenuMove();
      } else if (input.justPressed.down && this.pauseCursor < 3) {
        this.pauseCursor++;
        this.context.audio.playMenuMove();
      } else if (input.justPressed.a || input.justPressed.start) {
        this.context.audio.playMenuSelect();
        if (this.pauseCursor === 0) {
          this.phase = 'PLAYING';
        } else if (this.pauseCursor === 1) {
          this.activeCartridge?.init(this.context);
          this.phase = 'PLAYING';
        } else if (this.pauseCursor === 2) {
          this.returnToCarousel();
        } else if (this.pauseCursor === 3) {
          this.phase = 'PLAYING';
          this.context.openRomFilePicker();
        }
      }
      return;
    }

    if (this.phase === 'PLAYING' && this.activeCartridge) {
      // Pressing SELECT opens the Console Pause / Eject Menu
      if (input.justPressed.select) {
        this.context.audio.playMenuMove();
        this.pauseCursor = 0;
        this.phase = 'PAUSED';
        return;
      }
      this.context.storage.recordPlayTime(this.activeCartridge.id, dt);
      this.activeCartridge.update(dt, input);
    }
  }

  /**
   * Handles direct touch/click on the 3D Game Boy LCD screen (in 160x144 coordinates).
   * Returns true if the tap was consumed by the OS or active cartridge menu/profile screen.
   */
  handleScreenTap(gbcX: number, gbcY: number): boolean {
    if (this.phase === 'POWER_OFF') {
      this.powerOn();
      return true;
    }
    if (this.phase === 'BOOT') {
      this.phase = 'CAROUSEL';
      this.context.audio.startBGM('menu');
      return true;
    }
    if (this.phase === 'CAROUSEL') {
      if (gbcX < 28 && gbcY >= 18 && gbcY <= 102) {
        this.selectedIndex =
          (this.selectedIndex + CARTRIDGE_REGISTRY.length - 1) % CARTRIDGE_REGISTRY.length;
        this.context.audio.playMenuMove();
        this.onCartridgeChanged(this.getSelectedCartridge());
      } else if (gbcX > 132 && gbcY >= 18 && gbcY <= 102) {
        this.selectedIndex = (this.selectedIndex + 1) % CARTRIDGE_REGISTRY.length;
        this.context.audio.playMenuMove();
        this.onCartridgeChanged(this.getSelectedCartridge());
      } else {
        this.context.audio.playMenuSelect();
        this.launchSelectedCartridge();
      }
      return true;
    }
    if (this.phase === 'PAUSED') {
      if (gbcY >= 45 && gbcY < 108) {
        this.pauseCursor = Math.max(0, Math.min(3, Math.floor((gbcY - 46) / 14)));
      }
      this.context.audio.playMenuSelect();
      if (this.pauseCursor === 0) {
        this.phase = 'PLAYING';
      } else if (this.pauseCursor === 1) {
        this.activeCartridge?.init(this.context);
        this.phase = 'PLAYING';
      } else if (this.pauseCursor === 2) {
        this.returnToCarousel();
      } else if (this.pauseCursor === 3) {
        this.phase = 'PLAYING';
        this.context.openRomFilePicker();
      }
      return true;
    }
    if (this.phase === 'PLAYING' && this.activeCartridge?.onScreenTap) {
      return this.activeCartridge.onScreenTap(gbcX, gbcY);
    }
    return false;
  }

  renderToScreenCanvas(ctx: CanvasRenderingContext2D): void {
    const fullW = GBC_WIDTH * GBC_SCALE;
    const fullH = GBC_HEIGHT * GBC_SCALE;

    ctx.save();
    ctx.scale(GBC_SCALE, GBC_SCALE);

    if (this.phase === 'POWER_OFF') {
      ctx.fillStyle = '#18201b';
      ctx.fillRect(0, 0, GBC_WIDTH, GBC_HEIGHT);
      drawPixelText(ctx, 'POWER OFF', 80, 64, { color: '#2b3830', size: 7, align: 'center' });
    } else if (this.phase === 'BOOT') {
      this.renderBootScreen(ctx);
    } else if (this.phase === 'CAROUSEL') {
      this.renderCarouselMenu(ctx);
    } else if ((this.phase === 'PLAYING' || this.phase === 'PAUSED') && this.activeCartridge) {
      this.activeCartridge.render(ctx);
      if (this.phase === 'PAUSED') {
        this.renderPauseOverlay(ctx);
      }
    }

    // Scanline transition wipe (sadok.mx style)
    if (this.transitionTimer > 0) {
      const ratio = this.transitionTimer / 0.3;
      ctx.fillStyle = '#0f1110';
      for (let y = 0; y < GBC_HEIGHT; y += 8) {
        ctx.fillRect(0, y, GBC_WIDTH, Math.ceil(ratio * 8));
      }
    }

    ctx.restore();
    drawLCDSubpixelOverlay(ctx, fullW, fullH);
  }

  private renderBootScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#f8f8f0';
    ctx.fillRect(0, 0, GBC_WIDTH, GBC_HEIGHT);

    const progress = Math.min(1, (1.65 - this.bootTimer) / 1.0);
    const sweepX = Math.floor(progress * 150);

    // Rainbow GBC boot letters
    const colors = ['#e83058', '#9048d8', '#48c838', '#f8b818', '#2898e8'];
    const word = 'GAME BOY';
    for (let i = 0; i < word.length; i++) {
      const lx = 24 + i * 14;
      const col = lx <= sweepX ? colors[i % colors.length] : '#d8d8d0';
      drawPixelText(ctx, word[i], lx, 56, { color: col, size: 12, shadow: '#181818' });
    }

    if (progress > 0.65) {
      drawPixelText(ctx, 'POCKET ARCADE DX', 80, 82, {
        color: '#203848',
        size: 6,
        align: 'center',
      });
    }
  }

  private renderCarouselMenu(ctx: CanvasRenderingContext2D): void {
    const cart = CARTRIDGE_REGISTRY[this.selectedIndex];
    const hiScore = this.context.storage.getHighScore(cart.id);

    // Dark retro OS background
    ctx.fillStyle = '#121620';
    ctx.fillRect(0, 0, GBC_WIDTH, GBC_HEIGHT);

    // Top Header Bar
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(0, 0, GBC_WIDTH, 16);
    drawPixelText(ctx, 'SELECT GAME PAK', 6, 5, { color: '#f8e048', size: 5 });
    drawPixelText(
      ctx,
      `${this.selectedIndex + 1}/${CARTRIDGE_REGISTRY.length}`,
      154,
      5,
      { color: '#98b8d8', size: 5, align: 'right' }
    );

    // Physical Cartridge Shell Preview Card in Center
    const cardX = 12;
    const cardY = 21;
    const cardW = 136;
    const cardH = 78;

    // Left / Right Carousel Arrows
    const arrowBounce = Math.round(Math.sin(this.time * 6) * 1.2);
    drawPixelText(ctx, '<', 3 - arrowBounce, 56, { color: '#f8e048', size: 8 });
    drawPixelText(ctx, '>', 151 + arrowBounce, 56, { color: '#f8e048', size: 8 });

    // Cartridge Outer Plastic Shell
    ctx.fillStyle = cart.cartridgeColor;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.strokeStyle = '#f8f8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);

    // Cartridge Top Grip Ribs
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(cardX + 12, cardY + 3, cardW - 24, 5);

    // Inner Label Sticker
    ctx.fillStyle = cart.labelColor;
    ctx.fillRect(cardX + 6, cardY + 11, cardW - 12, cardH - 16);
    ctx.strokeStyle = cart.accentColor;
    ctx.strokeRect(cardX + 6.5, cardY + 11.5, cardW - 13, cardH - 17);

    // Animated Game Preview Icon (36x32)
    cart.renderPreviewIcon(ctx, cardX + 10, cardY + 18, 36, 32, this.time);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(cardX + 9.5, cardY + 17.5, 37, 33);

    // Title, Subtitle, Genre & High Score on Label
    const titleSize = cart.title.length > 16 ? 3.5 : cart.title.length > 14 ? 4.2 : 4.6;
    drawPixelText(ctx, cart.title, cardX + 51, cardY + 18, { color: '#ffffff', size: titleSize });
    const subSize = cart.subtitle.length > 18 ? 3.5 : 4;
    drawPixelText(ctx, cart.subtitle, cardX + 51, cardY + 28, {
      color: cart.accentColor,
      size: subSize,
    });

    const badgeW = Math.max(38, Math.round(cart.genre.length * 4.4 + 8));
    ctx.fillStyle = cart.accentColor;
    ctx.fillRect(cardX + 51, cardY + 37, badgeW, 9);
    drawPixelText(ctx, cart.genre, cardX + 51 + Math.round(badgeW / 2), cardY + 39, {
      color: '#101418',
      size: 4,
      align: 'center',
    });

    drawPixelText(ctx, `BEST: ${hiScore}`, cardX + 51, cardY + 50, { color: '#f8e048', size: 4 });

    // Description & Launch Prompt Box at Bottom
    drawGBCBox(ctx, 4, 103, 152, 37, { bg: '#182030', borderOuter: cart.accentColor, borderInner: '#384868' });
    const [desc1, desc2] = this.wrapTextTwoLines(cart.description, 32);
    drawPixelText(ctx, desc1, 80, 108, { color: '#d8e4f0', size: 4, align: 'center' });
    if (desc2) {
      drawPixelText(ctx, desc2, 80, 116, { color: '#d8e4f0', size: 4, align: 'center' });
    }

    const blink = Math.floor(this.time * 3.5) % 2 === 0;
    drawPixelText(ctx, blink ? 'PRESS A / START TO PLAY!' : 'D-PAD: BROWSE CARTRIDGES', 80, 128, {
      color: blink ? '#58f888' : '#f8e048',
      size: 5,
      align: 'center',
    });
  }

  private wrapTextTwoLines(text: string, maxChars: number): [string, string] {
    const words = text.split(' ');
    let line1 = '';
    let line2 = '';
    for (const word of words) {
      const candidate = line1 ? `${line1} ${word}` : word;
      if (candidate.length <= maxChars && !line2) {
        line1 = candidate;
      } else {
        const candidate2 = line2 ? `${line2} ${word}` : word;
        if (candidate2.length <= maxChars) {
          line2 = candidate2;
        }
      }
    }
    return [line1, line2];
  }

  private renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(10, 14, 18, 0.78)';
    ctx.fillRect(0, 0, GBC_WIDTH, GBC_HEIGHT);

    drawGBCBox(ctx, 18, 26, 124, 92, { bg: '#18202c', borderOuter: '#f8e048' });
    drawPixelText(ctx, 'SYSTEM PAUSED', 80, 34, { color: '#f8e048', size: 6, align: 'center' });

    const items = ['RESUME GAME', 'RESTART CART', 'CHANGE GAME PAK', 'LOAD .GB/.GBC ROM'];
    items.forEach((label, idx) => {
      const y = 52 + idx * 14;
      const sel = idx === this.pauseCursor;
      if (sel) {
        drawPixelText(ctx, '>', 26, y, { color: '#58f888', size: 5 });
      }
      drawPixelText(ctx, label, 36, y, { color: sel ? '#ffffff' : '#98a8b8', size: 4.8 });
    });
  }
}
