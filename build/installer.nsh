; Aviso al desinstalar, y limpieza extra.
;
; ─────────────────────────────────────────────────────────────────────────────
; PRIMERO, EL AVISO. Es lo más importante de este archivo.
; ─────────────────────────────────────────────────────────────────────────────
;
; `deleteAppDataOnUninstall: true` borra la carpeta de datos, y en esta app ahí
; adentro NO hay sólo caché y configuración: están las materias, las unidades,
; las tarjetas y el historial de repasos completo del usuario. Meses de estudio.
;
; Convertexto puede borrar su carpeta sin preguntar porque lo que hay ahí son
; modelos redescargables y transcripciones que el usuario ya exportó a Word. Acá
; no: lo que se borra es contenido propio que NO EXISTE EN NINGÚN OTRO LADO y que
; no se puede volver a generar.
;
; Por eso se pregunta antes, y la pregunta dice qué se pierde. Si el usuario dice
; que no, se conserva la carpeta: el programa se desinstala igual y sus tarjetas
; quedan intactas para cuando lo reinstale.
;
; ─────────────────────────────────────────────────────────────────────────────
; DESPUÉS, LAS CARPETAS ALTERNATIVAS
; ─────────────────────────────────────────────────────────────────────────────
;
; `deleteAppDataOnUninstall` borra %APPDATA%\Mediflashy (el productName coincide
; con APP_FOLDER, así que en el caso normal alcanza). Pero si la ruta del perfil
; tenía caracteres no ASCII, `dataRoot()` (src/main/services/core/paths.ts) pudo
; haber elegido una carpeta alternativa: ahí quedan los modelos, que pesan hasta
; 2,7 GB. Se borran las mismas alternativas que prueba la app.
;
; ATENCIÓN — dos cosas que este desinstalador NO debe tocar NUNCA:
;
;  1. Las carpetas de Convertexto, que se llaman "Transcriptor" y "Transcriptor2".
;     Muchos compradores van a tener las dos apps instaladas y funcionando: si las
;     borráramos, desinstalar Mediflashy le dejaría a Convertexto sin sus modelos
;     y sin su biblioteca de grabaciones. Ningún nombre de acá abajo las menciona.
;     Lo mismo con "Psicoflashy" y "Flashcards", las apps hermanas: este archivo
;     salió de copiar el de Psicoflashy y durante un tiempo borraba SUS carpetas.
;
;  2. La carpeta de la versión portable, que vive al lado del .exe. Ese caso no
;     pasa por este instalador, y el usuario que la borre lo hará a mano sabiendo
;     lo que borra.
;
; En una actualización no se toca nada, para no obligar a bajar el modelo de nuevo
; ni —mucho peor— borrarle las tarjetas a alguien que sólo está actualizando.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
      "¿Querés borrar también tus materias y tarjetas?$\r$\n$\r$\n\
Se van a perder TODAS tus materias, unidades y tarjetas, junto con todo tu historial de repasos. Esto no se puede deshacer.$\r$\n$\r$\n\
Si elegís NO, el programa se desinstala igual y tus tarjetas quedan guardadas para cuando lo vuelvas a instalar." \
      /SD IDNO IDYES borrarDatos IDNO conservarDatos

    borrarDatos:
      RMDir /r "$APPDATA\Mediflashy"
      RMDir /r "$TEMP\Mediflashy"
      RMDir /r "$LOCALAPPDATA\Mediflashy"
      RMDir /r "$%ProgramData%\Mediflashy"
      RMDir /r "$%SystemDrive%\Mediflashy-data"
      Goto finLimpieza

    conservarDatos:
      ; Se conservan las tarjetas, pero NO el modelo de IA: son hasta 2,7 GB que
      ; se pueden volver a descargar en un minuto, y dejarlos ocupando disco
      ; después de desinstalar es exactamente lo que nadie espera.
      RMDir /r "$APPDATA\Mediflashy\models"
      RMDir /r "$TEMP\Mediflashy\models"
      RMDir /r "$LOCALAPPDATA\Mediflashy\models"
      RMDir /r "$%ProgramData%\Mediflashy\models"
      RMDir /r "$%SystemDrive%\Mediflashy-data\models"

    finLimpieza:
  ${endIf}
!macroend
