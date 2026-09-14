/** Simulacro de final: Métodos de Investigación y Estadística. */
export const EXAMEN = {
  materia: 'Métodos de Investigación y Estadística',
  desarrollo: [
    {
      p: 'Enuncie los requisitos de un diseño experimental y explique por qué garantizan validez interna.',
      r: 'Un diseño es experimental cuando cumple tres condiciones: manipulación deliberada de al menos una variable independiente por parte del investigador, asignación aleatoria de los participantes a las condiciones, y control de las variables extrañas mediante grupo de comparación y estandarización del procedimiento. La manipulación asegura la precedencia temporal de la causa sobre el efecto. La aleatorización distribuye probabilísticamente las diferencias individuales conocidas y desconocidas entre los grupos, de modo que se vuelven equivalentes antes del tratamiento y las diferencias posteriores pueden atribuirse a la variable independiente. El control neutraliza explicaciones alternativas como la historia, la maduración o la instrumentación, y en investigación aplicada se refuerza con placebo y con evaluación a ciegas. Es el diseño con mayor validez interna, es decir el que mejor sostiene inferencias causales, aunque suele pagar ese precio con una menor validez externa por lo artificial de la situación.'
    },
    {
      p: '¿Qué es un diseño cuasiexperimental, en qué se diferencia del experimental y cómo se refuerza su validez?',
      r: 'En el diseño cuasiexperimental hay manipulación de la variable independiente o exposición a un tratamiento, pero no hay asignación aleatoria: se trabaja con grupos ya constituidos, como cursos escolares, salas de internación o comunidades. Se recurre a él por razones prácticas o éticas, cuando aleatorizar es imposible o inadmisible, y es muy frecuente en evaluación de programas educativos, sanitarios y sociales. Su limitación central es que los grupos pueden diferir de entrada, de modo que la selección y su interacción con otras amenazas compiten como explicación de los resultados. Para reforzar la validez interna se usan estrategias como el diseño de grupo control no equivalente con pretest y postest, que permite comparar puntos de partida, el emparejamiento en variables relevantes, el control estadístico mediante análisis de covarianza, y los diseños de series temporales interrumpidas con múltiples mediciones antes y después. Aun así, la inferencia causal es más débil que en el experimento y debe formularse con prudencia.'
    },
    {
      p: 'Caracterice el diseño correlacional: qué permite y qué no permite concluir.',
      r: 'El diseño correlacional es no experimental: el investigador mide dos o más variables tal como se presentan, sin manipularlas, y estudia el grado y el sentido de su covariación. Permite describir relaciones, estimar su magnitud, hacer predicciones de una variable a partir de otra y explorar estructuras de variables, además de resultar indispensable cuando la variable de interés no puede manipularse por razones éticas o prácticas, como el consumo de sustancias o la exposición a un trauma. Lo que no permite es concluir causalidad, por tres razones: el problema de la direccionalidad, ya que la asociación no indica qué variable antecede a cuál; el problema de la tercera variable, porque una variable no medida puede explicar la relación entre ambas; y la posibilidad de relaciones espurias. Además, el coeficiente de correlación lineal puede subestimar relaciones curvilíneas y verse afectado por la restricción del rango y por casos atípicos.'
    },
    {
      p: 'Explique el error tipo I, el error tipo II y la potencia estadística, y cómo se relacionan.',
      r: 'Toda decisión sobre la hipótesis nula puede ser errónea de dos maneras. El error tipo I consiste en rechazar la hipótesis nula cuando en realidad es verdadera, es decir concluir que hay efecto donde no lo hay; su probabilidad es alfa, el nivel de significación, que el investigador fija de antemano, habitualmente en .05. El error tipo II consiste en no rechazar la hipótesis nula siendo falsa, o sea no detectar un efecto existente; su probabilidad es beta. La potencia es la probabilidad de detectar un efecto cuando efectivamente existe, y equivale a 1 menos beta; por convención se considera deseable un valor de al menos .80. Los dos errores están en tensión: si se baja alfa para ser más exigente, aumenta beta y disminuye la potencia, manteniendo todo lo demás constante. La potencia depende del tamaño del efecto, del tamaño de la muestra, del nivel de significación y de la variabilidad del error, y por eso el cálculo del tamaño muestral debe hacerse antes de recoger los datos.'
    },
    {
      p: '¿Qué es el valor p y cuáles son sus interpretaciones erróneas más frecuentes?',
      r: 'El valor p es la probabilidad de obtener un resultado igual o más extremo que el observado, suponiendo que la hipótesis nula es verdadera y que se cumplen los supuestos del modelo estadístico empleado. Si es menor que el nivel de significación fijado, se rechaza la hipótesis nula. Los errores más comunes son interpretarlo como la probabilidad de que la hipótesis nula sea verdadera, como la probabilidad de que el resultado se deba al azar, o como la probabilidad de que el hallazgo se replique. Otro error grave es leerlo como un índice de la magnitud o de la importancia del efecto: con muestras muy grandes, efectos triviales resultan significativos, y con muestras pequeñas, efectos relevantes pueden no alcanzar significación. Tampoco un resultado no significativo prueba que no haya efecto, ya que puede deberse a falta de potencia. Por eso se recomienda informar siempre el tamaño del efecto y los intervalos de confianza junto con el valor p.'
    },
    {
      p: 'Indique cuándo se utiliza la prueba t de Student para muestras independientes y qué supuestos exige.',
      r: 'La t de Student para muestras independientes se emplea para contrastar si las medias de dos grupos independientes difieren significativamente en una variable dependiente cuantitativa; la variable independiente es categórica dicotómica. Sus supuestos son: independencia de las observaciones dentro de cada grupo y entre grupos; medición de la variable dependiente en escala de intervalo o de razón; distribución normal de la variable en cada población, requisito menos crítico cuando los tamaños muestrales son razonables y parecidos por el teorema central del límite; y homogeneidad de varianzas u homocedasticidad, que se contrasta habitualmente con la prueba de Levene. Si no se cumple la homocedasticidad se aplica la corrección de Welch, que ajusta los grados de libertad. Si se incumple gravemente la normalidad con muestras chicas, o si la variable es ordinal, corresponde la alternativa no paramétrica U de Mann-Whitney. Cuando los datos son apareados, como en un pretest y un postest del mismo sujeto, la prueba adecuada es la t para muestras relacionadas.'
    },
    {
      p: 'Explique cuándo corresponde un ANOVA, por qué se usan pruebas post hoc y qué supuesto adicional exige el ANOVA de medidas repetidas.',
      r: 'El análisis de varianza de un factor se utiliza para comparar las medias de tres o más grupos en una variable dependiente cuantitativa. Se emplea en lugar de múltiples pruebas t porque cada comparación adicional incrementa la probabilidad de cometer al menos un error tipo I, es decir infla el error de tipo I por familia de comparaciones. Sus supuestos son los mismos que los de la t: independencia de las observaciones, normalidad en cada grupo y homogeneidad de varianzas. El estadístico F sólo indica que existe al menos una diferencia entre las medias, sin especificar entre qué grupos; por eso, cuando resulta significativo, se aplican pruebas post hoc como Tukey, Bonferroni o Scheffé, que controlan la tasa de error al comparar de a pares. En el ANOVA de medidas repetidas, donde los mismos sujetos son evaluados en varias condiciones o momentos, se agrega el supuesto de esfericidad, que se contrasta con la prueba de Mauchly y, si se incumple, se corrigen los grados de libertad con procedimientos como el de Greenhouse-Geisser.'
    },
    {
      p: '¿Cuándo se utiliza la prueba de chi cuadrado y qué condiciones debe cumplir?',
      r: 'El chi cuadrado es una prueba no paramétrica que trabaja con frecuencias y no con medias. En su versión de bondad de ajuste contrasta si la distribución observada de una variable categórica se ajusta a una distribución esperada teórica. En su versión de independencia, la más usada en psicología, evalúa si dos variables categóricas están asociadas, a partir de una tabla de contingencia en la que se comparan frecuencias observadas y esperadas. Sus condiciones son: observaciones independientes, de modo que cada sujeto aporte a una sola casilla, lo que excluye los diseños de medidas repetidas, para los que existe la prueba de McNemar; trabajar con frecuencias absolutas y no con porcentajes; y frecuencias esperadas suficientes, criterio habitualmente formulado como que ninguna casilla tenga esperada menor a uno y que no más del veinte por ciento tenga esperada menor a cinco. Cuando esto no se cumple en tablas de dos por dos se recurre a la prueba exacta de Fisher. El chi cuadrado indica si hay asociación, no su intensidad, para lo cual se informan medidas como el coeficiente phi o la V de Cramer.'
    }
  ],
  multiple: [
    {
      p: 'La variable "nivel educativo alcanzado", registrada como primario, secundario y universitario, corresponde a una escala:',
      ops: [
        'Nominal',
        'Ordinal',
        'De intervalo',
        'De razón'
      ],
      ok: 'b',
      por: 'a desconoce que las categorías tienen un orden jerárquico, y c y d exigen distancias iguales entre valores y, en el caso de razón, un cero absoluto, condiciones que esta variable no cumple.'
    },
    {
      p: 'Si se quiere comparar dos grupos independientes en una variable ordinal, con muestras pequeñas y sin normalidad, la prueba adecuada es:',
      ops: [
        'La t de Student para muestras independientes',
        'La prueba de Wilcoxon de rangos con signo',
        'El ANOVA de un factor',
        'La U de Mann-Whitney'
      ],
      ok: 'd',
      por: 'a exige normalidad y nivel de medición al menos intervalar, b corresponde a muestras relacionadas y no independientes, y c se usa con tres o más grupos.'
    },
    {
      p: 'Se selecciona para un programa de apoyo escolar a los alumnos con los puntajes más bajos en una prueba y, tras la intervención, se observa una mejora. La amenaza a la validez interna que más conviene descartar es:',
      ops: [
        'La regresión a la media',
        'La mortalidad experimental',
        'La instrumentación',
        'La difusión del tratamiento'
      ],
      ok: 'a',
      por: 'b requiere pérdida diferencial de participantes, c un cambio en el instrumento o en el criterio de medición, y d el contacto entre grupos que comparten el tratamiento, ninguno de los cuales está implicado en la selección por puntajes extremos.'
    },
    {
      p: 'Dos variables cuantitativas presentan una relación monotónica pero claramente no lineal, con presencia de valores atípicos. El coeficiente más adecuado es:',
      ops: [
        'La r de Pearson',
        'El chi cuadrado',
        'La rho de Spearman',
        'La d de Cohen'
      ],
      ok: 'c',
      por: 'a supone linealidad y es sensible a los casos atípicos, b se usa con variables categóricas, y d es un índice de tamaño del efecto para diferencias de medias, no de asociación.'
    },
    {
      p: 'Manteniendo constantes las demás condiciones, la potencia estadística de un estudio aumenta si:',
      ops: [
        'Se reduce el tamaño de la muestra',
        'Se incrementa la variabilidad del error',
        'Se disminuye el nivel de significación de .05 a .01',
        'Se aumenta el tamaño de la muestra'
      ],
      ok: 'd',
      por: 'a reduce la precisión de la estimación y por lo tanto la potencia, b agrega ruido que dificulta detectar el efecto, y c vuelve el criterio más exigente y aumenta la probabilidad de error tipo II.'
    },
    {
      p: 'Un investigador divide la población en estratos por nivel socioeconómico y extrae al azar una cantidad proporcional de casos dentro de cada uno. Se trata de un muestreo:',
      ops: [
        'Aleatorio simple',
        'Estratificado',
        'Por conglomerados',
        'Por cuotas'
      ],
      ok: 'b',
      por: 'a no contempla la división previa en subgrupos, c selecciona al azar grupos naturales completos y no individuos dentro de estratos, y d fija cupos pero sin selección aleatoria, por lo que es no probabilístico.'
    },
    {
      p: 'Rechazar la hipótesis nula cuando en realidad es verdadera constituye:',
      ops: [
        'Un error tipo I, cuya probabilidad es alfa',
        'Un error tipo II, cuya probabilidad es beta',
        'Una pérdida de potencia estadística',
        'Un problema de validez externa'
      ],
      ok: 'a',
      por: 'b describe el error inverso, no detectar un efecto existente, c se refiere a la capacidad de detectar efectos reales, y d atañe a la generalización de los resultados y no a la decisión estadística.'
    },
    {
      p: 'En una tabla de contingencia de dos por dos con frecuencias esperadas muy bajas, lo indicado es:',
      ops: [
        'Aplicar igual el chi cuadrado, porque el supuesto no importa',
        'Transformar las frecuencias en porcentajes y recalcular el chi cuadrado',
        'Emplear la prueba exacta de Fisher',
        'Aplicar una t de Student para las proporciones observadas'
      ],
      ok: 'c',
      por: 'a ignora una condición de aplicación que distorsiona el estadístico, b es un error grave porque el chi cuadrado exige frecuencias absolutas, y d no corresponde al nivel de medición categórico de los datos.'
    }
  ],
  oral: [
    {
      p: 'Un resultado dio p menor a .05. ¿Alcanza con eso para afirmar que el hallazgo es importante?',
      g: 'No. La significación estadística indica que el resultado es poco probable bajo la hipótesis nula, pero no informa sobre la magnitud ni sobre la relevancia práctica del efecto. Con muestras muy grandes, diferencias mínimas y sin importancia clínica resultan significativas, y con muestras chicas puede ocurrir lo contrario. Por eso hay que informar el tamaño del efecto, por ejemplo la d de Cohen o el eta cuadrado, junto con los intervalos de confianza, y evaluar la significación clínica: si el cambio observado mejora efectivamente la vida del paciente o el funcionamiento del grupo estudiado.'
    },
    {
      p: '¿Por qué la correlación no implica causalidad, y qué haría falta para hablar de causa?',
      g: 'Porque una asociación entre dos variables admite varias explicaciones: que A cause B, que B cause A, que ambas dependan de una tercera variable no medida, o que la relación sea espuria o producto del azar. Para sostener una inferencia causal se necesita covariación, precedencia temporal de la causa y descarte razonable de explicaciones alternativas, y eso lo aporta el diseño experimental con manipulación y asignación aleatoria. Cuando experimentar no es posible, se recurre a diseños longitudinales, controles estadísticos y modelos que ayudan a acotar hipótesis rivales, siempre con conclusiones más prudentes.'
    },
    {
      p: '¿Por qué la asignación aleatoria es más potente que emparejar a los participantes en las variables que uno considera relevantes?',
      g: 'Porque el emparejamiento sólo controla las variables que el investigador identificó y midió, y siempre quedan afuera variables desconocidas o no registradas que pueden diferir entre los grupos. La aleatorización, en cambio, distribuye probabilísticamente todas las diferencias individuales, conocidas y desconocidas, de modo que los grupos resultan equivalentes en promedio antes del tratamiento. Además, es lo que justifica el modelo estadístico con el que después se analizan los datos. Su eficacia depende del tamaño muestral: con muestras muy chicas puede producir grupos desbalanceados por azar, y por eso a veces se combina con bloqueo o estratificación.'
    },
    {
      p: 'Si al analizar sus datos encuentra que no se cumplen los supuestos de la prueba paramétrica que había planificado, ¿qué opciones tiene?',
      g: 'Primero verificar si el incumplimiento es real y relevante, revisando la distribución, la presencia de casos atípicos y posibles errores de carga, ya que algunas pruebas son robustas a desvíos moderados de la normalidad cuando los grupos tienen tamaños similares. Después evaluar alternativas: correcciones específicas como la de Welch ante heterogeneidad de varianzas o la de Greenhouse-Geisser ante falta de esfericidad, transformaciones de la variable, o el pasaje a la prueba no paramétrica equivalente, como U de Mann-Whitney, Wilcoxon o Kruskal-Wallis. Lo importante es explicitar en el informe qué supuesto falló, qué decisión se tomó y por qué, y no ocultar el problema ni probar pruebas hasta encontrar una que dé significativa.'
    }
  ]
}
