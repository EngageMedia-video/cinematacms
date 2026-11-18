# Cinemata mediacms-frontend

## **Requirements**

- Node.js **26** (see `.nvmrc`)
- the npm version that `packageManager` declares in `package.json`

---

## Pre-installation

This pre-installation refers to specific sub-packages within the folder, namely `packages/media-player`, `packages/vjs-plugin`, `packages/vjs-plugin-font-icons`, and `packages/ejs-compiled-loader`. The pre-installation will be done for all of them.

1. For all folders (`/packages/media-player`, `/packages/vjs-plugin`, `/packages/vjs-plugin-font-icons`, `/packages/ejs-compiled-loader`), using the Terminal, execute `npm install` to install their respective dependencies.

2. After these dependencies are installed, as indicated by the presence of `node_modules/` in each folder, proceed to execute `npm run build` to create the `/dist` folder for each subfolder.

> [!WARN]
> Make sure that the `/dist` folders for all packages (`vjs-plugin`, `media-player`, `vjs-plugin-font-icons`, and `ejs-compiled-loader`) have their respective `.css` and `.js` files. This will be important for the installation, development, and build steps listed below.

---

## **Installation**

    npm install

---

## **Development**

    npm run dev

Open in browser: [localhost:5173](http://localhost:5173)

- Django app still runs separately in local development. See `docs/technical/FRONTEND_WORKFLOW.md` for full workflow.

## **Storybook**

Run isolated shared-component workbench from `frontend/`:

    npm run storybook

Build static Storybook:

    npm run build-storybook

Run shared component tests:

    npm run test:components

Shared reusable primitives live in `src/features/shared/components/`. Keep stories colocated with components as `*.stories.jsx`.

---

## **Build**

    npm run build

Generates the folder "**_build/production_**".

---

## **Transfer files into backend/server (django root)**

You can either:

1. Manually copy files and folders:
   - from "**_build/production/_**" into "**_static/_**"

2. Or run the collectstatic command:

    ```bash
    python manage.py collectstatic --noinput

    # or with uv:
    uv run manage.py collectstatic --noinput
    ```
