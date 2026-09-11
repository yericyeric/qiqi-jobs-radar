# Qiqi Job Radar — empieza aquí

Ahora puedes alternar entre **Miami / South Florida** y **Charleston, South Carolina** desde el selector superior. Al cambiar de zona, el radar vuelve a los últimos 48 horas y una afinidad mínima de 70/100; da prioridad a los puestos del último día. Tus candidaturas permanecen guardadas. La demostración sigue usando ejemplos ficticios; las búsquedas automáticas todavía no están conectadas.

La fase 1 está implementada. Puedes explorar oportunidades, filtrar, ver por qué encajan, guardar o descartar empleos, editar el perfil, importar registros y seguir candidaturas.

## Publicar gratis la demostración en GitHub Pages

1. Descomprime `qiqi-job-radar-source.zip`.
2. Crea un repositorio público en GitHub y sube **el contenido** de la carpeta `qiqi-job-radar`. Incluye la carpeta oculta `.github`; contiene la publicación automática.
3. En el repositorio, abre **Settings → Pages** y elige **GitHub Actions**.
4. Abre **Actions → Publish fictional demo to GitHub Pages → Run workflow**.
5. Cuando termine, abre el enlace que muestra GitHub.

Esta demostración contiene empresas y vacantes ficticias, claramente identificadas. Los cambios se guardan solo en el navegador utilizado. No realiza búsquedas ni envía correos. Si cambias de navegador, no verás los mismos cambios. Puedes descargar una copia de tus datos desde **Sources & activity → Export workspace**.

El archivo `qiqi-job-radar-pages.zip` incluye una compilación estática lista para un alojamiento en la raíz de un dominio. Para la dirección habitual de proyecto de GitHub Pages, usa el flujo anterior: ajusta automáticamente el nombre del repositorio.

## Usar la aplicación privada con datos persistentes

La versión completa incluye servidor, acceso privado y PostgreSQL. GitHub guarda el código; la aplicación necesita además un alojamiento que ejecute Next.js y una base de datos PostgreSQL. Las instrucciones de conexión y configuración están en [README.md](README.md).

Todavía no se ha conectado una cuenta de alojamiento ni publicado el proyecto en tu GitHub. No se han enviado mensajes ni solicitudes de empleo.

## Qué sigue

La siguiente fase incorpora fuentes oficiales de empleo y comprobaciones automáticas. Después se añaden el descubrimiento de organizaciones y los avisos por correo. La arquitectura está preparada; esas funciones todavía no están activadas.

Los archivos de `samples/` muestran el formato de importación. En datos reales, guarda siempre la fuente de fechas, requisitos, contactos, salarios y afiliaciones. No supongas datos que el empleador no publica.
