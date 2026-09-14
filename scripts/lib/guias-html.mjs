import { APP_NAME } from './user-docs.mjs'

/**
 * El aspecto de las guías en PDF.
 *
 * ---------------------------------------------------------------------------
 * Por qué existen los PDF además de los .txt
 * ---------------------------------------------------------------------------
 *
 * Los .txt son honestos y se abren en cualquier lado, pero un manual de doce
 * páginas en monoespaciado con cajas de guiones se lee como un archivo de
 * sistema, no como algo que alguien escribió para vos. El comprador acaba de
 * pagar; lo primero que abre no puede parecer un README de 1998.
 *
 * Los documentos LEGALES no pasan por acá y se quedan en .txt a propósito: la
 * licencia y el anexo de requisitos son parte del contrato, y su formato ya
 * está acordado. Acá sólo entran las guías.
 *
 * ---------------------------------------------------------------------------
 * La paleta
 * ---------------------------------------------------------------------------
 *
 * Es la del tema CLARO de la app, tomada de `src/renderer/src/index.css`. Sobre
 * papel no hay tema oscuro que valga: un PDF oscuro se imprime en negro sólido
 * y se lee peor en pantalla que uno claro. Y los tonos son literalmente los
 * mismos porque el que abre el PDF acaba de ver la app, o está por verla.
 *
 * ---------------------------------------------------------------------------
 * Tipografía
 * ---------------------------------------------------------------------------
 *
 * Fuentes del sistema y nada más. El PDF se genera sin internet y con una
 * política de seguridad que no deja traer nada de afuera, así que una fuente de
 * Google se caería en silencio a la fuente por defecto — que es exactamente el
 * aspecto que esto viene a evitar. Segoe UI Variable en Windows, San Francisco
 * en Mac, y una cadena de respaldo detrás.
 */

/** Escapa para HTML. Todo el contenido pasa por acá. */
const e = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * Marcado mínimo dentro de un párrafo: **negrita** y `literal`.
 *
 * Se escapa PRIMERO y se marca después, así un `<` en el texto no puede abrir
 * una etiqueta. Es el orden que importa: al revés, cualquier texto del usuario
 * podría inyectar HTML en el documento.
 */
const rico = (s) =>
  e(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')

const ESTILOS = `
:root{
  --tinta:#0C1A18;
  --tinta-2:#3D5551;
  --tinta-3:#4F6A65;
  --marca:#0F7A6C;
  --marca-honda:#0A5F53;
  --marca-suave:#E8F4F1;
  --papel:#FFFFFF;
  --panel:#F2F7F5;
  --linea:#CDDEDA;
  --linea-fuerte:#A8C0BB;
  --bien:#14703A;
  --ojo:#8A5804;
  --mal:#BE2828;
}

*{box-sizing:border-box}

@page{
  size:A4;
  margin:17mm 16mm 20mm 16mm;
}

body{
  margin:0;
  background:var(--papel);
  color:var(--tinta-2);
  font-family:'Segoe UI Variable Text','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;
  font-size:10.4pt;
  line-height:1.62;
  -webkit-font-smoothing:antialiased;
}

/* ── La portada ────────────────────────────────────────────────────────── */

.tapa{
  /* Ocupa la primera página entera y empuja el contenido a la siguiente. Sin
     el break-after, el índice se le sube al lado del título y la portada deja
     de leerse como portada. */
  break-after:page;
  min-height:246mm;
  display:flex;
  flex-direction:column;
  justify-content:center;
  padding:0 4mm;
}
.tapa-marca{display:flex;align-items:center;gap:10px;margin-bottom:auto;padding-top:6mm}
.tapa-marca img{width:34px;height:34px;border-radius:9px}
.tapa-marca span{font-size:12pt;font-weight:700;color:var(--tinta);letter-spacing:-.01em}

.tapa-kicker{
  font-size:8.2pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--marca);margin-bottom:9mm;
}
.tapa h1{
  font-size:33pt;line-height:1.1;margin:0 0 7mm;color:var(--tinta);
  font-weight:700;letter-spacing:-.025em;max-width:15em;text-wrap:balance;
}
.tapa-bajada{font-size:12.5pt;line-height:1.55;color:var(--tinta-2);max-width:26em;margin:0}
.tapa-regla{width:64px;height:4px;background:var(--marca);border-radius:2px;margin:0 0 9mm}
.tapa-pie{margin-top:auto;padding-bottom:6mm;font-size:8.6pt;color:var(--tinta-3);border-top:1px solid var(--linea);padding-top:4mm}

/* ── El índice ─────────────────────────────────────────────────────────── */

.indice{
  background:var(--panel);border:1px solid var(--linea);border-radius:12px;
  padding:7mm 8mm;margin:0 0 9mm;break-inside:avoid;
}
.indice h2{font-size:9pt;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--marca);margin:0 0 4mm}
.indice ol{margin:0;padding:0;list-style:none;counter-reset:ix}
.indice li{
  counter-increment:ix;position:relative;padding-left:9mm;margin:0 0 2.1mm;
  font-size:10pt;color:var(--tinta);
}
.indice li::before{
  content:counter(ix);position:absolute;left:0;top:.05em;
  width:6mm;text-align:right;font-weight:700;color:var(--marca);font-variant-numeric:tabular-nums;
}

/* ── Las secciones ─────────────────────────────────────────────────────── */

section{margin:0 0 8mm}
section.corte{break-before:page}

h2.sec{
  display:flex;align-items:baseline;gap:9px;
  font-size:16.5pt;line-height:1.25;color:var(--tinta);font-weight:700;
  letter-spacing:-.018em;margin:0 0 4.5mm;padding-bottom:3mm;
  border-bottom:2px solid var(--marca-suave);
  break-after:avoid;
}
h2.sec .n{
  flex:0 0 auto;font-size:9.5pt;font-weight:800;color:var(--marca);
  font-variant-numeric:tabular-nums;letter-spacing:.02em;
}

h3{
  font-size:11.4pt;color:var(--tinta);font-weight:700;letter-spacing:-.008em;
  margin:6mm 0 2.2mm;break-after:avoid;
}

/* Un nivel por encima de h3, para agrupar casos. En la lista de problemas hay
   cuatro grupos de cinco; sin esta distinción son veinte títulos del mismo peso
   y la lista se lee plana. */
h3.grupo{
  font-size:8.6pt;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--marca);margin:9mm 0 3.5mm;padding-bottom:2mm;
  border-bottom:1px solid var(--linea);
}

p{margin:0 0 3.2mm}
strong{color:var(--tinta);font-weight:650}
code{
  font-family:'Cascadia Mono',Consolas,'SF Mono',Menlo,monospace;
  font-size:.9em;background:var(--panel);border:1px solid var(--linea);
  border-radius:4px;padding:.5px 4px;color:var(--marca-honda);
}

/* ── Listas ────────────────────────────────────────────────────────────── */

ul.puntos{margin:0 0 3.4mm;padding:0;list-style:none}
ul.puntos li{position:relative;padding-left:6.5mm;margin:0 0 1.8mm}
ul.puntos li::before{
  content:'';position:absolute;left:1.4mm;top:.62em;
  width:4px;height:4px;border-radius:50%;background:var(--marca);
}

ol.pasos{margin:0 0 3.4mm;padding:0;list-style:none;counter-reset:pp}
ol.pasos li{
  counter-increment:pp;position:relative;padding-left:9.5mm;margin:0 0 2.6mm;
  break-inside:avoid;
}
ol.pasos li::before{
  content:counter(pp);position:absolute;left:0;top:.06em;
  width:6mm;height:6mm;border-radius:7px;
  background:var(--marca);color:#fff;
  font-size:8.4pt;font-weight:700;line-height:6mm;text-align:center;
  font-variant-numeric:tabular-nums;
}

/* ── Definiciones ──────────────────────────────────────────────────────── */

dl.defs{margin:0 0 3.6mm;padding:0}
dl.defs > div{
  display:grid;grid-template-columns:34% 1fr;gap:0 5mm;
  padding:2.4mm 0;border-bottom:1px solid var(--linea);break-inside:avoid;
}
dl.defs > div:last-child{border-bottom:0}
dl.defs dt{font-weight:650;color:var(--tinta);margin:0}
dl.defs dd{margin:0;color:var(--tinta-2)}

/* ── Avisos ────────────────────────────────────────────────────────────── */

.aviso{
  border-left:3px solid var(--marca);
  background:var(--panel);
  border-radius:0 10px 10px 0;
  padding:4mm 5mm;margin:0 0 4mm;break-inside:avoid;
}
.aviso .tt{
  display:block;font-size:8.4pt;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--marca);margin-bottom:1.6mm;
}
.aviso p:last-child{margin-bottom:0}
.aviso.ojo{border-left-color:var(--ojo);background:#FBF6EA}
.aviso.ojo .tt{color:var(--ojo)}
.aviso.clave{border-left-color:var(--bien);background:#EDF6F0}
.aviso.clave .tt{color:var(--bien)}
.aviso.alto{border-left-color:var(--mal);background:#FBEFEF}
.aviso.alto .tt{color:var(--mal)}

/* ── Bien y mal, lado a lado ───────────────────────────────────────────── */

.contraste{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:0 0 4mm;break-inside:avoid}
.contraste > div{border-radius:10px;padding:3.6mm 4mm;border:1px solid var(--linea)}
.contraste .mal{background:#FBEFEF;border-color:#EBC9C9}
.contraste .bien{background:#EDF6F0;border-color:#C3E0CE}
.contraste .et{
  display:block;font-size:8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  margin-bottom:1.8mm;
}
.contraste .mal .et{color:var(--mal)}
.contraste .bien .et{color:var(--bien)}
.contraste p{margin:0 0 1.6mm;font-size:9.6pt;line-height:1.5}
.contraste p:last-child{margin-bottom:0}

/* ── Tabla ─────────────────────────────────────────────────────────────── */

table{
  width:100%;border-collapse:collapse;margin:0 0 4mm;font-size:9.7pt;
  break-inside:avoid;
}
thead th{
  text-align:left;font-size:8.3pt;font-weight:700;letter-spacing:.09em;
  text-transform:uppercase;color:var(--marca);
  padding:0 4mm 2mm 0;border-bottom:2px solid var(--marca-suave);
}
tbody td{padding:2.4mm 4mm 2.4mm 0;border-bottom:1px solid var(--linea);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
tbody td:first-child{font-weight:650;color:var(--tinta);white-space:nowrap}
td.num{font-variant-numeric:tabular-nums;white-space:nowrap}

/* ── Tarjeta de ejemplo, con la pinta de la app ────────────────────────── */

.mazo{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin:0 0 4mm;break-inside:avoid}
.ficha{
  border:1px solid var(--linea-fuerte);border-radius:12px;padding:4mm 4.5mm;
  background:var(--papel);
}
.ficha.dorso{background:var(--marca);border-color:var(--marca);color:#fff}
.ficha .cara{
  display:block;font-size:7.8pt;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;color:var(--tinta-3);margin-bottom:2mm;
}
.ficha.dorso .cara{color:#B9E5DD}
.ficha p{margin:0;font-size:10.2pt;line-height:1.5;color:var(--tinta)}
.ficha.dorso p{color:#fff}

/* ── Cierre ────────────────────────────────────────────────────────────── */

.cierre{
  margin-top:9mm;padding:5mm 6mm;border-radius:12px;
  background:var(--marca);color:#fff;break-inside:avoid;
}
.cierre h3{color:#fff;margin:0 0 2mm;font-size:12pt}
.cierre p{color:#DCF0EC;margin:0 0 2mm}
.cierre p:last-child{margin-bottom:0}
.cierre a,.cierre strong{color:#fff}

/* Un texto de ancho cómodo: pasadas las 90 caracteres el ojo pierde el
   renglón al volver, y estas guías se leen enteras. */
section > p,section > ul,section > ol,section > dl{max-width:44em}
`

/* ------------------------------ los bloques ------------------------------ */

function bloque(b) {
  switch (b.t) {
    case 'p':
      return `<p>${rico(b.x)}</p>`

    case 'grupo':
      return `<h3 class="grupo">${rico(b.x)}</h3>`

    case 'h':
      return `<h3>${rico(b.x)}</h3>`

    case 'lista':
      return `<ul class="puntos">${b.x.map((i) => `<li>${rico(i)}</li>`).join('')}</ul>`

    case 'pasos':
      return `<ol class="pasos">${b.x.map((i) => `<li>${rico(i)}</li>`).join('')}</ol>`

    case 'defs':
      return `<dl class="defs">${b.x
        .map(([t, d]) => `<div><dt>${rico(t)}</dt><dd>${rico(d)}</dd></div>`)
        .join('')}</dl>`

    case 'aviso':
      return `<div class="aviso ${b.tono ?? ''}">${b.titulo ? `<span class="tt">${e(b.titulo)}</span>` : ''}${(Array.isArray(b.x) ? b.x : [b.x]).map((p) => `<p>${rico(p)}</p>`).join('')}</div>`

    case 'contraste':
      return `<div class="contraste"><div class="mal"><span class="et">${e(b.etMal ?? 'Así no')}</span>${(Array.isArray(b.mal) ? b.mal : [b.mal]).map((p) => `<p>${rico(p)}</p>`).join('')}</div><div class="bien"><span class="et">${e(b.etBien ?? 'Así sí')}</span>${(Array.isArray(b.bien) ? b.bien : [b.bien]).map((p) => `<p>${rico(p)}</p>`).join('')}</div></div>`

    case 'tabla':
      return `<table><thead><tr>${b.cab.map((c) => `<th>${e(c)}</th>`).join('')}</tr></thead><tbody>${b.filas
        .map((f) => `<tr>${f.map((c, i) => `<td${i > 0 && /^[\d~<>.,\s]+$/.test(String(c)) ? ' class="num"' : ''}>${rico(c)}</td>`).join('')}</tr>`)
        .join('')}</tbody></table>`

    case 'ficha':
      return `<div class="mazo"><div class="ficha"><span class="cara">${e(b.caraFrente ?? 'Frente')}</span><p>${rico(b.frente)}</p></div><div class="ficha dorso"><span class="cara">${e(b.caraDorso ?? 'Dorso')}</span><p>${rico(b.dorso)}</p></div></div>`

    case 'cierre':
      return `<div class="cierre">${b.titulo ? `<h3>${rico(b.titulo)}</h3>` : ''}${(Array.isArray(b.x) ? b.x : [b.x]).map((p) => `<p>${rico(p)}</p>`).join('')}</div>`

    default:
      throw new Error(`Bloque desconocido en una guía: "${b.t}"`)
  }
}

/**
 * Arma el HTML completo de una guía.
 *
 * `logo` es un data URI del ícono. Va incrustado y no como archivo suelto
 * porque el HTML se escribe en una carpeta temporal y se imprime desde ahí: una
 * ruta relativa a `build/icon.png` no existiría en ese contexto y el PDF
 * saldría con el hueco de una imagen rota.
 */
export function guiaAHtml(doc, { logo = '', version = '' } = {}) {
  const secciones = doc.secciones
    .map((s, i) => {
      const cuerpo = s.bloques.map(bloque).join('\n')
      const titulo = s.titulo
        ? `<h2 class="sec"><span class="n">${String(i + 1).padStart(2, '0')}</span>${rico(s.titulo)}</h2>`
        : ''
      return `<section${s.corte ? ' class="corte"' : ''}>${titulo}\n${cuerpo}</section>`
    })
    .join('\n\n')

  const indice = doc.secciones.some((s) => s.titulo)
    ? `<div class="indice"><h2>Lo que vas a encontrar</h2><ol>${doc.secciones
        .filter((s) => s.titulo)
        .map((s) => `<li>${e(s.titulo)}</li>`)
        .join('')}</ol></div>`
    : ''

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${e(doc.titulo)}</title><style>${ESTILOS}</style></head>
<body>
<div class="tapa">
  <div class="tapa-marca">${logo ? `<img src="${logo}" alt="">` : ''}<span>${e(APP_NAME)}</span></div>
  <div>
    ${doc.kicker ? `<div class="tapa-kicker">${e(doc.kicker)}</div>` : ''}
    <h1>${e(doc.titulo)}</h1>
    <div class="tapa-regla"></div>
    <p class="tapa-bajada">${rico(doc.bajada)}</p>
  </div>
  <div class="tapa-pie">${e(doc.pie ?? `${APP_NAME} ${version}`)}</div>
</div>

${indice}

${secciones}
</body></html>`
}

export { ESTILOS }
