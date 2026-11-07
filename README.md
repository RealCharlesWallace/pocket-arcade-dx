# Pocket Arcade DX — 3D Game Boy Color Web Arcade

An interactive 3D handheld game console inspired by [sadok.mx](https://sadok.mx/) and [italianbrawls.it](https://italianbrawls.it/), built with **Vite + TypeScript + Three.js**.

## Play Locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` in your browser.

---

## Free Hosting on GitHub Pages (Step-by-Step)

Because this project is 100% client-side (no backend database or paid server required), **GitHub Pages** will host it for free at `https://<your-username>.github.io/<repo-name>/`.

A GitHub Actions deployment workflow is already pre-configured in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) and [`vite.config.ts`](vite.config.ts) is set to `base: './'`.

### 1. Initialize Git & Push to a New GitHub Repo
Run these commands inside `/Users/charleswallace/Coding-Local/Phone Games`:
```bash
git init
git add .
git commit -m "Initial commit: Pocket Arcade DX 3D Game Boy Color"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

### 2. Enable GitHub Pages (Actions Source)
1. Open your repository on GitHub.
2. Go to **Settings** → **Pages** (in the left sidebar).
3. Under **Build and deployment** → **Source**, select **GitHub Actions**.
4. Within ~60 seconds, the `Deploy to GitHub Pages` workflow will finish and publish your live URL!

---

## How to Add a New Game Later

1. Create a new file `src/games/<your-game>/index.ts` that exports a `GameCartridge` object (implementing `init`, `update`, `render`, and `renderPreviewIcon`).
2. Register it in [`src/games/registry.ts`](src/games/registry.ts) by adding it to `CARTRIDGE_REGISTRY`.
3. It will automatically appear in the 3D Game Boy's Cartridge Carousel and the Library Dialog!
