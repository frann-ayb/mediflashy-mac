/**
 * Los cuatro apuntes de arranque, de Psicología.
 *
 * ---------------------------------------------------------------------------
 * Para qué existen
 * ---------------------------------------------------------------------------
 *
 * La app ya viene con 1.507 tarjetas cargadas, así que el comprador puede
 * estudiar el primer día sin tocar nada. Lo que NO puede hacer sin material
 * propio es probar la generación, que es la mitad del producto. Estos cuatro
 * apuntes son eso: texto listo para copiar y pegar en la pestaña Generar y ver
 * el circuito completo en cinco minutos.
 *
 * ---------------------------------------------------------------------------
 * Por qué son de Psicología y antes no lo eran
 * ---------------------------------------------------------------------------
 *
 * La versión anterior traía Anatomía, Derecho Constitucional, Biología celular
 * e Inglés técnico, heredados del producto general del que salió Psicoflashy.
 * En un producto de nicho eso es peor que un detalle: el comprador acaba de
 * pagar por algo hecho para su carrera y lo primero que abre habla de huesos.
 *
 * Las cuatro materias elegidas son las más universales entre planes de estudio
 * distintos, y las cuatro dan buenas tarjetas por el mismo motivo: están llenas
 * de pares de conceptos que se confunden, que es exactamente lo que el repaso
 * espaciado resuelve mejor.
 *
 * ---------------------------------------------------------------------------
 * Los números del instructivo NO son estimaciones
 * ---------------------------------------------------------------------------
 *
 * `tarjetas` y `tiempo` son lo que el encabezado le promete al comprador. Los
 * mide `qa/bonus.ts` generando de verdad con cada apunte, en las dos densidades
 * que puede llegar a elegir. Si acá dice veinticinco y salen cinco, el comprador
 * cree que la app le falló. Al cambiar un cuerpo hay que volver a correr ese
 * arnés y actualizar estos dos campos con lo que midió.
 */

export const APUNTES_PSICO = [
  {
    archivo: '1. Psicoanálisis (Freud) — apunte de arranque.txt',
    titulo: 'PSICOANÁLISIS I — FREUD',
    materia: 'Psicoanálisis I — Freud',
    unidad: 'Unidad 1 — El aparato psíquico',
    tarjetas: 15,
    tiempo: 'unos tres minutos',
    cuerpo: `APUNTE DE PSICOANÁLISIS I — FREUD


INTRODUCCIÓN: EL DESCUBRIMIENTO DEL INCONSCIENTE

El psicoanálisis nace como método de investigación de los procesos anímicos
inconscientes, como técnica de tratamiento de las neurosis y como cuerpo de
conocimientos que de allí se desprende. Freud abandona la hipnosis y llega a
la regla fundamental de la asociación libre: el paciente dice todo lo que se
le ocurra, sin selección ni crítica. Lo inconsciente no es aquello de lo que
uno simplemente no se acuerda, sino un sistema regido por leyes propias y
mantenido fuera de la conciencia por una fuerza activa que Freud llama
represión. La prueba de su existencia es indirecta: se lo infiere por sus
efectos, las llamadas formaciones del inconsciente.


LA PRIMERA TÓPICA

En la primera tópica Freud distingue tres sistemas. El inconsciente reúne
representaciones a las que la conciencia no tiene acceso; se rige por el
proceso primario, donde la energía circula libremente, no hay contradicción,
ni negación, ni tiempo, y sólo cuenta la búsqueda de satisfacción. El
preconsciente contiene lo que no está actualmente en la conciencia pero puede
volverse consciente sin obstáculo; se rige por el proceso secundario, ligado
al lenguaje y a la demora de la descarga. La conciencia es un sistema
perceptivo, momentáneo, que Freud nunca considera el centro de la vida
anímica. Entre inconsciente y preconsciente opera una censura. Conviene
distinguir el inconsciente como sistema, con sus contenidos reprimidos, del
inconsciente como mero adjetivo descriptivo de lo que no es consciente en un
momento dado.


LA SEGUNDA TÓPICA

A partir de 1923 Freud propone una segunda tópica que no anula la primera
sino que se superpone a ella. El ello es el polo pulsional, totalmente
inconsciente, reservorio de las pulsiones, sin organización ni juicio. El yo
se constituye por diferenciación del ello por influjo del mundo exterior;
opera como mediador entre las exigencias del ello, las del superyó y las de
la realidad, y buena parte de él es inconsciente, precisamente sus defensas.
El superyó es el heredero del complejo de Edipo: resulta de la identificación
con las figuras parentales y funciona como instancia crítica, observadora e
ideal. Distinguir yo de superyó es central: el yo defiende y adapta, el
superyó juzga y castiga, y su severidad explica el sentimiento inconsciente
de culpa.


LA REPRESIÓN Y OTROS MECANISMOS DE DEFENSA

La represión consiste en rechazar y mantener alejada de la conciencia una
representación ligada a la pulsión. Freud diferencia la represión primaria,
que instaura lo inconsciente por fijación de una representación que nunca fue
consciente, de la represión secundaria o esfuerzo de dar caza, que actúa
sobre retoños asociados a esa primera. Todo lo reprimido tiende a retornar:
el retorno de lo reprimido se produce en el síntoma. Conviene no confundir
tres operaciones. La represión es propia de la neurosis y recae sobre la
representación, cuyo afecto se transforma o se desplaza. La negación es una
manera de tomar noticia de lo reprimido bajo forma negativa: el contenido
llega a la conciencia a condición de ser negado, de modo que hay un
levantamiento intelectual de la represión sin aceptación de lo reprimido. La
desmentida, propia de la perversión y presente en la psicosis, recae sobre
una percepción de la realidad y convive con su reconocimiento, produciendo
una escisión del yo. Otros mecanismos son la formación reactiva, la anulación
de lo acontecido, el aislamiento, la proyección y la vuelta contra la propia
persona.


EL SUEÑO Y EL TRABAJO DEL SUEÑO

El sueño es el cumplimiento disfrazado de un deseo inconsciente y la vía
regia hacia el inconsciente. Hay que separar el contenido manifiesto, que es
el sueño tal como el soñante lo recuerda y relata, de los pensamientos
oníricos latentes, que son el deseo y las ideas que la interpretación
reconstruye a partir de las asociaciones. El trabajo del sueño es el proceso
que transforma lo latente en manifiesto, y no al revés. Sus operaciones son
la condensación, por la cual un elemento manifiesto reúne varios latentes; el
desplazamiento, que corre el acento psíquico de lo importante a lo nimio para
burlar la censura; el miramiento por la figurabilidad, que traduce los
pensamientos en imágenes; y la elaboración secundaria, que da al sueño una
apariencia coherente.


ACTOS FALLIDOS Y SÍNTOMA

Los actos fallidos, entre ellos el olvido de nombres, los lapsus y el
extravío de objetos, no son fallas sino actos logrados de otra intención: hay
una interferencia entre un propósito consciente y otro perturbador
inconsciente. Junto con el sueño, el chiste y el síntoma constituyen las
formaciones del inconsciente. El síntoma es una formación de compromiso entre
la moción pulsional que pugna por satisfacerse y la defensa que se le opone,
y por eso brinda una satisfacción sustitutiva, deformada y displacentera.


LA PULSIÓN

La pulsión es un concepto fronterizo entre lo anímico y lo somático, un
representante psíquico de los estímulos internos. Se define por cuatro
términos: el esfuerzo o empuje, factor motor y constante de la pulsión; la
fuente, el proceso somático en un órgano cuyo estímulo es representado en la
vida anímica; el objeto, lo más variable, aquello en lo cual la pulsión puede
alcanzar su meta; y el fin o meta, que es siempre la satisfacción por
cancelación del estado de estimulación. En la primera teoría Freud opone
pulsiones sexuales y pulsiones de autoconservación o yoicas; en la segunda,
de 1920, opone pulsiones de vida y pulsión de muerte.


SERIES COMPLEMENTARIAS, EDIPO Y TRANSFERENCIA

Las series complementarias explican la etiología de la neurosis sin optar
entre lo hereditario y lo vivencial: se combinan la constitución sexual, las
vivencias infantiles y el factor desencadenante actual, de modo que cuanto
más pesa un término menos hace falta del otro. La libido atraviesa fases de
organización: oral, anal, fálica, un período de latencia y la fase genital de
la pubertad. El complejo de Edipo es el conjunto de deseos amorosos y
hostiles hacia los padres; en el varón declina por la amenaza de castración y
en la niña el complejo de castración lo introduce. La transferencia es la
actualización en la cura de mociones inconscientes dirigidas a la persona del
analista; es a la vez el mayor obstáculo y el principal instrumento del
tratamiento, y su manejo distingue al psicoanálisis de la sugestión.
`
  },

  {
    archivo: '2. Psicología del Desarrollo — apunte de arranque.txt',
    titulo: 'PSICOLOGÍA DEL DESARROLLO',
    materia: 'Psicología del Desarrollo',
    unidad: 'Unidad 1 — Las grandes teorías',
    tarjetas: 25,
    tiempo: 'unos cuatro o cinco minutos',
    cuerpo: `PSICOLOGÍA DEL DESARROLLO: APUNTE DE ESTUDIO


INTRODUCCIÓN

La psicología del desarrollo estudia los cambios psicológicos a lo largo
del ciclo vital. Las cuatro teorías que siguen ordenan el campo clásico y
suelen tomarse juntas en los exámenes, porque explican el mismo fenómeno
con supuestos distintos sobre qué mueve el desarrollo.


PIAGET: LA EPISTEMOLOGÍA GENÉTICA

Para Piaget la inteligencia es una forma de adaptación biológica. El
esquema es la unidad básica: una estructura de acción o de pensamiento
organizada y repetible, que puede generalizarse a situaciones nuevas.
Sobre el esquema operan dos procesos complementarios. La asimilación es
la incorporación de un objeto o una situación nueva a un esquema ya
existente, sin modificarlo. La acomodación es la modificación del esquema
cuando el objeto resiste a ser asimilado. La equilibración es el proceso
regulador que restablece el equilibrio entre ambas y explica el pasaje de
una estructura a otra: es el motor del desarrollo, no la maduración ni el
aprendizaje sin más.

Se distinguen cuatro estadios. El sensoriomotor, aproximadamente de cero
a dos años, en el que la inteligencia es práctica, sin representación,
y cuyo logro definitorio es la permanencia del objeto, es decir la
comprensión de que un objeto sigue existiendo aunque desaparezca del
campo perceptivo. El preoperatorio, aproximadamente de dos a siete años,
inaugurado por la función simbólica y caracterizado por el egocentrismo,
la incapacidad de descentrarse del propio punto de vista, y por la
ausencia de reversibilidad. El de las operaciones concretas,
aproximadamente de siete a once o doce años, definido por la aparición de
operaciones reversibles aplicadas a objetos presentes: allí se logra la
conservación, la comprensión de que una propiedad como la cantidad, el
peso o el volumen se mantiene invariante pese a cambios en la
configuración perceptiva. La reversibilidad es justamente la posibilidad
de anular mentalmente una transformación, y es la condición lógica de la
conservación. Por último, las operaciones formales, desde los once o doce
años, donde el razonamiento opera sobre proposiciones e hipótesis y lo
posible prevalece sobre lo real.


VYGOTSKY: LA PERSPECTIVA SOCIOHISTÓRICA

Vygotsky sostiene que las funciones psicológicas superiores tienen origen
social. La ley de doble formación enuncia que toda función aparece dos
veces: primero en el plano interpsicológico, entre personas, y luego en
el plano intrapsicológico, dentro del sujeto; el pasaje entre ambos es la
internalización. La mediación es el concepto central: la relación con el
mundo no es directa sino mediada por instrumentos. Las herramientas se
orientan hacia afuera y modifican el objeto; los signos, entre ellos el
lenguaje, se orientan hacia adentro y regulan la propia conducta. Esto es
la mediación semiótica.

La zona de desarrollo próximo es la distancia entre el nivel de
desarrollo real, definido por lo que el sujeto resuelve solo, y el nivel
de desarrollo potencial, definido por lo que resuelve con ayuda de un
adulto o de un par más capaz. La enseñanza es eficaz cuando se dirige a
esa zona y va por delante del desarrollo.


EL CONTRASTE CLÁSICO: EL HABLA EGOCÉNTRICA

Ambos autores observan el mismo fenómeno y lo interpretan al revés. Para
Piaget el habla egocéntrica no cumple función comunicativa, expresa el
egocentrismo infantil y desaparece por socialización progresiva: va de lo
individual a lo social. Para Vygotsky el habla es social desde el
origen, y el habla egocéntrica es una etapa de transición hacia el
lenguaje interior: no desaparece, se internaliza y se vuelve pensamiento
verbal. Va de lo social a lo individual.


BOWLBY Y AINSWORTH: LA TEORÍA DEL APEGO

Bowlby define el apego como un sistema conductual de base etológica cuya
función es mantener la proximidad con la figura de cuidado para obtener
protección. La figura de apego funciona como base segura para explorar.
Ainsworth diseñó la Situación Extraña, un procedimiento experimental de
episodios breves con separaciones y reencuentros entre el niño y el
cuidador, donde lo evaluado no es la angustia ante la separación sino la
conducta en el reencuentro. Se describen cuatro patrones. El seguro:
protesta ante la separación, busca al cuidador en el reencuentro, se
calma y vuelve a explorar. El inseguro evitativo: mínima protesta y
evitación activa del cuidador al reencontrarlo. El inseguro ambivalente o
resistente: angustia intensa y, en el reencuentro, búsqueda mezclada con
enojo y resistencia al contacto, sin lograr calmarse. El desorganizado,
agregado luego por Main y Solomon, sin estrategia coherente: conductas
contradictorias, congelamiento o movimientos estereotipados. La clave del
examen es que evitativo y ambivalente son estrategias organizadas,
mientras que el desorganizado es el colapso de toda estrategia.


ERIKSON: LAS ETAPAS PSICOSOCIALES

Erikson concibe el desarrollo del yo en ocho etapas que abarcan todo el
ciclo vital. Cada una plantea una crisis, entendida no como catástrofe
sino como momento decisivo en que una tensión entre dos polos opuestos
debe resolverse; de esa resolución surge una fuerza o virtud. Las cuatro
primeras son confianza básica frente a desconfianza básica, en el primer
año; autonomía frente a vergüenza y duda, hacia el segundo y tercer año;
iniciativa frente a culpa, en la etapa preescolar; e industria o
laboriosidad frente a inferioridad, durante la edad escolar. Ninguna
crisis se resuelve de una vez: se reabre ante nuevas exigencias.
`
  },

  {
    archivo: '3. Psicopatología — apunte de arranque.txt',
    titulo: 'PSICOPATOLOGÍA — SEMIOLOGÍA',
    materia: 'Psicopatología',
    unidad: 'Unidad 1 — Semiología',
    tarjetas: 18,
    tiempo: 'unos cuatro minutos',
    cuerpo: `SEMIOLOGÍA PSICOPATOLÓGICA: APUNTE DE ESTUDIO


QUÉ ESTUDIA LA SEMIOLOGÍA

La semiología psicopatológica describe y ordena los signos y síntomas de la
vida psíquica alterada; su valor está en nombrar con exactitud lo observado.


ALTERACIONES DE LA CONCIENCIA

La conciencia se evalúa como nivel de vigilancia y claridad del campo. Se
describen tres grados clásicos: la obnubilación, descenso leve o moderado de
la lucidez, con enlentecimiento y dificultad atencional; la confusión mental,
desestructuración del campo con perplejidad, desorientación, curso fluctuante
y frecuente onirismo; y el estupor, grado profundo con inmovilidad, mutismo y
escasa reactividad a los estímulos. La conciencia no es lo mismo que la
orientación: esta se explora sobre el campo de conciencia, en tiempo y espacio
(alopsíquica) y respecto de sí mismo (autopsíquica). Puede haber
desorientación con conciencia lúcida, como en los cuadros amnésicos.


ALTERACIONES DE LA PERCEPCIÓN

La ilusión es la percepción deformada de un objeto real y presente: hay
estímulo externo, y lo alterado es su elaboración. La alucinación es una
percepción sin objeto que percibir: no hay estímulo, y el sujeto la vive con
plena convicción de realidad, proyectada en el espacio exterior y con las
cualidades de una percepción común. En la ilusión hay algo que se percibe mal;
en la alucinación no hay nada que percibir. La alucinosis es la percepción sin
objeto que el sujeto reconoce como fenómeno patológico, conservando la crítica
y el juicio de realidad. La pseudoalucinación carece de espacialidad externa y
de corporeidad sensorial plena: se ubica en el espacio interior subjetivo y se
impone con carácter de ajenidad.


ALTERACIONES DEL PENSAMIENTO EN SU CURSO

Se describen la taquipsiquia, aceleración del ritmo del pensamiento; la
bradipsiquia, su enlentecimiento; la fuga de ideas, aceleración extrema con
pérdida de la meta directriz y asociaciones por consonancia o contigüidad,
característica de la manía; el bloqueo, interrupción brusca e inmotivada del
curso, tras la cual el sujeto pierde el hilo; y la perseveración, repetición
persistente de una idea o una respuesta que se mantiene más allá del estímulo
que la provocó.


ALTERACIONES DEL PENSAMIENTO EN SU CONTENIDO

La idea delirante es un juicio patológicamente falso, sostenido con certeza
absoluta, irreductible a la argumentación, no compartido por el medio
sociocultural del sujeto, quien no lo reconoce como producción morbosa propia.
La idea sobrevalorada es comprensible y en general no absurda, está
intensamente cargada de afecto, ocupa el centro de la vida psíquica y organiza
la conducta, pero admite discusión y es egosintónica. La idea obsesiva irrumpe
de manera reiterada y parásita, es reconocida por el sujeto como propia y como
absurda o excesiva, se vive con carácter de imposición y suscita resistencia,
angustia y con frecuencia rituales. El criterio diferencial no es el contenido
sino la relación del sujeto con la idea: convicción sin crítica en el delirio,
convicción argumentable en la sobrevalorada, crítica y lucha en la obsesión.


TIPOS DE DELIRIO MÁS NOMBRADOS

Los temas más frecuentes son el persecutorio, con vivencia de daño; el de
grandeza o megalomaníaco, con sobrestimación de las capacidades o la misión
propias; el de culpa, con indignidad, ruina y castigo merecido; el de
referencia, en el que hechos neutros del entorno aluden al sujeto; el
celotípico, centrado en la infidelidad de la pareja; y el somático, referido
al cuerpo, sus transformaciones o una enfermedad.


ALTERACIONES DE LA AFECTIVIDAD

La hipotimia es el descenso del tono afectivo; la hipertimia, su elevación; la
disforia, un humor displacentero, tenso e irritable. La ambivalencia afectiva
es la coexistencia simultánea de sentimientos opuestos hacia un mismo objeto.
El aplanamiento afectivo es la reducción de la intensidad, la gama y la
expresión de la resonancia afectiva. La labilidad designa los cambios rápidos
y bruscos del afecto ante estímulos mínimos.


ALTERACIONES DE LA MEMORIA

La amnesia anterógrada compromete la fijación de nuevos recuerdos desde que se
instala el cuadro; la retrógrada afecta la evocación de lo adquirido antes. La
paramnesia es el falseamiento del recuerdo, por deformación del contenido o
por falso reconocimiento. La confabulación es el relleno de lagunas amnésicas
con contenidos que el sujeto no reconoce como falsos. El déjà vu es un falso
reconocimiento por familiaridad ante lo nuevo, cuyo reverso es el jamais vu.


ANGUSTIA Y ANSIEDAD

Se reserva angustia para el predominio de la expresión somática, con opresión
corporal, y ansiedad para el predominio psíquico, con inquietud y anticipación
temerosa. La crisis de angustia es un episodio de comienzo brusco que alcanza
su intensidad máxima en pocos minutos, con síntomas como palpitaciones,
disnea, sudoración, temblor y mareo, temor a morir o a perder el control, y
duración limitada.


CLASIFICACIONES DESCRIPTIVAS Y DIAGNÓSTICO ESTRUCTURAL

El DSM y la CIE son clasificaciones descriptivas: agrupan cuadros por
criterios observables, con umbrales de número y duración, buscando acuerdo
entre evaluadores. La CIE es de alcance internacional y abarca toda la
medicina; el DSM se limita a la salud mental. El diagnóstico estructural, de
tradición psicoanalítica, no procede por agrupamiento de síntomas sino por el
mecanismo predominante y la posición del sujeto: neurosis, psicosis y
perversión. Un mismo fenómeno puede valer distinto según la estructura.
`
  },

  {
    archivo: '4. Psicología Social — apunte de arranque.txt',
    titulo: 'PSICOLOGÍA SOCIAL',
    materia: 'Psicología Social',
    unidad: 'Unidad 1 — Influencia y grupos',
    tarjetas: 15,
    tiempo: 'unos tres o cuatro minutos',
    cuerpo: `APUNTE DE ESTUDIO: PSICOLOGÍA SOCIAL


INFLUENCIA SOCIAL: TRES FORMAS QUE SE CONFUNDEN

La psicología social estudia cómo la presencia real, imaginada o implícita de
otros afecta el pensamiento y la conducta. Hay que separar tres fenómenos: la
conformidad es el cambio de juicio o de conducta por presión de un grupo de
pares, sin que nadie ordene nada; la obediencia supone una jerarquía, una
autoridad reconocida que da una orden explícita; y la complacencia es acceder
al pedido directo de alguien sin autoridad sobre uno. Kelman (1958) distinguió
tres niveles: complacencia, cambio público sin cambio privado; identificación,
sostenida por el vínculo con la fuente; e internalización, cambio genuino de
convicciones. Para Deutsch y Gerard (1955), la influencia normativa opera por
la necesidad de ser aceptado y produce acatamiento público; la informativa
opera en situaciones ambiguas, al tomar al otro como fuente válida de
información, y produce cambio privado.


LOS EXPERIMENTOS CLÁSICOS Y QUÉ MOSTRÓ CADA UNO

Sherif, con el efecto autocinético (mediados de la década de 1930), mostró que
ante un punto de luz fijo que en la oscuridad parece moverse, los sujetos
reunidos convergen en una norma común y la conservan al evaluar solos: esa
norma se internaliza, caso típico de influencia informativa. Asch (1951) usó
estímulos nada ambiguos, comparar líneas, y aun así cerca de un tercio de las
respuestas críticas se plegó a la mayoría unánime equivocada; un solo aliado
disidente bastaba para reducir el efecto: influencia normativa. Milgram (1963)
mostró que cerca del 65 por ciento de los participantes obedeció hasta el
último nivel de descarga: la obediencia depende más de la situación, la
legitimidad de la autoridad y la distancia con la víctima que de la
personalidad. Zimbardo, en la cárcel de Stanford (1971), asignó al azar roles
de guardia y preso y debió interrumpir el estudio a los seis días: pudieron
más los roles y la desindividuación que las disposiciones individuales. Latané
y Darley (1968) documentaron el efecto espectador: cuantos más testigos hay,
menos probable y más lenta es la ayuda, por difusión de la responsabilidad,
ignorancia pluralista y aprensión a la evaluación. Festinger (1957) formuló la
disonancia cognitiva: la tensión entre cogniciones incompatibles motiva a
reducirla cambiando la actitud, la conducta o sumando cogniciones consonantes;
con Carlsmith (1959) mostró que quienes cobraron un dólar por mentir sobre una
tarea aburrida la evaluaron luego como más agradable que quienes cobraron
veinte: a menor justificación externa, mayor cambio de actitud.


ATRIBUCIÓN

Heider (1958) inauguró el campo con su psicología ingenua: la conducta se
explica por causas internas o disposicionales y externas o situacionales.
Kelley (1967) sistematizó el modelo de covariación con tres criterios:
consenso, si otros actúan igual; distintividad, si la persona responde así
sólo ante ese estímulo; y consistencia, si se repite en el tiempo. Consenso y
distintividad altos con consistencia alta llevan a atribución externa; bajos,
a atribución interna. De ahí tres sesgos: el error fundamental de atribución,
sobrestimar lo disposicional al explicar la conducta ajena; el sesgo
actor-observador, que atribuye la propia conducta a la situación y la ajena a
la disposición; y el sesgo de autoservicio, que adjudica los éxitos a uno
mismo y los fracasos a las circunstancias.


ACTITUDES

Una actitud tiene tres componentes: cognitivo, las creencias sobre el objeto;
afectivo, la carga emocional evaluativa; y conductual, la tendencia a actuar.
La relación entre actitud y conducta no es directa, como mostró LaPiere
(1934): predice mejor cuando ambas se miden al mismo nivel de especificidad y
la actitud es fuerte, accesible y nacida de experiencia directa.


IDENTIDAD SOCIAL, ESTEREOTIPO, PREJUICIO Y DISCRIMINACIÓN

Tajfel y Turner (1979) sostienen que parte del autoconcepto deriva de la
pertenencia grupal, por categorización, identificación y comparación social
favorable, lo que genera favoritismo endogrupal incluso con grupos mínimos y
arbitrarios. El grupo de pertenencia es aquel al que uno pertenece de hecho;
el de referencia, el que se toma como patrón de normas y comparación, se
pertenezca a él o no. La tríada clásica: el estereotipo es cognitivo, una
creencia generalizada sobre el exogrupo; el prejuicio es afectivo, una actitud
casi siempre negativa; la discriminación es conductual, el trato desigual
efectivo. Sherif, en Robbers Cave (1954), mostró que la competencia por
recursos escasos genera hostilidad intergrupal y que las metas supraordinadas
la reducen.


PROCESOS GRUPALES

Todo grupo se organiza por normas, roles y cohesión. Janis (1972) llamó
pensamiento grupal al deterioro del juicio en grupos muy cohesionados,
aislados y con liderazgo directivo, que priorizan el consenso sobre la
evaluación realista, con ilusión de invulnerabilidad, autocensura y presión
sobre los disidentes. En la polarización grupal, la discusión extrema la
posición media previa del grupo. La holgazanería social (Latané, Williams y
Harkins, 1979) es la caída del esfuerzo individual cuando el aporte propio no
es identificable.


APORTES LATINOAMERICANOS

Pichon Rivière formuló la técnica del grupo operativo, centrado en una tarea
explícita y atravesado por una tarea implícita, y su ECRO, esquema conceptual
referencial y operativo, con nociones como emergente y portavoz. Martín Baró,
asesinado en El Salvador en 1989, propuso una psicología de la liberación
orientada a las mayorías populares y a la desideologización del sentido común.
`
  }
]
