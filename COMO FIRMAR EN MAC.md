# Cómo firmar y notarizar Mediflashy para macOS

Sin tener una Mac. Se compila, firma y notariza en un runner de GitHub, igual que
Convertexto y Flashcards 1.1. El certificado de Apple es el mismo: no hay que sacar
uno nuevo.

El runbook completo de la firma está en la bóveda de Obsidian, en la nota
`Convertexto — Firma y notarización Apple`. Acá van sólo las diferencias de
Mediflashy.

---

## El repositorio es PÚBLICO, y lo que se vende va cifrado

`frann-ayb/mediflashy-mac`, **público**: sólo los repos públicos tienen minutos de
macOS sin límite. En uno privado se descuentan 10 veces y no alcanzan.

Un repo público tiene dos problemas, y los dos se resuelven con
`scripts/contenido-cifrado.mjs` (AES-256-GCM):

1. **El código lleva el producto.** El mazo (`src/main/services/mazosDeRegalo.ts`) y
   el contenido del bonus (`scripts/lib/mapa-grupos.mjs`) NO se suben: están en el
   `.gitignore`. En el repo sólo está su versión cifrada, en `contenido-cifrado/`. El
   workflow la descifra antes de compilar, y antes verifica que los originales no se
   hayan colado en el repositorio.
2. **Cualquiera puede bajar los artefactos de un repo público.** Un `.dmg` suelto
   sería la app entera, gratis. Por eso el workflow los sube **sellados** (`.mfenc`)
   y se abren en la máquina de desarrollo:
   ```bash
   node scripts/contenido-cifrado.mjs abrir mediflashy-mac-entrega.mfenc <carpeta>
   ```

La clave vive en `firma-apple/mediflashy-contenido.key` (en el Escritorio, fuera del
repo) y en el secret `MEDIFLASHY_CONTENIDO_KEY`. **Si se pierde, no se puede
descifrar nada**: hay que generar una nueva y volver a cifrar.

**Después de tocar el mazo o el bonus, siempre `npm run contenido:cifrar`.** El build
de Mac compila con lo cifrado: si no se vuelve a cifrar, Mac sale con el mazo viejo.
`npm run build:win` corre `contenido:verificar` primero y corta si quedó
desactualizado.

Qué más NO se sube (lo cuida el `.gitignore`): instaladores (`*.exe`, `*.dmg`), la
carpeta `Mediflashy - Entregables/`, `release/`, `resources/llm/` (se baja en el
build), `.ref/` y el PDF del Goodman & Gilman (derechos de autor), `.qa/`,
`recursos-docs/` (se genera) y cualquier material de firma. Antes del primer push:

```bash
git status --short     # ni .exe, ni .dmg, ni Entregables, ni .ref, ni mazosDeRegalo.ts
git ls-files | wc -l   # alrededor de 142 archivos
```

Lo que SÍ queda a la vista: el código de la app, los scripts, las guías de uso y los
datos de contacto del vendedor que figuran en el contrato. Ninguna tarjeta del mazo.

---

## Los siete secretos

| Secret | De dónde sale |
|---|---|
| `CSC_LINK` | `developerID.p12.b64` (una sola línea) |
| `CSC_KEY_PASSWORD` | `p12-password.txt` |
| `CSC_NAME` | el Common Name **sin** `Developer ID Application: ` → `NOMBRE (TEAMID)` |
| `APPLE_ID` | el Apple ID del certificado |
| `APPLE_APP_SPECIFIC_PASSWORD` | `apple-app-specific-password.txt`, formato `xxxx-xxxx-xxxx-xxxx` |
| `APPLE_TEAM_ID` | el Team ID, 10 caracteres |
| `MEDIFLASHY_CONTENIDO_KEY` | `mediflashy-contenido.key`: la clave del contenido y de los artefactos |

Todo vive en la carpeta `firma-apple` del Escritorio, **fuera del repositorio**. Los
secretos de GitHub son por repositorio y de sólo escritura: los de `flashcards-mac`
no pasan a éste, y no sirven de copia de seguridad.

Se cargan con un script que lee esos archivos en memoria, valida el formato de cada
valor (un salto de línea pegado rompe notarytool sin decirlo), los encripta con la
clave pública del repo y no imprime ningún valor. Los secretos de un repo público no
los ve nadie: ni quien lee el repo ni un fork.

**Cuidado con `CSC_NAME`:** si arranca con `Developer ID Application: `,
electron-builder corta. El workflow lo verifica al principio sin imprimirlo.

---

## Primera corrida: validar la firma

`Actions → Compilar para Mac → Run workflow`, con **`armar_entrega` en `false`**.

Firma y notariza de verdad los dos `.dmg` (Apple Silicon e Intel). El artefacto se
llama **`mediflashy-mac-prueba`** y viene sellado.

### Qué mirar en el log

El paso **"Qué firma quedó, en las dos arquitecturas"**, para cada `.app`:

```
CodeDirectory ... flags=0x10000(runtime)          ← hardened runtime
Authority=Developer ID Application: ...
Authority=Developer ID Certification Authority
Authority=Apple Root CA                           ← tres autoridades
Timestamp=...                                     ← sello de tiempo
The validate action worked!                       ← ticket pegado
accepted / source=Notarized Developer ID          ← Gatekeeper
```

`rejected` con `source=Unnotarized Developer ID` = firmada pero **sin notarizar**:
faltó un secret (buscar `skipped macOS notarization`).

---

## Segunda corrida: la entrega

Con **`armar_entrega` en `true`**. Arma la carpeta con los `.dmg` renombrados y los
PDF de Mac. El artefacto se llama **`mediflashy-mac-entrega`**, viene sellado, y al
abrirlo trae la carpeta `Versión MacOs`: va dentro de `Mediflashy - Entregables`, al
lado de la de Windows, reemplazando la que tiene el aviso de `FALTA`.

---

## Probar en Mac sin tener una

`Actions → Probar en Mac`: abre el artefacto sellado, monta el `.dmg`, lo copia a
`/Applications` con la cuarentena real de Safari, le exige a Gatekeeper que acepte,
arranca el motor, verifica que no dependa de Homebrew, que la app abra y que siembre
las 56 unidades en `~/Library/Application Support/Mediflashy`.

**Tampoco prueba que una generación termine** ni que el uso real ande bien: eso
necesita una Mac de verdad.

---

## Si algo falla

| Síntoma | Causa |
|---|---|
| `MAC verification failed during PKCS12 import` | `.p12` con los defaults de OpenSSL 3 |
| build en verde, `.dmg` sin notarizar | falta un secret: buscar `skipped macOS notarization` |
| `unable to build chain to self-signed root` | al `.p12` le falta el intermedio |
| `Please remove prefix "Developer ID Application:"` | `CSC_NAME` tiene el prefijo |
| `does not have the hardened runtime enabled` | un binario que no tomó el hardened runtime |
| la app abre **en blanco** | falta `allow-jit` en `entitlements.mac.inherit.plist` |
| `a sealed resource is missing or invalid` | algo modificó el bundle después de firmar |
| notarytool devuelve 403 y habla de contratos | falta aceptar un acuerdo del Developer Program |
| `No se pudo descifrar: la clave no es la correcta` | el secret `MEDIFLASHY_CONTENIDO_KEY` no es el del archivo local |
| `está en el repositorio SIN cifrar` | se commiteó el mazo original: hay que sacarlo del historial |

Si Apple rechaza el envío, el paso `if: failure()` le pide a `notarytool` el log: es
el único lugar donde figura el archivo culpable.
