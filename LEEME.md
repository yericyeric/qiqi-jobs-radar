# Activar la búsqueda amplia de Qiqi

Esta actualización cambia el mínimo a 30/100 y exige relación con la carrera y habilidades de Qiqi. Combina fuentes directas con Remotive, Jobicy, Himalayas, Google Jobs y descubrimiento de páginas mediante Google.

## 1. Crear la cuenta gratuita de Google Jobs / SerpApi

Abre https://serpapi.com/users/sign_up y elige Free ($0). Actualmente incluye 250 búsquedas al mes. No elijas un plan de pago ni actives renovación automática de pago. Dentro de tu cuenta encontrarás tu API key.

Abre https://github.com/yericyeric/qiqi-jobs-radar/settings/secrets/actions y pulsa New repository secret.

Name: SERPAPI_API_KEY
Secret: pega la clave de SerpApi.

Pulsa Add secret. No compartas la clave en el chat, no la pongas en un archivo del repositorio y no le añadas el prefijo NEXT_PUBLIC.

## 2. Subir la versión nueva

Descomprime qiqi-job-radar-amplio.zip y abre la carpeta qiqi-job-radar.

En https://github.com/yericyeric/qiqi-jobs-radar/upload/main arrastra el contenido de esa carpeta, no el ZIP ni la carpeta exterior. Deben quedar components, lib, scripts, public, tests y package.json al mismo nivel que los archivos actuales. Pulsa Commit changes para guardar en main.

## 3. Actualizar la publicación

Abre https://github.com/yericyeric/qiqi-jobs-radar/edit/main/.github/workflows/pages.yml

Reemplaza TODO el contenido del editor por el de publicar-qiqi.txt que acompaña esta actualización. Guarda con Commit changes en main. Es importante reemplazar el archivo anterior: este conecta el secreto de SerpApi con las búsquedas. Si GitHub ignoró la carpeta oculta .github al subir archivos, este paso instala igualmente el cambio principal.

## 4. Ejecutar y comprobar

Abre https://github.com/yericyeric/qiqi-jobs-radar/actions. Selecciona Publish Qiqi live jobs y, si no se inició una ejecución nueva, pulsa Run workflow → main → Run workflow.

Cuando build y deploy estén verdes, abre https://yericyeric.github.io/qiqi-jobs-radar/ y recarga. Debes ver 30+ possible fit. En Sources & activity aparecen cada portal, sus resultados, su última revisión y su siguiente búsqueda. Google no debe decir Waiting for free API key. Si la clave aún falta, los portales públicos siguen funcionando.

## Frecuencias y coste

GitHub publica una actualización cada 15 minutos aproximadamente. Eso no significa que todos los portales permitan una búsqueda nueva cada 15 minutos.

- Fuentes directas de empleadores: cada 15 minutos.
- Remotive y Jobicy: cada 6 horas, respetando sus límites. Remotive publica en su API con un retraso de 24 horas.
- Himalayas: una revisión diaria de hasta 1.000 anuncios recientes, con selección local de puestos remotos compatibles con Estados Unidos o sin restricción geográfica.
- Google Jobs: una búsqueda por ciudad cada 8 horas; rota entre eventos, producción y medios/contenido.
- Google general: una búsqueda cada 48 horas, alternando Miami y Charleston.

El código limita Google Jobs + Google general a 210 solicitudes por ventana de 31 días. Al llegar al límite, pausa esas búsquedas. La clave debe ser de una cuenta Free; otros usos de la misma clave también consumen la cuota de SerpApi. Esta versión no compra créditos ni cambia tu plan.

## Cómo se analizan los resultados

Primero se descartan empleos ajenos a su carrera, localizaciones incompatibles y ventas engañosas. Después se calcula afinidad por responsabilidades, habilidades, nivel, antigüedad y posibilidad de aplicar. A partir de 30/100 pueden entrar como Possible fit: los requisitos desconocidos siguen pendientes, no se dan por cumplidos. Los filtros iniciales mantienen últimas 48 horas y priorizan el último día; puedes ampliarlos para ver oportunidades anteriores.

Las ofertas de Google Jobs se analizan con su descripción y conservan la fuente. Fechas como “3 hours ago” se etiquetan estimated, no se convierten en fechas originales confirmadas. Las páginas de Google general que parecen relevantes se muestran aparte como Promising pages from web search; pueden ser bolsas de trabajo, directorios o páginas de empresas, no necesariamente una oferta vigente.

La búsqueda amplia no está restringida a siete empresas. Las siete originales quedan como seguimiento adicional. Ningún servicio cubre toda la web; la sección de fuentes muestra qué se consultó realmente. LinkedIn, Indeed u otros portales pueden aparecer en resultados del buscador, pero esta versión no afirma consultar directamente sus páginas ni sortea bloqueos.

Las notas, guardados y candidaturas permanecen en el navegador de Qiqi. No se suben a GitHub ni se sincronizan entre dispositivos. Exporta una copia desde Sources & activity antes de borrar datos del navegador. No se envían solicitudes ni correos automáticamente.

Si falla una ejecución, abre el paso rojo en Actions. Si Google indica error, comprueba que SERPAPI_API_KEY existe, que la clave sigue activa y que la cuota gratuita no se agotó. Si falla Preserve job facts con 403, revisa Settings → Actions → General → Workflow permissions. Pages debe seguir configurado con Source: GitHub Actions.
