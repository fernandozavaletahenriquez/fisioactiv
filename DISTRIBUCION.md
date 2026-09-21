# Distribución FisioActiv

## Publicar en Render.com (enlace público)

Tu cuenta de GitHub de empresa **no permite crear repos** desde aquí. Para Render necesitas un repo Git (puede ser **privado**) en una cuenta personal de GitHub o GitLab.

### Paso A — Subir el código a GitHub (cuenta personal)

1. Entra a [https://github.com/new](https://github.com/new) con una cuenta **personal** (no la de Belcorp si está bloqueada).
2. Crea el repo `fisioactiv` (privado o público).
3. En PowerShell:

```powershell
cd c:\Users\Tismart\Project\Freelance\fisioactiv\fisioactiv
git remote remove origin 2>$null
git remote add origin https://github.com/TU_USUARIO/fisioactiv.git
git push -u origin master
```

(Sustituye `TU_USUARIO` por tu usuario de GitHub.)

### Paso B — Conectar Render

1. Entra a [https://dashboard.render.com](https://dashboard.render.com) y crea cuenta (puedes usar GitHub).
2. **New + → Blueprint**  
   - O **New + → Static Site**
3. Autoriza y elige el repo `fisioactiv`.
4. Si usas Blueprint, Render leerá `render.yaml` solo.
5. Si lo creas a mano como Static Site:

| Campo | Valor |
|--------|--------|
| Name | `fisioactiv` |
| Build Command | `npm ci && npm run build:web` |
| Publish Directory | `www` |
| Node Version | `22` |

6. En **Redirects/Rewrites** agrega (SPA Angular):

| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | Rewrite |

7. **Create Static Site** / Deploy.

Al terminar tendrás algo como:

**https://fisioactiv.onrender.com**

Ese enlace es HTTPS: la cámara funciona. Comparte el link con tus trabajadores (Chrome).

> Nota: en el plan gratuito, Render puede “dormir” el sitio tras inactividad; el primer acceso tarda ~30–60 s en despertar.

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

Luego en Android Studio: Build APK.
