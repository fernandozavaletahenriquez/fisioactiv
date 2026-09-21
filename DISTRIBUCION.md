# Distribución FisioActiv

## Publicar en Render.com (auto-deploy con cada push a master)

Repo: https://github.com/fernandozavaletahenriquez/fisioactiv

### Configuración una sola vez

1. Entra a [https://dashboard.render.com](https://dashboard.render.com) e inicia sesión (con GitHub).
2. Autoriza el acceso a tus repos si te lo pide.
3. Pulsa **New +** → **Static Site**.
4. Elige el repositorio **fernandozavaletahenriquez/fisioactiv**.
5. Completa:

| Campo | Valor |
|--------|--------|
| Name | `fisioactiv` |
| Branch | `master` |
| Build Command | `npm ci && npm run build:web` |
| Publish Directory | `www` |
| Auto-Deploy | **Yes** (On Commit) |

6. En **Redirects/Rewrites** → Add:

| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | **Rewrite** |

7. Pulsa **Create Static Site**.

Render construirá el proyecto (~2–5 min). Al terminar verás una URL tipo:

**https://fisioactiv.onrender.com**

### Cómo funciona lo “dinámico”

- Haces cambios en el código.
- `git push origin master`
- Render detecta el push, vuelve a hacer build y actualiza el sitio solo.

No hace falta volver a configurar nada.

### Alternativa: Blueprint

**New + → Blueprint** → selecciona el mismo repo. Usará el archivo `render.yaml` (ya incluye `branch: master` y auto-deploy).

---

## Laptops Windows → instalador `.exe`

```powershell
cd c:\Users\Tismart\Project\Freelance\fisioactiv\fisioactiv
nvm use 22.22.3
npm run dist:win
```

Archivos en `release\`:

- `FisioActiv-1.0.0-win-x64.exe` — instalador
- `FisioActiv-1.0.0-portable.exe` — portable

---

## Android → APK

```powershell
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
