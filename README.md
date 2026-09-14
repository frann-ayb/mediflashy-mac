# Mediflashy

Estudiá Farmacología con repaso espaciado, 100 % en tu computadora.

Trae 1.881 tarjetas de Farmacología, repartidas en 13 materias de 4 carreras de la
salud, listas para el primer día, y
además convierte tus propios apuntes en tarjetas nuevas.

Cargás un apunte (PDF, Word, PowerPoint o texto pegado), un modelo de IA que corre
en tu propia máquina arma las tarjetas, las revisás, y a partir de ahí un sistema
de repaso espaciado te va mostrando qué sabés, qué no y qué te falta reforzar.

Nada sale de tu computadora: ni los apuntes, ni las tarjetas, ni tu progreso.

---

## Cómo se relaciona con Convertexto

Es una **app hermana**, no una versión ni una pestaña. Comparte el núcleo técnico
—el motor de IA local, la descarga de modelos, el troceado de texto, la
persistencia— y no comparte absolutamente nada más: distinto `appId`, distinto
nombre, distinta carpeta de datos.

El núcleo está **copiado**, no extraído a un paquete compartido. La razón es que
Convertexto ya está vendido e instalado en máquinas de compradores: si el motor
viviera en una dependencia común, un cambio hecho para Mediflashy podría romperlo
sin que nadie se entere hasta que llegue un mail de soporte.

La disciplina de esa copia la pone `npm run sync:core`, que compara los archivos
del core contra los originales de Convertexto y avisa si divergieron.

```
npm run sync:core         # ¿cambió algo en Convertexto desde la última vez?
npm run sync:core-write   # después de traer un cambio a mano, fijar la nueva base
```

Los archivos bajo `src/main/services/core/` **no se editan sin pensar**: cada uno
está adaptado a mano desde Convertexto (nombres, mensajes al usuario, algún
parámetro) y esas adaptaciones están documentadas en el propio archivo.

### La trampa que hay que conocer

`APP_FOLDER` en [`paths.ts`](src/main/services/core/paths.ts) dice `'Mediflashy'` y
**no puede decir `'Transcriptor2'`**. Convertexto declara
`deleteAppDataOnUninstall: true`: si las dos apps compartieran carpeta,
desinstalar Convertexto le borraría al usuario todas sus materias, sus tarjetas y
meses de repasos. El comentario del archivo lo explica en detalle.

---

## Poner a andar el proyecto

```
npm install          # baja llama.cpp para tu plataforma (postinstall)
npm run dev          # la app en modo desarrollo
```

Si `npm install` no dejó el binario de Electron (pasa en Windows cuando el
`postinstall` anidado se saltea):

```
node node_modules/electron/install.js
```

El **modelo de IA no viaja en el repositorio ni en el instalador**: se descarga la
primera vez que se generan tarjetas (1,3 GB el Rápido, 2,7 GB el Detallado). Si ya
tenés Convertexto con su modelo bajado, Flashcards lo usa de ahí y no descarga
nada — sólo lectura, nunca escribe ni borra en la carpeta de la otra app.

---

## Cómo está armado

```
src/main/services/
├─ core/          copiado de Convertexto, adaptado a mano
│  llamaServer    el motor: llama.cpp como subproceso, con salida forzada por esquema
│  genModels      catálogo, descarga y reutilización del modelo de Convertexto
│  chunker        corta el apunte en bloques que entren en el contexto
│  anchor         verifica que cada cita exista de verdad en el texto
│  paths · config · logger · errors · fsutil · download · platform
├─ ingest/        NUEVO: pdf · docx · pptx · texto plano
├─ generator.ts   NUEVO: el gemelo de summarizer.ts, sin el reduce
├─ deckStore.ts   NUEVO: materias, unidades y tarjetas
├─ searchIndex.ts NUEVO: el buscador, en memoria
├─ scheduler.ts   NUEVO: FSRS
├─ reviewLog.ts   NUEVO: el historial de repasos
├─ studySession.ts NUEVO: la sesión y los topes diarios
└─ stats.ts       NUEVO: cuánto sabe el usuario
```

### Las decisiones que conviene conocer antes de tocar nada

- **El mini-prompt no se guarda en ningún lado.** Lo que el usuario escribe para
  guiar la generación vive en el estado de `App.tsx` mientras la app está abierta,
  viaja como parámetro de la generación, y muere ahí. No va a la configuración, no
  va a disco, **no va al log**. Hay una prueba automática que lo verifica.
- **El texto del apunte tampoco se guarda.** Se extrae, se muestra para revisar, se
  genera, y se descarta.
- **Ninguna tarjeta se guarda sin que una persona la haya visto.** La pantalla de
  revisión no es burocracia: un modelo de 2B produce alguna tarjeta con un error
  sutil, y esas tarjetas después se memorizan para un final.
- **Editar una tarjeta no resetea su progreso.** La app no puede distinguir "corregí
  una coma" de "cambié la pregunta entera", así que no decide: hay un botón
  explícito para reiniciar.
- **Los archivos se llaman por id, no por nombre.** Es lo que hace que renombrar sea
  editar un campo y que "Anatomía I: cabeza y cuello" sea un nombre válido.

---

## Pruebas

```
npm run typecheck            # los tres lados del contrato de shared/types.ts
npm run qa                   # los arneses de lógica, en cadena
npm run qa:ui                # la app REAL, manejada por CDP de punta a punta
npm run qa:vista             # capturas de los dos temas + contraste + desbordes
npm run qa:libre             # el repaso libre no toca el calendario
npm run qa:entrega           # el entregable en una máquina sin Node
npm run qa:generacion-real   # generación con el modelo de verdad
```

| Arnés | Qué verifica |
|---|---|
| `qa/datos.ts` | CRUD de los tres niveles, cascadas, escritura atómica, buscador, archivos rotos |
| `qa/scheduler.ts` | FSRS, espaciado creciente, topes diarios por materia, el día que empieza a las 4 AM |
| `qa/ingesta.ts` | Los cuatro formatos, PDF escaneado, UTF-16, troceado |
| `qa/generacion.ts` | El anclaje de citas (la defensa anti-alucinación). Con `--real`, el modelo |
| `qa/ui.mjs` | La app real: puente, CRUD desde la interfaz, sesión de estudio, y que el mini-prompt no toque el disco |
| `qa/vista.mjs` | Captura cada pantalla en 940×660 y 1280×860, y detecta desbordes |
| `qa/entrega.mjs` | El .exe de la carpeta de entregables, copiado a otra carpeta y corrido **sin Node en el PATH** |

Los arneses corren contra carpetas temporales, nunca contra los datos del usuario.
`qa/ui.mjs` usa el **modo portable** para lograrlo, así que de paso lo ejercita.

### Lo que las pruebas automáticas NO cubren

Estas cosas hay que mirarlas a mano antes de una entrega:

1. **Los diálogos nativos de confirmación** (borrar una materia, borrar una unidad,
   borrar un modelo). `dialog.showMessageBoxSync` bloquea el proceso principal y con
   él el canal de CDP, así que el arnés no puede tocarlos: se cuelga. Verificado.
2. **Instalar Convertexto y Flashcards juntos, y desinstalar Convertexto.** Los mazos
   de Flashcards tienen que seguir ahí. Es la verificación de la trampa de `APP_FOLDER`.
3. **La ventana en 940×660**, que es el mínimo: ningún modal se puede pasar de alto.
4. **Un PDF real de la facultad a dos columnas**: que el aviso aparezca y que la
   pantalla de revisión deje arreglar el texto.
5. **En macOS**, `npm run verify:firma-mac` tiene que dar limpio y `spctl` no debe
   decir "Unnotarized Developer ID".

---

## Empaquetar

```
npm run build:unpacked   # para probar rápido, sin instalador
npm run build:win        # NSIS + portable
npm run build:mac        # dmg arm64 + x64, firmado y notarizado
```

`verify:binaries` corre antes de empaquetar y **corta el build** si el motor no
está completo. Es a propósito: un instalador sin motor abre igual, deja estudiar y
sólo falla al generar tarjetas — o sea, en la computadora del comprador.

Para macOS hacen falta `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID`
en el entorno, más el certificado Developer ID en el llavero. `build:mac` termina
con `verify:firma-mac`, que es el que realmente corta si algo quedó sin firmar o sin
notarizar: electron-builder, si no encuentra el certificado, sólo escribe un warning
y sigue de largo dejando una app sin firmar.

Sin ffmpeg ni whisper el instalador pesa **115 MB**, contra los 149 MB de
Convertexto 3.0.0 (medido, no estimado). La diferencia es menor de lo que parece
porque lo que pesa es Electron, no los motores: 225 MB sólo el ejecutable.

---

## La cadena de entrega

```
npm run make:pdfs    # imprime las guías del comprador a PDF
npm run drive        # arma "Mediflashy - Entregables/" (incluye make:bonus y make:pdfs)
```

```
Mediflashy - Entregables/
├─ Versión Windows/
│  ├─ 1. LEEME PRIMERO.pdf
│  ├─ 2. Mediflashy - Instalador Windows.exe
│  ├─ 3. Mediflashy - Portable, sin instalar (Windows).exe
│  ├─ 4. Ayuda y solución de problemas.txt
│  ├─ 5. Licencias de los componentes.txt
│  ├─ 6. Licencia de uso.txt
│  └─ 7. Requisitos y funciones.txt
└─ Versión MacOs/
   ├─ 1. LEEME PRIMERO.txt
   ├─ 2. Flashcards - Mac con chip M1 M2 M3 M4.dmg
   ├─ 3. Flashcards - Mac con procesador Intel.dmg
   └─ (los mismos cuatro textos)
```

**Cada subcarpeta es una entrega completa e independiente**, y eso no es sólo
comodidad: los textos se generan por plataforma. El comprador de Windows no baja
115 MB de `.dmg` que no le sirven ni lee cómo se instala en Mac, y —lo que más
importa— **recibe el contrato que describe SU copia**: la cláusula 11.9 se apoya en
la firma de Apple, que sólo existe en la versión de Mac.

Si todavía no se compiló en una Mac, la carpeta se arma igual con sus textos y deja
adentro un archivo explicando qué falta y cómo completarlo. `npm run drive` en la
Mac lo borra solo.

`drive` **corta el build** si los instaladores de `release/` son más viejos que el
código compilado. Pasó de verdad: la entrega salió con un `.exe` anterior a un
cambio de interfaz y sólo lo agarró `qa:entrega`, que abre el ejecutable y mira la
pantalla.

Los textos salen de [`scripts/lib/user-docs.mjs`](scripts/lib/user-docs.mjs), que
es **el de Convertexto adaptado**. La estructura se conservó entera —los mismos
documentos, la misma numeración, el mismo tono, la misma lógica condicional por
plataforma— porque ya está probada contra compradores reales. Lo que cambió es el
contenido del producto.

El **contrato se reutiliza casi textual**, y no por pereza: su cláusula 1.4 declara
que identifica al Software *por su origen y no por su nombre*, y que alcanza a
cualquier programa que el Licenciante entregue "bajo el mismo nombre comercial o
bajo otro distinto". Está escrito para servir a más de un producto del mismo
vendedor. Lo que sí se reescribió son las cláusulas que describen QUÉ HACE el
programa (8, 9 y 11.11), porque ahí dejar el texto viejo sería una declaración
falsa en un contrato.

### Tres cosas que cambiaron respecto de Convertexto, y por qué

**`deleteAppDataOnUninstall` está en `false`.** En Convertexto está en `true` y
está bien: lo que se borra son modelos redescargables y transcripciones ya
exportadas. Acá se borrarían las materias, las tarjetas y meses de repasos, que no
existen en ningún otro lado. Ahora el desinstalador **pregunta primero** y, si el
usuario dice que no, conserva sus tarjetas y borra sólo el modelo. Poner el flag en
`false` fue necesario: con `true`, electron-builder borraba la carpeta en su propia
sección y la pregunta habría sido una mentira.

**El anexo de requisitos viaja adentro del paquete.** La cláusula 11.10 define qué
es un *defecto* comparando contra ese archivo. Si el contrato viaja y su anexo no,
esa definición apunta a un documento que el comprador no tiene — y con ella se cae
la cláusula que más protege al vendedor.

**Los documentos citan los nombres correctos según dónde estén.** Adentro del
paquete el contrato se llama `LICENCIA DE USO.txt`; en la carpeta de Drive,
`6. Licencia de uso.txt`. `buildRequisitos` los tenía cableados a los de Drive, así
que la copia empaquetada mandaba al comprador a un archivo que ahí no existe.

---

## Los mazos que la app trae de fábrica

Al abrirse por primera vez, la app carga **1.881 tarjetas** repartidas en **13
materias** de **4 carreras** de la salud y 48 unidades, todas de Farmacología. El
contenido está en
[src/main/services/mazosDeRegalo.ts](src/main/services/mazosDeRegalo.ts) y la
siembra la hace `sembrarSiEstaVacio()` en `deckStore`, llamada desde el arranque.

Los números están fijados en tres lugares que tienen que coincidir, y
[qa/siembra.ts](qa/siembra.ts) lo verifica: las constantes `TARJETAS_DE_REGALO` y
`MATERIAS_DE_REGALO` del módulo, lo que efectivamente se siembra en disco, y el
número que publica la landing. Si alguien agrega una tarjeta y no toca la
página, queda una promesa incumplida en el sitio que cobra.

**Por qué existe.** Sin esto, el comprador instala, abre y se encuentra una
biblioteca vacía: para ver funcionar lo que pagó tiene que conseguir un apunte,
elegir un nivel y esperar entre 1,3 y 2,7 GB de descarga del modelo. Ese primer
día es donde se pierde a la mayoría de los compradores de cualquier producto, y
acá el pozo es especialmente hondo por culpa de la descarga. Con los mazos
cargados abre la app, toca Estudiar y está estudiando; el motor de IA ni siquiera
hace falta.

**Cuándo NO siembra**, que es lo que importa: si hay una materia, aunque sea una;
si hay una unidad suelta; o si la escritura falla, en cuyo caso la app abre igual
y el error queda en el registro. Nunca pisa nada de nadie.

El contenido salió de los mismos cuatro apuntes que se entregan con la compra
(`recursos-bonus/`), y cada tarjeta se revisó contra ese texto. Se regenera con
el arnés `qa/siembra.ts`.

**Dos cosas que se aprendieron armándolos:**

El filtro anti-repetidas de `saveCards` se comió tres tarjetas en silencio: se
declaraban 82 y se sembraban 79. Los frentes que chocaban eran "artículo 19"
contra "artículo 31", "diputado" contra "senador" y "transporte pasivo" contra
"transporte activo" — se parecen más del 85 % y para el filtro son la misma
tarjeta. Y el filtro tiene razón: dos preguntas que se diferencian en una palabra
también las confunde el que estudia. Se reformularon los frentes, no el umbral.
`qa/siembra.ts` verifica esto con `isDuplicate`, el mismo criterio de la app, y
no con una comparación de igualdad, que fue lo que dejó pasar el problema.

La landing publica el número de tarjetas. `qa/siembra.ts` lee `ar.html` y corta si
dejó de coincidir: si alguien agrega o saca una tarjeta y no toca la página de
venta, queda una promesa incumplida en el lugar donde se cobra.

---

## Mandarle o venderle un mazo a un comprador

El comprador lo importa con el botón de la flecha hacia arriba ("Importar un mazo
desde un archivo"), arriba de la lista de materias, y las tarjetas se le suman.

1. **Armar el archivo.** Con las tarjetas escritas fuera de la app, en la misma forma
   que los lotes del mazo de fábrica:
   ```
   node scripts/armar-mazo.mjs tarjetas.json --materia "Farmacología Cardiovascular"
   ```
   Deja `mazos-para-vender/<materia>.mazo.json`. Si alguna tarjeta es más larga de lo
   que la app guarda, no escribe nada y dice cuál. También sirve exportar una materia
   desde la app (el botón de descarga de cada materia): el archivo es el mismo.
2. **Probarlo.** Importarlo una vez en la app y mirar dos o tres tarjetas.
3. **Mandarlo.** Por mail o Drive, tal cual.

Lo que viaja: la materia, sus unidades en orden, y de cada tarjeta el frente, el dorso
con sus renglones, el tipo y **la fuente**. Lo que NO viaja: el progreso de estudio.
Al importar, la app pregunta en qué carrera va si el comprador está viendo todas; si
ya tiene una materia con ese nombre, pregunta si sumar o crear aparte; y nunca
duplica una tarjeta que ya estaba. `qa/mazos.ts` prueba la ida y la vuelta y
`qa/entrega.mjs` hace el recorrido entero en el `.exe` que se entrega.

---

## Lo que falta

- [ ] **Compilar y firmar en una Mac.** Es lo único que no se puede hacer desde
      Windows. Todo lo demás está configurado y verificado contra el release real de
      llama.cpp: entitlements recortados (sin micrófono), `mac.binaries` apuntando a
      los dos `llama-server`, `extraResources` por plataforma, y `setupMac()` en
      `fetch-llama.mjs` — que descarga los `.tar.gz` correctos, no los `.zip` que no
      existen, y recrea los symlinks de los `.dylib` en vez de duplicarlos.

      En la Mac:
      ```
      npm install
      npm run build:mac     # firma y notariza; termina en verify:firma-mac
      npm run drive         # completa "Versión MacOs" y borra el archivo de FALTA
      npm run qa:entrega    # el .dmg, verificado como lo recibe el comprador
      ```

- [ ] **Revisar el contrato con un abogado.** Se adaptó el de Convertexto con
      criterio, pero las cláusulas 8, 9 y 11.11 se reescribieron y describen un
      producto distinto.

- [ ] **Probar el INSTALADOR** (no sólo el portable) en una máquina limpia, y
      especialmente el desinstalador: tiene que preguntar antes de borrar las
      tarjetas. Eso abre un diálogo nativo y no se puede automatizar.

---

## Repaso de calidad antes del build de Mac

Se hizo una pasada completa sobre el flujo buscando huecos. Lo que salió, y qué se
hizo con cada cosa:

**Pérdida de datos.** Las tarjetas recién generadas vivían en `GenerarView`, que se
desmonta al cambiar de pestaña: un click en "Biblioteca" borraba dos minutos de
generación sin aviso. Ahora el estado vive en `App`, la pestaña "Generar" muestra un
punto mientras haya algo sin guardar, y cerrar la app con tarjetas pendientes
pregunta primero.

**Duplicados.** El generador deduplicaba dentro de una corrida pero no contra lo ya
guardado. Generar dos veces del mismo apunte —el caso más normal: te quedaste corto
y volvés con la densidad en "Muchas"— dejaba el mazo lleno de pares idénticos, para
siempre. Ahora `saveCards` descarta lo que ya está y dice cuántas salteó.

**Tres cosas que la documentación prometía y no existían.** El instructivo dice
"tocá el ícono de la hoja de papel" para encontrar el registro, y el contrato pide
adjuntarlo a cualquier reclamo: ese botón no existía. El anexo dice "copiá la
carpeta de datos" y no había forma de encontrarla. Y `hideOnboarding` era un campo
de configuración que nadie leía, o sea que no había pantalla de bienvenida.

**El estado vacío empujaba al paso equivocado.** Decía "Crear mi primera materia",
que es el paso 2. Nadie abre esta app para crear una materia vacía. Ahora manda a
generar —donde se pueden crear la materia y la unidad ahí mismo— y deja la opción
manual como enlace secundario. De paso, el buscador ya no ocupa el lugar más visible
de la pantalla cuando no hay nada que buscar.

**Dos bombas en el empaquetado.** `extraResources` copiaba la carpeta `llm` entera,
así que el instalador de Windows se habría llevado los binarios de macOS y al revés;
ahora va filtrado por plataforma. Y el primer intento de compartir los documentos
entre plataformas usó un ancla de YAML sobre una secuencia, que produce una lista
anidada: eso habría roto el build de Mac. Se detectó parseando el YAML antes de
compilar.

**Instaladores viejos en la entrega.** `npm run drive` sólo copia lo que encuentra
en `release/`, sin saber de cuándo es. La entrega salió una vez con un `.exe`
anterior a un cambio de interfaz y sólo lo agarró `qa:entrega`, que abre el
ejecutable y mira la pantalla. Ahora `drive` corta si los instaladores son más
viejos que el código compilado.

## Ideas que quedaron anotadas

- Importar desde Anki (`.apkg`) o desde una planilla. Hoy sólo entra el formato propio.
- Reordenar materias y unidades arrastrando. El backend ya tiene `reorder`.
- Que la unidad seleccionada sobreviva a cambiar de sección.
