import {
  drawGBCBox,
  drawPixelText,
} from '../../core/pixel-renderer';
import type { GameCartridge, GameContext, InputState } from '../../core/types';

interface TrafficCar {
  z: number; // 0..100 distance ahead
  laneX: number; // -0.7 .. 0.7
  speed: number;
  color: string;
}

const state = {
  ctx: null as unknown as GameContext,
  distance: 0,
  speed: 0,
  playerX: 0, // -1 .. 1
  score: 0,
  timeLeft: 45,
  nextCheckpointDist: 800,
  nitroFuel: 100,
  cars: [] as TrafficCar[],
  gameOver: false,
  time: 0,
};

export const streetRacerCartridge: GameCartridge = {
  id: 'street-racer',
  title: 'STREET RACER GBC',
  subtitle: 'OUTRUN HORIZON',
  genre: 'RACING',
  description: 'Blaze down a pseudo-3D sunset highway, hit Nitro Boost, dodge rival traffic, and beat checkpoints!',
  cartridgeColor: '#20a888',
  labelColor: '#182030',
  accentColor: '#f85898',

  renderPreviewIcon(ctx, x, y, w, h, time) {
    // Sunset horizon + sports car tail lights
    ctx.fillStyle = '#381848';
    ctx.fillRect(x, y, w, Math.floor(h / 2));
    ctx.fillStyle = '#f86838';
    ctx.fillRect(x + 10, y + 6, 16, 10);
    ctx.fillStyle = '#383848';
    ctx.fillRect(x, y + Math.floor(h / 2), w, Math.ceil(h / 2));

    const bob = Math.round(Math.sin(time * 10));
    ctx.fillStyle = '#f82838';
    ctx.fillRect(x + 8, y + 20 + bob, 20, 7);
    ctx.fillStyle = '#f8e838';
    ctx.fillRect(x + 10, y + 22 + bob, 4, 3);
    ctx.fillRect(x + 22, y + 22 + bob, 4, 3);
  },

  init(context: GameContext) {
    state.ctx = context;
    resetRace();
    context.audio.startBGM('racer');
  },

  update(dt: number, input: InputState) {
    state.time += dt;

    if (state.gameOver) {
      if (input.justPressed.a || input.justPressed.start) {
        state.ctx.audio.playMenuSelect();
        resetRace();
      }
      return;
    }

    // Acceleration & Nitro Boost (A = Nitro/Gas, B = Brake, Auto-accelerate when held or cruising)
    const usingNitro = input.held.a && state.nitroFuel > 0;
    const maxSpd = usingNitro ? 240 : 165;
    if (usingNitro) {
      state.nitroFuel = Math.max(0, state.nitroFuel - 28 * dt);
    } else {
      state.nitroFuel = Math.min(100, state.nitroFuel + 10 * dt);
    }

    if (input.held.b) {
      state.speed = Math.max(0, state.speed - 180 * dt);
    } else {
      state.speed = Math.min(maxSpd, state.speed + (usingNitro ? 140 : 85) * dt);
    }

    // Road curvature pull
    const curve = Math.sin(state.distance * 0.008) * 0.65 + Math.cos(state.distance * 0.0035) * 0.45;
    state.playerX -= curve * (state.speed / 220) * 0.9 * dt;

    // Steering
    const steerSpeed = 1.65;
    if (input.held.left) state.playerX -= steerSpeed * dt;
    if (input.held.right) state.playerX += steerSpeed * dt;

    // Off-road grass slowdown
    if (Math.abs(state.playerX) > 0.95) {
      state.speed = Math.max(55, state.speed - 130 * dt);
      state.playerX = Math.max(-1.25, Math.min(1.25, state.playerX));
    }

    const distDelta = state.speed * dt;
    state.distance += distDelta;
    state.score = Math.floor(state.distance * 2);

    // Checkpoint check
    if (state.distance >= state.nextCheckpointDist) {
      state.nextCheckpointDist += 900;
      state.timeLeft = Math.min(60, state.timeLeft + 15);
      state.ctx.audio.playPowerUp();
    }

    // Traffic Cars update
    for (const car of state.cars) {
      car.z -= (state.speed - car.speed) * dt * 0.35;
      if (car.z < 0) {
        car.z = 90 + Math.random() * 35;
        car.laneX = (Math.random() * 1.2) - 0.6;
        state.score += 50;
      }

      // Collision with player near z = 6..14
      if (car.z > 4 && car.z < 14 && Math.abs(car.laneX - state.playerX) < 0.34) {
        state.speed = Math.max(30, state.speed * 0.35);
        car.z = 95;
        state.ctx.audio.playHit();
      }
    }

    state.ctx.storage.setHighScore('street-racer', state.score);

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.gameOver = true;
      state.ctx.audio.playMenuBack();
    }
  },

  render(ctx: CanvasRenderingContext2D) {
    // Synthwave Sunset Sky
    ctx.fillStyle = '#201438';
    ctx.fillRect(0, 0, 160, 32);
    ctx.fillStyle = '#582058';
    ctx.fillRect(0, 32, 160, 18);
    ctx.fillStyle = '#c84848';
    ctx.fillRect(0, 50, 160, 16);

    const curve = Math.sin(state.distance * 0.008) * 0.65 + Math.cos(state.distance * 0.0035) * 0.45;
    const sunX = 80 - curve * 18;

    // Retro Striped Sun
    ctx.fillStyle = '#f8c838';
    ctx.fillRect(Math.round(sunX - 14), 32, 28, 22);
    ctx.fillStyle = '#f86838';
    ctx.fillRect(Math.round(sunX - 14), 44, 28, 4);
    ctx.fillRect(Math.round(sunX - 14), 50, 28, 4);

    // City Silhouette on horizon
    ctx.fillStyle = '#181028';
    for (let i = 0; i < 12; i++) {
      const hx = ((i * 18 - curve * 15) % 160 + 160) % 160;
      const hh = 6 + (i % 3) * 5;
      ctx.fillRect(Math.round(hx), 66 - hh, 12, hh);
    }

    // Pseudo-3D Scanline Road (y = 66 .. 144)
    const horizonY = 66;
    const roadH = 144 - horizonY;

    for (let i = 0; i < roadH; i += 2) {
      const sy = horizonY + i;
      const p = i / roadH; // 0 at horizon, 1 at bottom
      const perspective = 0.12 + p * 0.88;

      const stripePhase = Math.floor((state.distance * 0.25) + (1 / Math.max(0.08, p)) * 6) % 2 === 0;
      const grassColor = stripePhase ? '#186838' : '#208040';
      const roadColor = stripePhase ? '#484858' : '#525264';
      const curbColor = stripePhase ? '#f83838' : '#f8f8f0';

      ctx.fillStyle = grassColor;
      ctx.fillRect(0, sy, 160, 2);

      const curveShift = Math.pow(1 - p, 2) * curve * 55;
      const roadCenter = 80 + curveShift - state.playerX * p * 54;
      const halfRoadW = perspective * 68;

      // Red/White Rumble Curbs
      ctx.fillStyle = curbColor;
      ctx.fillRect(Math.round(roadCenter - halfRoadW - 4 * perspective), sy, Math.ceil(halfRoadW * 2 + 8 * perspective), 2);

      // Asphalt
      ctx.fillStyle = roadColor;
      ctx.fillRect(Math.round(roadCenter - halfRoadW), sy, Math.ceil(halfRoadW * 2), 2);

      // Center Dashed Line
      if (stripePhase) {
        ctx.fillStyle = '#f8e858';
        ctx.fillRect(Math.round(roadCenter - 1), sy, 2, 2);
      }
    }

    // Draw Rival Traffic Cars (sorted far to near)
    const sortedCars = [...state.cars].sort((a, b) => b.z - a.z);
    for (const car of sortedCars) {
      if (car.z <= 2 || car.z > 90) continue;
      const p = 1 - car.z / 90;
      const sy = horizonY + p * roadH;
      const curveShift = Math.pow(1 - p, 2) * curve * 55;
      const roadCenter = 80 + curveShift - state.playerX * p * 54;
      const cx = roadCenter + car.laneX * (p * 62);
      const cw = Math.max(4, Math.round(24 * p));
      const ch = Math.max(3, Math.round(14 * p));

      ctx.fillStyle = car.color;
      ctx.fillRect(Math.round(cx - cw / 2), Math.round(sy - ch), cw, ch);
      ctx.fillStyle = '#d8f8ff';
      ctx.fillRect(Math.round(cx - cw * 0.35), Math.round(sy - ch + 2), Math.round(cw * 0.7), Math.max(1, Math.round(ch * 0.35)));
    }

    // Player Sports Car (Bottom Center)
    const carX = 66;
    const carY = 118;
    // Tires
    ctx.fillStyle = '#141418';
    ctx.fillRect(carX - 2, carY + 6, 4, 7);
    ctx.fillRect(carX + 26, carY + 6, 4, 7);
    // Body
    ctx.fillStyle = '#e82838';
    ctx.fillRect(carX, carY + 3, 28, 10);
    ctx.fillStyle = '#f85858';
    ctx.fillRect(carX + 4, carY, 20, 5);
    // Tail lights & Nitro Flame
    ctx.fillStyle = '#f8e838';
    ctx.fillRect(carX + 2, carY + 5, 4, 3);
    ctx.fillRect(carX + 22, carY + 5, 4, 3);
    if (state.speed > 180) {
      ctx.fillStyle = '#38d8f8';
      ctx.fillRect(carX + 11, carY + 12, 6, 4);
    }

    // Top HUD
    ctx.fillStyle = 'rgba(16, 16, 28, 0.82)';
    ctx.fillRect(0, 0, 160, 14);
    drawPixelText(ctx, `${Math.round(state.speed)}KMH`, 4, 4, { color: '#38e8f8', size: 5 });
    drawPixelText(ctx, `TIME:${Math.ceil(state.timeLeft)}`, 60, 4, { color: '#f8e838', size: 5 });
    drawPixelText(ctx, `${state.score}`, 156, 4, { color: '#58f888', size: 5, align: 'right' });

    if (state.gameOver) {
      drawGBCBox(ctx, 20, 48, 120, 48, { bg: '#181428', borderOuter: '#f85898' });
      drawPixelText(ctx, 'TIME UP!', 80, 56, { color: '#f85898', size: 7, align: 'center' });
      drawPixelText(ctx, `FINAL SCORE: ${state.score}`, 80, 70, { color: '#ffffff', size: 5, align: 'center' });
      drawPixelText(ctx, 'PRESS A TO RACE AGAIN', 80, 82, { color: '#58f888', size: 5, align: 'center' });
    }
  },
};

function resetRace(): void {
  state.distance = 0;
  state.speed = 60;
  state.playerX = 0;
  state.score = 0;
  state.timeLeft = 45;
  state.nextCheckpointDist = 800;
  state.nitroFuel = 100;
  state.gameOver = false;
  state.cars = [
    { z: 30, laneX: -0.35, speed: 95, color: '#38b8f8' },
    { z: 60, laneX: 0.35, speed: 105, color: '#f8c828' },
    { z: 85, laneX: 0.0, speed: 110, color: '#58e868' },
  ];
}
