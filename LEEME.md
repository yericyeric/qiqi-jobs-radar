# Activar los empleos reales de Qiqi

Ya está preparado el código para buscar en fuentes oficiales cada 15 minutos, sin pagar un servidor. Para activarlo en tu web hay que subir esta versión a GitHub. La programación no está activa solo por descargar el paquete.

## 1. Subir los archivos actualizados

Descomprime `qiqi-job-radar-live.zip` y abre la carpeta `qiqi-job-radar` que contiene.

Abre https://github.com/yericyeric/qiqi-jobs-radar/upload/main e inicia sesión si GitHub te lo pide. Arrastra el CONTENIDO de la carpeta, incluidos `components`, `lib`, `scripts`, `public`, `tests`, `package.json` y los demás archivos. No arrastres el ZIP ni la carpeta exterior `qiqi-job-radar`. Deben quedar al mismo nivel que los archivos que ya están en GitHub. Pulsa Commit changes para guardar en main.

Si GitHub ignora la carpeta oculta `.github`, el siguiente paso sustituye el archivo de publicación directamente.

## 2. Cambiar el archivo que publica la página

Abre https://github.com/yericyeric/qiqi-jobs-radar/edit/main/.github/workflows/pages.yml

Borra el contenido del editor y pega TODO el contenido de `publicar-qiqi.txt`, entregado junto a este paquete. Empieza por `name: Publish Qiqi live jobs`. No pegues esta guía dentro del editor.

Pulsa Commit changes y guarda directamente en main. No crees un segundo archivo de publicación: reemplaza `pages.yml`.

## 3. Comprobar que se publicó

Abre https://github.com/yericyeric/qiqi-jobs-radar/actions

Debe aparecer `Publish Qiqi live jobs`. Normalmente se inicia al guardar. Si no hay una ejecución nueva, selecciona ese nombre y pulsa Run workflow → main → Run workflow.

Espera a que build y deploy estén verdes. Abre https://yericyeric.github.io/qiqi-jobs-radar/ y recarga la página. Debe decir `Real job listings`, mostrar la hora de búsqueda y las fuentes disponibles. A partir de ahí GitHub intentará actualizar en intervalos de 15 minutos, aunque puede retrasarse. Tu computadora puede estar apagada.

## Qué incluye y qué esperar

Busca en siete empresas configuradas mediante Greenhouse, Lever y SmartRecruiters. Cubre Miami/South Florida y Charleston SC, incluido Johns Island. No es una búsqueda de todos los empleos de internet. Las opciones iniciales siguen siendo últimas 48 horas y afinidad mínima 70/100. Una lista vacía puede ser correcta; amplía los filtros para revisar ofertas anteriores. Revisa los requisitos del empleador antes de aplicar.

Las notas y candidaturas permanecen en el navegador de Qiqi. No se sincronizan entre dispositivos ni se suben al repositorio. Exporta una copia desde Sources & activity antes de borrar datos del navegador. No envía solicitudes ni correos automáticamente.

Mantén el repositorio público y el runner estándar incluido. No necesitas tarjeta, servidor, base de datos ni claves de una API de empleo. Los intervalos de GitHub son aproximados. Si deja de actualizar, mira Actions; GitHub puede desactivar programaciones tras un periodo prolongado sin actividad del repositorio.

## Si una ejecución falla

Abre la ejecución roja y el paso rojo. Un error 403 en Preserve job facts indica que GitHub bloquea la escritura del token: revisa Settings → Actions → General → Workflow permissions, selecciona Read and write permissions si está disponible, guarda y vuelve a ejecutar. Una política de organización puede impedir esa opción.

Si falla la publicación, Settings → Pages → Source debe seguir en GitHub Actions. Si aparece una fuente no disponible dentro de la app, las demás pueden seguir funcionando y se conserva la última información de esa fuente.

`qiqi-job-radar-pages.zip` contiene una compilación estática para el subdirectorio `/qiqi-jobs-radar`; por sí sola no programa búsquedas. El paquete de código y el workflow son los que activan las actualizaciones.
