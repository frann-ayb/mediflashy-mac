/**
 * Bonus: el mapa de autores de la carrera.
 *
 * ---------------------------------------------------------------------------
 * De dónde sale esta lista
 * ---------------------------------------------------------------------------
 *
 * Los nombres NO se eligieron a mano: salen de contar quién aparece de verdad
 * en las 1.507 tarjetas que la app trae cargadas. Esa es la regla que mantiene
 * honesto al bonus en las dos direcciones:
 *
 *   · si un autor estuviera acá y no en las tarjetas, el mapa prometería
 *     cobertura que el producto no tiene;
 *   · si estuviera en las tarjetas y no acá, dejaría un hueco justo donde el
 *     comprador lo iba a buscar.
 *
 * La materia de cada uno también sale del recuento: es aquella en la que más
 * tarjetas suyas hay. Por eso Jung y Adler figuran en Historia y no en
 * Psicoanálisis, y Wallon en Desarrollo: es donde la app efectivamente los
 * trata.
 *
 * Los cuatro campos de cada fila son [apellido, cuándo, qué aportó, se lo
 * asocia con]. La última columna es la que hace el trabajo: son las palabras
 * que en un examen tienen que traer el nombre sin pensarlo.
 *
 * Ética y Deontología no aparece porque no se estudia por autores sino por
 * normativa — la Ley 26.657, el Código de Ética. Está en las tarjetas, pero no
 * en un mapa de nombres.
 */

export const MAPA_DE_AUTORES = [
  {
    materia: 'Historia de la Psicología',
    autores: [
      ['Wundt', '1832‑1920', 'Fundó el primer laboratorio de psicología experimental (Leipzig, 1879) y sistematizó la introspección', 'voluntarismo, introspección experimental, elementos de la conciencia'],
      ['Weber', '1795‑1878', 'Halló que el umbral diferencial es una fracción constante del estímulo', 'ley de Weber, umbral diferencial, mínima diferencia perceptible'],
      ['Fechner', '1801‑1887', 'Fundó la psicofísica (1860): midió matemáticamente la relación entre estímulo físico y sensación', 'psicofísica, ley de Fechner, umbral absoluto'],
      ['Titchener', '1867‑1927', 'Llevó a EE.UU. el estructuralismo: descomponer la conciencia en sensaciones, imágenes y sentimientos', 'estructuralismo, introspección analítica, elementos mentales'],
      ['James', '1842‑1910', 'Escribió Principios de Psicología (1890) y pensó la conciencia como flujo continuo y adaptativo', 'funcionalismo, corriente de la conciencia, el self'],
      ['Ebbinghaus', '1850‑1909', 'Midió la memoria sobre sí mismo con sílabas sin sentido y trazó la curva del olvido (1885)', 'curva del olvido, sílabas sin sentido, método de ahorro'],
      ['Dewey', '1859‑1952', 'Criticó el arco reflejo (1896) como unidad de análisis y ligó el funcionalismo a la educación', 'funcionalismo, crítica al arco reflejo, aprender haciendo'],
      ['Galton', '1822‑1911', 'Midió diferencias individuales con tests antropométricos y trajo la estadística a la psicología', 'diferencias individuales, correlación, eugenesia'],
      ['Wertheimer', '1880‑1943', 'Fundó la Gestalt al explicar el movimiento aparente entre dos luces fijas (fenómeno phi, 1912)', 'fenómeno phi, leyes de organización perceptual, pensamiento productivo'],
      ['Köhler', '1887‑1967', 'Mostró en chimpancés que la solución llega por reestructuración súbita, no por ensayo y error', 'insight, aprendizaje por reestructuración, Mentalidad de los monos'],
      ['Koffka', '1886‑1941', 'Difundió la Gestalt y distinguió el ambiente geográfico del ambiente conductual (1935)', 'ambiente conductual, campo psicológico, Gestalt'],
      ['Jung', '1875‑1961', 'Rompió con Freud y fundó la psicología analítica sobre un inconsciente compartido por la especie', 'inconsciente colectivo, arquetipos, introversión y extraversión'],
      ['Adler', '1870‑1937', 'Fundó la psicología individual: la conducta busca compensar un sentimiento de inferioridad', 'complejo de inferioridad, afán de superioridad, estilo de vida']
    ]
  },
  {
    materia: 'Psicoanálisis I — Freud',
    autores: [
      ['Freud', '1856‑1939', 'Descubrió el inconsciente y creó su método: asociación libre e interpretación de los sueños (1900)', 'inconsciente, represión, primera y segunda tópica'],
      ['Ferenczi', '1873‑1933', 'Insistió en el trauma real y en la confusión de lenguas entre el adulto y el niño (1932)', 'confusión de lenguas, técnica activa, trauma real'],
      ['Anna Freud', '1895‑1982', 'Sistematizó las defensas del yo (1936) y fundó el análisis de niños desde la psicología del yo', 'mecanismos de defensa, psicología del yo, análisis de niños']
    ]
  },
  {
    materia: 'Psicoanálisis II — Lacan y posfreudianos',
    autores: [
      ['Lacan', '1901‑1981', 'Propuso el retorno a Freud y leyó el inconsciente como estructurado como un lenguaje', 'estadio del espejo, Real-Simbólico-Imaginario, primacía del significante'],
      ['Klein', '1882‑1960', 'Analizó niños con la técnica del juego y describió posiciones, no estadios', 'posición esquizo-paranoide, posición depresiva, objetos parciales'],
      ['Winnicott', '1896‑1971', 'Ubicó entre el bebé y la madre un espacio transicional donde nacen el juego y la cultura', 'objeto transicional, madre suficientemente buena, verdadero y falso self'],
      ['Bion', '1897‑1979', 'Pensó cómo la mente digiere lo insoportable y cómo los grupos operan bajo supuestos inconscientes', 'función alfa, continente-contenido, supuestos básicos']
    ]
  },
  {
    materia: 'Psicología del Desarrollo',
    autores: [
      ['Piaget', '1896‑1980', 'Explicó la inteligencia por estadios y por equilibración entre asimilación y acomodación', 'epistemología genética, estadios, egocentrismo'],
      ['Vygotsky', '1896‑1934', 'Situó el desarrollo en lo social: toda función aparece primero entre personas y después en el sujeto', 'zona de desarrollo próximo, ley de doble formación, mediación semiótica'],
      ['Wallon', '1879‑1962', 'Explicó la psicogénesis de la persona desde la emoción y el cuerpo, en estadios de alternancia', 'emoción como primer vínculo, estadios de Wallon, prueba del espejo'],
      ['Spitz', '1887‑1974', 'Mostró en bebés institucionalizados los efectos de la carencia afectiva sostenida', 'hospitalismo, depresión anaclítica, organizadores psíquicos'],
      ['Erikson', '1902‑1994', 'Extendió el desarrollo a toda la vida en ocho crisis psicosociales', 'identidad vs confusión de rol, moratoria, principio epigenético'],
      ['Bowlby', '1907‑1990', 'Explicó el vínculo madre-bebé como sistema conductual de base etológica, no como derivado de la comida', 'teoría del apego, monotropía, modelos operativos internos'],
      ['Ainsworth', '1913‑1999', 'Diseñó la Situación Extraña y clasificó los patrones de apego observando la reunión con la madre', 'Situación Extraña, apego seguro, apego evitativo y ambivalente'],
      ['Kohlberg', '1927‑1987', 'Midió el desarrollo moral por el razonamiento, no por la respuesta, usando dilemas', 'tres niveles y seis estadios, dilema de Heinz, moral posconvencional'],
      ['Bruner', '1915‑2016', 'Retomó a Vygotsky: el adulto sostiene el aprendizaje hasta que el chico puede solo', 'andamiaje, formatos, aprendizaje por descubrimiento']
    ]
  },
  {
    materia: 'Psicología Cognitiva',
    autores: [
      ['Miller', '1920‑2012', 'Fijó en 7±2 la capacidad de la memoria inmediata y mostró que se amplía agrupando (1956)', 'número mágico 7±2, chunking, amplitud de memoria'],
      ['Simon', '1916‑2001', 'Mostró que decidimos con racionalidad limitada y elegimos lo satisfactorio, no lo óptimo', 'racionalidad limitada, satisficing, resolución de problemas'],
      ['Broadbent', '1926‑1993', 'Modeló la atención como un filtro temprano que deja pasar un canal por vez (1958)', 'modelo de filtro, atención selectiva, escucha dicótica'],
      ['Chomsky', '1928‑', 'Refutó la explicación conductista del lenguaje (1959): la gramática no se aprende por refuerzo', 'gramática generativa, dispositivo de adquisición del lenguaje, competencia y actuación'],
      ['Baddeley', '1934‑', 'Reemplazó la memoria a corto plazo pasiva por un sistema activo de varios componentes (1974)', 'memoria de trabajo, bucle fonológico, ejecutivo central'],
      ['Tversky', '1937‑1996', 'Formuló con Kahneman las heurísticas del juicio y el efecto del modo de presentar el problema', 'representatividad, disponibilidad y anclaje, efecto de encuadre'],
      ['Kahneman', '1934‑2024', 'Mostró que decidimos con atajos sistemáticamente sesgados; Nobel de Economía 2002', 'heurísticas y sesgos, teoría prospectiva, sistema 1 y sistema 2']
    ]
  },
  {
    materia: 'Teorías del Aprendizaje',
    autores: [
      ['Pavlov', '1849‑1936', 'Descubrió que un estímulo neutro asociado a uno incondicionado pasa a provocar la respuesta', 'condicionamiento clásico, EI-EC-RI-RC, extinción y generalización'],
      ['Thorndike', '1874‑1949', 'Midió el ensayo y error en cajas-problema: se fija lo que trae satisfacción', 'ley del efecto, ensayo y error, conexionismo'],
      ['Watson', '1878‑1958', 'Fundó el conductismo (1913) y condicionó el miedo del pequeño Albert (1920)', 'conductismo, pequeño Albert, estímulo-respuesta'],
      ['Tolman', '1886‑1959', 'Probó que las ratas aprenden el laberinto sin premio: el aprendizaje puede no verse en la conducta', 'aprendizaje latente, mapa cognitivo, conductismo propositivo'],
      ['Skinner', '1904‑1990', 'Mostró que la conducta se modela por sus consecuencias y programó los refuerzos en laboratorio', 'condicionamiento operante, reforzamiento, programas de refuerzo'],
      ['Bandura', '1925‑2021', 'Mostró con el muñeco Bobo (1961) que se aprende observando a otro, sin refuerzo propio', 'aprendizaje vicario, modelado, autoeficacia']
    ]
  },
  {
    materia: 'Bases Biológicas del Comportamiento',
    autores: [
      ['Broca', '1824‑1880', 'Localizó en 1861, con el cerebro del paciente Tan, la lesión que suprime el habla y conserva la comprensión', 'área de Broca, afasia motora, caso Tan (Leborgne)'],
      ['Wernicke', '1848‑1905', 'Describió en 1874 la afasia en que se habla con fluidez pero no se comprende', 'área de Wernicke, afasia sensorial, modelo de conexiones'],
      ['Phineas Gage', '1823-1860 (accidente de 1848)', 'Sobrevivió a una barra de hierro que le atravesó el lóbulo frontal y le cambió la personalidad', 'caso Gage, lóbulo frontal, conducta social y personalidad'],
      ['Hebb', '1904‑1985', 'Postuló en 1949 que las neuronas que se activan juntas refuerzan su conexión', 'regla de Hebb, asambleas celulares, plasticidad sináptica'],
      ['Sperry', '1913‑1994', 'Estudió pacientes con el cuerpo calloso seccionado y mostró que cada hemisferio se especializa', 'cerebro dividido, comisurotomía, lateralización']
    ]
  },
  {
    materia: 'Neuropsicología',
    autores: [
      ['Luria', '1902‑1977', 'Organizó el cerebro en tres unidades funcionales y fundó la evaluación neuropsicológica cualitativa', 'tres unidades funcionales, sistema funcional complejo, afasias'],
      ['Damasio', '1944‑', 'Mostró con pacientes de daño prefrontal que sin emoción no hay buena decisión', 'marcador somático, El error de Descartes, corteza prefrontal ventromedial']
    ]
  },
  {
    materia: 'Psicopatología',
    autores: [
      ['Kraepelin', '1856‑1926', 'Clasificó las psicosis por su curso y desenlace: demencia precoz frente a locura maníaco-depresiva', 'nosología kraepeliniana, demencia precoz, criterio evolutivo'],
      ['Bleuler', '1857‑1939', 'Reemplazó demencia precoz por esquizofrenia (1911) y la definió por la disociación, no por el deterioro', 'esquizofrenia, las cuatro A, autismo'],
      ['Jaspers', '1883‑1969', 'Fundó la psicopatología fenomenológica (1913) separando lo que se comprende de lo que sólo se explica', 'comprender vs explicar, delirio primario, Psicopatología general'],
      ['Schneider', '1887‑1967', 'Listó los síntomas de primer rango que orientan el diagnóstico de esquizofrenia', 'síntomas de primer rango, vivencias de influencia, personalidades psicopáticas'],
      ['Canguilhem', '1904‑1995', 'Sostuvo que lo patológico no es una desviación cuantitativa de lo normal sino otra norma de vida', 'lo normal y lo patológico, normatividad vital, la enfermedad como nueva norma'],
      ['Foucault', '1926‑1984', 'Historizó la locura: mostró cómo el encierro y el saber médico la constituyeron como enfermedad', 'Historia de la locura, gran encierro, saber-poder']
    ]
  },
  {
    materia: 'Psicología Social',
    autores: [
      ['Lewin', '1890‑1947', 'Formuló que la conducta es función de la persona y su ambiente, y fundó la dinámica de grupos', 'teoría del campo, B = f(P, A), investigación-acción'],
      ['LaPiere', '1899‑1986', 'Mostró en 1934 la brecha entre lo que la gente dice y lo que hace, viajando con una pareja china', 'discrepancia actitud-conducta, actitudes, prejuicio declarado'],
      ['Sherif', '1906‑1988', 'Creó normas grupales con el efecto autocinético y en Robbers Cave generó y desactivó el conflicto', 'normas grupales, conflicto realista, metas supraordinadas'],
      ['Asch', '1907‑1996', 'Mostró con las líneas (1951) que un tercio de las respuestas se pliega a una mayoría errónea', 'conformidad, presión grupal, formación de impresiones'],
      ['Heider', '1896‑1988', 'Fundó el estudio de la atribución: explicamos la conducta como psicólogos ingenuos', 'atribución causal, psicología ingenua, teoría del equilibrio'],
      ['Allport', '1897‑1967', 'Analizó el prejuicio y sostuvo que sólo cierto tipo de contacto entre grupos lo reduce (1954)', 'prejuicio, hipótesis del contacto, categorización y estereotipo'],
      ['Festinger', '1919‑1989', 'Mostró que quien cobra poco por mentir termina creyéndolo: cambia la actitud para bajar la tensión', 'disonancia cognitiva, experimento de 1 y 20 dólares, comparación social'],
      ['Milgram', '1933‑1984', 'Encontró que el 65% de los sujetos llegó a la descarga máxima de 450 voltios obedeciendo', 'obediencia a la autoridad, estado agéntico, experimento de las descargas'],
      ['Kelley', '1921‑2003', 'Formalizó la atribución con tres criterios para decidir si la causa está en la persona o la situación', 'modelo de covariación, consenso-distintividad-consistencia, esquemas causales'],
      ['Janis', '1918‑1990', 'Explicó por qué grupos cohesionados deciden pésimo por no romper la unanimidad (1972)', 'pensamiento grupal, ilusión de unanimidad, Bahía de Cochinos'],
      ['Zimbardo', '1933‑2024', 'Interrumpió a los seis días la cárcel simulada de Stanford (1971) por el abuso de los guardias', 'experimento de la cárcel de Stanford, desindividuación, poder del rol'],
      ['Latané', '1937‑', 'Demostró con Darley que cuantos más testigos hay, menos probable es que alguien ayude', 'efecto espectador, difusión de la responsabilidad, teoría del impacto social'],
      ['Darley', '1938‑2018', 'Investigó la inhibición del auxilio y mostró que la prisa pesa más que los valores (1973)', 'efecto espectador, estudio del buen samaritano, ayuda en emergencias'],
      ['Tajfel', '1919‑1982', 'Mostró que basta una categorización arbitraria para favorecer al propio grupo', 'identidad social, paradigma del grupo mínimo, favoritismo endogrupal'],
      ['Turner', '1947‑2011', 'Continuó a Tajfel: el sujeto se despersonaliza y actúa según el prototipo del grupo saliente', 'autocategorización, despersonalización, prototipo grupal'],
      ['Moscovici', '1925‑2014', 'Estudió cómo el sentido común transforma el saber científico y cómo una minoría consistente influye', 'representaciones sociales, objetivación y anclaje, influencia minoritaria'],
      ['Pichon Rivière', '1907‑1977', 'Fundó la psicología social argentina y el grupo operativo centrado en la tarea', 'ECRO, grupo operativo, emergente y portavoz']
    ]
  },
  {
    materia: 'Corrientes Psicoterapéuticas',
    autores: [
      ['Perls', '1893‑1970', 'Creó la terapia gestáltica: trabajar en el aquí y ahora lo que aparece, en vez de interpretarlo', 'gestalt terapia, aquí y ahora, silla vacía'],
      ['Rogers', '1902‑1987', 'Centró la terapia en el cliente: si están las tres condiciones, la persona se reorganiza sola', 'terapia centrada en la persona, aceptación incondicional, empatía y congruencia'],
      ['Bateson', '1904‑1980', 'Propuso el doble vínculo (1956) y llevó la cibernética a la mirada sobre la familia', 'doble vínculo, escuela de Palo Alto, pensamiento sistémico'],
      ['Frankl', '1905‑1997', 'Fundó la logoterapia desde su paso por los campos: se sobrevive si hay un para qué', 'logoterapia, sentido de la vida, vacío existencial'],
      ['Maslow', '1908‑1970', 'Ordenó las necesidades humanas en una jerarquía coronada por la autorrealización', 'pirámide de necesidades, autorrealización, psicología humanista'],
      ['Ellis', '1913‑2007', 'Sostuvo que no perturban los hechos sino las creencias irracionales sobre ellos', 'modelo ABC, creencias irracionales, terapia racional emotiva'],
      ['Beck', '1921‑2021', 'Fundó la terapia cognitiva de la depresión sobre pensamientos automáticos y esquemas', 'tríada cognitiva, distorsiones cognitivas, inventario de depresión de Beck'],
      ['Watzlawick', '1921‑2007', 'Formuló los axiomas de la comunicación humana: es imposible no comunicar', 'axiomas de la comunicación, cambio 1 y cambio 2, contenido y relación'],
      ['Minuchin', '1921‑2017', 'Creó la terapia estructural: el síntoma expresa la organización de la familia', 'terapia estructural, límites y subsistemas, familias aglutinadas y desligadas']
    ]
  },
  {
    materia: 'Psicometría y Evaluación Psicológica',
    autores: [
      ['Spearman', '1863‑1945', 'Halló que todas las pruebas correlacionan entre sí e infirió un factor general de inteligencia', 'factor g, teoría bifactorial, análisis factorial'],
      ['Binet', '1857‑1911', 'Creó con Théodore Simon la primera escala de inteligencia (1905) para detectar el retraso escolar', 'escala Binet-Simon, edad mental, primer test de inteligencia'],
      ['Rorschach', '1884‑1922', 'Publicó en 1921 diez láminas de manchas simétricas para explorar la personalidad', 'test de Rorschach, técnica proyectiva, psicodiagnóstico'],
      ['Wechsler', '1896‑1981', 'Creó escalas de inteligencia por puntos con CI de desviación, en vez de edad mental', 'WAIS y WISC, CI de desviación, escalas verbal y de ejecución'],
      ['Cattell', '1905‑1998', 'Distinguió inteligencia fluida de cristalizada y construyó el 16PF por análisis factorial (R. B.)', 'inteligencia fluida y cristalizada, 16PF, rasgos fuente'],
      ['Cronbach', '1916‑2001', 'Dio la fórmula estándar de consistencia interna (1951) y trabajó la validez de constructo', 'alfa de Cronbach, consistencia interna, validez de constructo'],
      ['Bleger', '1923‑1972', 'Definió la entrevista psicológica como un campo con encuadre, no como un interrogatorio', 'entrevista psicológica, encuadre, entrevista abierta y cerrada']
    ]
  },
  {
    materia: 'Métodos de Investigación y Estadística',
    autores: [
      ['Likert', '1903‑1981', 'Creó en 1932 la escala sumativa de acuerdo-desacuerdo, la forma estándar de medir actitudes', 'escala Likert, medición de actitudes, ítems de cinco puntos'],
      ['Campbell', '1916‑1996', 'Distinguió validez interna de externa y sistematizó los diseños cuasi-experimentales (1963)', 'validez interna y externa, diseños cuasi-experimentales, amenazas a la validez'],
      ['Cook', 'siglo XX', 'Amplió con Campbell la cuasi-experimentación y sumó la validez de constructo y de conclusión (1979)', 'cuasi-experimentación, cuatro tipos de validez, Cook y Campbell']
    ]
  }
]

/** Cuántos autores trae. Lo publica la portada del PDF. */
export const TOTAL_AUTORES = MAPA_DE_AUTORES.reduce((n, m) => n + m.autores.length, 0)
