/** Simulacro de final: Psicometría y Evaluación Psicológica. */
export const EXAMEN = {
  materia: 'Psicometría y Evaluación Psicológica',
  desarrollo: [
    {
      p: 'Defina confiabilidad y describa sus principales tipos y modos de estimación.',
      r: 'La confiabilidad alude a la precisión y consistencia de las mediciones, es decir al grado en que los puntajes están libres de error de medición no sistemático. Desde la teoría clásica de los tests, el puntaje observado es la suma de un puntaje verdadero y un error, y el coeficiente de confiabilidad expresa la proporción de varianza verdadera sobre la varianza total. Se estima de distintas maneras según el tipo de error que interese controlar: la estabilidad temporal mediante test-retest, sensible a las fluctuaciones en el tiempo y al efecto de práctica; la equivalencia mediante formas paralelas, sensible al muestreo de ítems; la consistencia interna mediante las dos mitades con corrección de Spearman-Brown, el alfa de Cronbach o el KR-20 para ítems dicotómicos; y el acuerdo entre evaluadores mediante el kappa de Cohen o el coeficiente de correlación intraclase, indispensable cuando la corrección requiere juicio. A partir de la confiabilidad se calcula el error típico de medición, que permite construir intervalos de confianza alrededor del puntaje obtenido.'
    },
    {
      p: 'Explique la concepción actual de validez y las fuentes de evidencia que la sustentan.',
      r: 'La validez es el grado en que la evidencia empírica y la teoría respaldan las interpretaciones que se hacen de los puntajes de un test para un uso determinado. La concepción actual, sostenida por los Estándares de AERA, APA y NCME, la entiende como un concepto unitario: no existen “validades” distintas de un test sino distintas fuentes de evidencia que convergen para sostener una interpretación. Estas fuentes incluyen la evidencia basada en el contenido del test, la basada en los procesos de respuesta, la basada en la estructura interna, la basada en las relaciones con otras variables, que abarca las evidencias convergente, discriminante y de criterio, y la basada en las consecuencias del uso. De ahí se sigue que la validez no es una propiedad fija del instrumento sino que se predica de las interpretaciones y de los usos, y que un test válido para un propósito y una población puede no serlo para otros.'
    },
    {
      p: 'Diferencie validez de contenido y validez de constructo, y explique por qué se confunden.',
      r: 'La evidencia de contenido responde a si los ítems constituyen una muestra representativa y relevante del dominio que se pretende evaluar. Se obtiene antes y durante la construcción del test, mediante la definición operacional del dominio, una tabla de especificaciones y el juicio de expertos, cuantificado con índices como la V de Aiken. Es un análisis lógico y de contenido, no empírico correlacional. La evidencia de constructo responde a si el test mide efectivamente el atributo teórico postulado, y se obtiene con investigación empírica acumulada: análisis factorial exploratorio y confirmatorio para estudiar la estructura interna, la matriz multirrasgo-multimétodo de Campbell y Fiske para evaluar convergencia y discriminación, estudios de grupos contrastados y de cambio evolutivo, y contrastación de hipótesis derivadas de la red nomológica. Se confunden porque en ambos casos se habla de “lo que el test mide”, pero la pregunta es distinta: el contenido examina la representatividad del muestreo de ítems, el constructo examina el sustento teórico y empírico de la interpretación. Además, la validez de contenido no debe confundirse con la validez aparente, que es sólo la impresión que el test causa en quien lo responde.'
    },
    {
      p: 'Explique la validez de criterio, sus dos modalidades y los factores que pueden distorsionarla.',
      r: 'La evidencia de validez referida a criterio consiste en establecer la relación entre los puntajes del test y una medida externa e independiente de la conducta que se quiere estimar. Cuando el criterio se recoge tiempo después de la administración se habla de validez predictiva, propia de la selección y del pronóstico; cuando se recoge de manera simultánea se habla de validez concurrente, útil por ejemplo para contrastar un test breve con un criterio diagnóstico ya establecido. La relación se expresa mediante el coeficiente de validez y se complementa con la ecuación de regresión y con índices de eficacia diagnóstica como sensibilidad, especificidad y valores predictivos según el punto de corte adoptado. Entre los factores que distorsionan el coeficiente están la baja confiabilidad del test o del criterio, que lo atenúa; la restricción del rango, cuando sólo se dispone del criterio en los seleccionados; la contaminación del criterio, cuando quien evalúa el criterio conoce el puntaje del test; y la mala definición o poca representatividad del criterio mismo.'
    },
    {
      p: 'Explique qué son los baremos y describa los principales puntajes derivados.',
      r: 'Los baremos o normas son tablas que permiten transformar el puntaje bruto, que por sí solo no dice nada, en un puntaje derivado interpretable por comparación con el rendimiento de un grupo normativo de referencia. Los percentiles indican el porcentaje de sujetos del grupo normativo que obtuvo un puntaje igual o menor; son muy fáciles de comunicar pero constituyen una escala ordinal, con unidades desiguales que se comprimen en el centro y se expanden en los extremos, por lo que no admiten operaciones aritméticas. Los puntajes típicos o estándar expresan la distancia a la media en unidades de desvío: el puntaje z, con media 0 y desvío 1; el puntaje T, con media 50 y desvío 10, usado por ejemplo en el MMPI-2; los eneatipos o estaninos, con media 5 y desvío 2; los puntajes escalares de las escalas Wechsler, con media 10 y desvío 3; y el cociente intelectual de desviación, con media 100 y desvío 15. La elección del baremo importa tanto como el puntaje: debe corresponder a la población, la edad y el contexto del evaluado.'
    },
    {
      p: 'Explique en qué consiste la estandarización de un test y por qué es un requisito de la medición psicológica.',
      r: 'La estandarización tiene dos sentidos complementarios. En primer lugar, la uniformidad del procedimiento: consignas textuales, materiales, orden de presentación, tiempos, criterios de registro, de suspensión y de corrección son idénticos para todos los examinados. Esto es indispensable porque sólo si todos fueron evaluados en las mismas condiciones las diferencias de puntaje pueden atribuirse a diferencias en el atributo y no al modo de administrar. En segundo lugar, la tipificación: el establecimiento de las normas o baremos en una muestra de tipificación amplia, representativa de la población a la que el test se destina y descripta con precisión en cuanto a edad, sexo, nivel educativo y región. Los baremos deben ser actuales y culturalmente pertinentes, ya que un test estandarizado en otro país o en otra época puede producir interpretaciones erróneas. Por eso, en la Argentina, se trabaja con adaptaciones y baremos locales, y todo apartamiento de la administración estándar debe consignarse en el informe porque limita la interpretación normativa.'
    },
    {
      p: 'Describa la estructura del WAIS-IV y los cuidados a tener en su interpretación.',
      r: 'El WAIS-IV es una escala de inteligencia de administración individual, de rendimiento máximo, destinada a adultos y adolescentes desde los 16 años. Se organiza en cuatro índices: Comprensión Verbal, Razonamiento Perceptivo, Memoria de Trabajo y Velocidad de Procesamiento, que se combinan en un Cociente Intelectual Total. Los subtests se expresan en puntajes escalares con media 10 y desvío 3, y los índices y el CI en puntajes de desviación con media 100 y desvío 15. A diferencia del WAIS-III, esta versión no conserva la división en CI Verbal y CI de Ejecución. En la interpretación conviene proceder del dato global al específico pero sin quedarse en el CI Total: si hay dispersión significativa entre los índices, el puntaje global pierde valor descriptivo y debe interpretarse cada índice por separado. Además, todo puntaje debe informarse con su intervalo de confianza, contextualizado con la historia, la escolaridad y las condiciones de administración, y nunca como una etiqueta sobre la persona.'
    },
    {
      p: 'Caracterice el MMPI-2: método de construcción, escalas y criterios de interpretación.',
      r: 'El MMPI-2 es un inventario autoadministrable de personalidad y psicopatología para adultos, compuesto por 567 ítems de respuesta verdadero o falso. Su rasgo distintivo es el método de construcción por criterio empírico o de grupos contrastados: los ítems fueron seleccionados por su capacidad para diferenciar grupos criterio, no por su contenido aparente, de modo que un ítem puede pertenecer a una escala aunque su contenido no parezca relacionado con ella. Cuenta con diez escalas clínicas básicas y con escalas de validez que evalúan la actitud del examinado ante la prueba, entre ellas L, F y K, la cantidad de ítems no respondidos, y las escalas de consistencia VRIN y TRIN. Los resultados se expresan en puntajes T con media 50 y desvío 10, y en el MMPI-2 se considera clínicamente significativo un T igual o mayor a 65. La interpretación no se hace escala por escala de manera aislada sino por el perfil y por códigos de dos o tres puntos, y siempre debe comenzar por las escalas de validez, ya que un perfil inválido invalida toda lectura clínica posterior.'
    }
  ],
  multiple: [
    {
      p: 'Respecto del alfa de Cronbach, es correcto afirmar que:',
      ops: [
        'Es un indicador de consistencia interna que depende de la cantidad de ítems y de su intercorrelación media',
        'Prueba que el test es unidimensional',
        'Es una medida de validez de constructo',
        'Es el método adecuado para estimar la estabilidad temporal'
      ],
      ok: 'a',
      por: 'b es falso porque un alfa alto es compatible con una estructura multidimensional, c confunde precisión con validez, y d corresponde al test-retest.'
    },
    {
      p: 'El error típico de medición se utiliza principalmente para:',
      ops: [
        'Determinar si un test es válido para un criterio',
        'Construir un intervalo de confianza alrededor del puntaje obtenido por un sujeto',
        'Estimar la dificultad de los ítems',
        'Comparar las medias de dos grupos normativos'
      ],
      ok: 'b',
      por: 'a corresponde a los estudios de validez de criterio, c al análisis de ítems, y d a una prueba de significación estadística ajena a la función del error de medición.'
    },
    {
      p: 'Sobre los percentiles es correcto afirmar que:',
      ops: [
        'Constituyen una escala de intervalos iguales, apta para promediar',
        'Tienen media 50 y desvío 10',
        'Indican el porcentaje del grupo normativo que obtuvo un puntaje igual o inferior, en una escala ordinal',
        'Equivalen directamente a los puntajes z'
      ],
      ok: 'c',
      por: 'a es incorrecto porque las unidades percentilares son desiguales, b describe el puntaje T, y d desconoce que la relación entre percentiles y z no es lineal.'
    },
    {
      p: 'En cuanto al material del Rorschach en el Sistema Comprehensivo, es correcto que:',
      ops: [
        'Consta de diez láminas, cinco acromáticas, dos en negro y rojo y tres policromadas',
        'Consta de diez láminas, todas policromadas',
        'Consta de veinte láminas divididas en dos series',
        'Consta de nueve figuras geométricas que el sujeto debe copiar'
      ],
      ok: 'a',
      por: 'b y c describen mal la composición y la cantidad del material, y d corresponde al test de Bender.'
    },
    {
      p: 'El Test Gestáltico Visomotor de Bender en su versión clásica:',
      ops: [
        'Está compuesto por diez láminas de manchas de tinta',
        'Evalúa exclusivamente el cociente intelectual',
        'Es un inventario autoadministrable de 567 ítems',
        'Consta de nueve figuras que el examinado copia, y en niños se puntúa habitualmente con el sistema de Koppitz'
      ],
      ok: 'd',
      por: 'a corresponde al Rorschach y c al MMPI-2, mientras que b es falso porque el Bender evalúa maduración visomotora y funciona como técnica de screening, no como medida de inteligencia.'
    },
    {
      p: 'La relación entre confiabilidad y validez puede formularse diciendo que:',
      ops: [
        'Un test válido puede no ser confiable',
        'La confiabilidad es condición necesaria pero no suficiente para la validez',
        'Confiabilidad y validez son sinónimos referidos a distintos momentos del test',
        'Un test confiable es necesariamente válido'
      ],
      ok: 'b',
      por: 'a es incorrecto porque una medida imprecisa no puede sostener interpretaciones válidas, c las identifica cuando son conceptos distintos, y d ignora que un test puede medir con precisión algo que no es el constructo buscado.'
    },
    {
      p: 'En la matriz multirrasgo-multimétodo, la evidencia de validez discriminante se obtiene cuando:',
      ops: [
        'El test correlaciona alto con otras medidas del mismo constructo',
        'El test predice adecuadamente un criterio externo futuro',
        'El test correlaciona bajo con medidas de constructos teóricamente diferentes',
        'Un panel de expertos juzga que los ítems representan el dominio'
      ],
      ok: 'c',
      por: 'a describe la evidencia convergente, b la validez predictiva, y d la evidencia basada en el contenido.'
    },
    {
      p: 'Una psicóloga administra un test estandarizado en otro país, con baremos de hace treinta años, y sin adaptación local. El principal problema es que:',
      ops: [
        'El test pierde confiabilidad test-retest',
        'Los puntajes brutos no pueden calcularse',
        'Se altera la escala de medición de los ítems',
        'La interpretación normativa es inadecuada porque el grupo de referencia no es representativo del evaluado'
      ],
      ok: 'd',
      por: 'a confunde el problema normativo con la precisión de la medida, b es falso porque el puntaje bruto se obtiene igual pero no significa nada por sí solo, y c no describe lo que ocurre al cambiar el baremo.'
    }
  ],
  oral: [
    {
      p: '¿Puede un test ser muy confiable y aun así no ser válido? Dé un ejemplo.',
      g: 'Sí. La confiabilidad indica que el instrumento mide con precisión y de manera consistente, pero no dice qué mide. Un test puede arrojar resultados muy estables y con alta consistencia interna y sin embargo no medir el constructo que se pretende: por ejemplo, una prueba de comprensión lectora muy extensa y precisa que se use para inferir capacidad de razonamiento abstracto. La relación es asimétrica: la confiabilidad es condición necesaria pero no suficiente para la validez, y de hecho la confiabilidad pone un techo a la magnitud que puede alcanzar un coeficiente de validez.'
    },
    {
      p: '¿Por qué es necesario actualizar periódicamente los baremos de un test?',
      g: 'Porque el baremo no describe al test sino a la población de referencia en un momento y un lugar determinados, y esa población cambia: cambian la escolarización, la alfabetización, la familiaridad con tareas gráficas y digitales, y las condiciones sociales. En el caso de los tests de inteligencia se documentó el efecto Flynn, un incremento generacional sostenido de los puntajes brutos, que hace que un baremo viejo sobrestime el rendimiento actual de la persona. A eso se suma la necesidad de baremos locales, porque aplicar normas extranjeras a una población argentina distorsiona la interpretación y puede llevar a decisiones clínicas o educativas equivocadas.'
    },
    {
      p: '¿Qué quiere decir que la validez no es una propiedad del test sino de las interpretaciones de sus puntajes?',
      g: 'Quiere decir que no corresponde afirmar que un test “es válido” sin más, sino que existe evidencia suficiente para sostener una interpretación determinada, con un propósito determinado y en una población determinada. Un mismo instrumento puede tener buen respaldo para describir un perfil clínico y ninguno para tomar una decisión de selección laboral, o tenerlo en adultos y no en adolescentes. Por eso la validación es un proceso acumulativo y siempre abierto, que integra distintas fuentes de evidencia, e incluye la consideración de las consecuencias del uso que se hace de los puntajes.'
    },
    {
      p: 'En una devolución, ¿cómo comunicaría el resultado de un CI y qué cuidados tendría?',
      g: 'Nunca comunicaría un número aislado. Informaría el puntaje con su intervalo de confianza, aclarando que es una estimación con margen de error, y lo describiría en términos del rango de desempeño y de su significado práctico. Si hay dispersión importante entre los índices, explicaría que el puntaje global es poco representativo y me detendría en el perfil de fortalezas y debilidades. Además señalaría que el resultado corresponde a un desempeño en una situación y un momento determinados, influido por la escolaridad, el estado emocional y las condiciones de administración, y que no define ni agota las capacidades ni el valor de la persona.'
    }
  ]
}
