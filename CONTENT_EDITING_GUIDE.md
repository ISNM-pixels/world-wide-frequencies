# World Wide Frequencies — administración

## Acceso privado

El panel está en https://world-wide-frequencies.vercel.app/admin.
El único administrador es `imagesoundandmedia@tutamail.com`. No hay registro público.

La primera contraseña se elige mediante el archivo privado `.qa/ACTIVATE_ADMIN.html`, que contiene un enlace de activación de un solo uso. Ese archivo no está en GitHub ni se publica. La contraseña de acceso al panel es independiente de la contraseña de Postgres. Nunca publiques archivos de `.qa/`, tokens ni claves privadas.

Las sesiones se conservan solo en la pestaña del navegador. Cierra sesión cuando termines. La recuperación de cuenta es asistida desde la cuenta propietaria de Supabase; no se ha contratado SMTP.

## Editar y publicar

1. Entra en Artistas o Lanzamientos y crea o selecciona una entrada.
2. Completa los datos. Los nombres pueden cambiar sin modificar sus direcciones públicas; los identificadores son estables.
3. Añade fotografías, portadas y fragmentos desde la propia ficha. Los archivos quedan en la biblioteca privada.
4. Pulsa **Guardar borrador**. Esto no modifica la web pública.
5. Revisa **Vista previa** y pulsa **Publicar** cuando esté listo.
6. El panel confirma la publicación únicamente cuando encuentra esa revisión en el dominio de producción.

El catálogo público se ordena por fecha de lanzamiento. El orden de artistas sí sigue el orden elegido en el panel. La asociación de artistas alimenta automáticamente los perfiles y créditos. Antes de eliminar un artista, desasócialo de sus lanzamientos.

En Configuración puedes editar el nombre, lema, presentación, contactos, redes, enlaces legales y lanzamiento destacado. Los botones de streaming aceptan cualquier plataforma mediante nombre y URL HTTP(S).

Si hay un conflicto entre pestañas, el servidor rechaza la sobrescritura: conserva tus cambios y recarga la última versión antes de volver a guardar. Las versiones publicadas anteriores se pueden recuperar como borrador para revisarlas y publicarlas otra vez. Una publicación pendiente se puede reintentar desde Resumen sin crear otra versión.

## Direcciones de las páginas

Las direcciones públicas no llevan `.html`: por ejemplo, `/artists/w-francis`, `/releases/identificador` o `/contact`. La compilación mantiene los archivos HTML estáticos; Vercel y el servidor local los sirven con direcciones limpias. Las direcciones anteriores con `.html` redirigen permanentemente (308) a las nuevas, conservando los parámetros de consulta. Los enlaces internos, canonical y sitemap utilizan estas direcciones. El JSON público normaliza también `profileUrl`, incluso si una versión anterior del CMS conserva el enlace antiguo.

## Archivos y cuota

- Imágenes de entrada: JPEG, PNG o WebP de hasta 15 MB. El navegador las convierte a WebP de hasta 1600 píxeles y 500 KB antes de subirlas. No se guarda el original.
- Audio: fragmentos MP3 ya preparados, de hasta 30 segundos y 2 MB. La duración completa de la canción se introduce aparte. Si no se conoce, deja el campo vacío: la web mostrará un guion y no inventará un tiempo.
- Límite interno de biblioteca: 50 MB. Los archivos idénticos se reutilizan mediante su checksum.
- Biblioteca: puedes eliminar archivos que no use el borrador ni las versiones conservadas.
- Se conservan la versión publicada y hasta dos versiones anteriores. No hay crons, Realtime ni keep-alive.

Supabase guarda el contenido administrativo y los archivos fuente privados. Durante una publicación Vercel descarga los archivos seleccionados, verifica sus checksums y los incorpora al sitio estático. Los visitantes leen páginas, imágenes y audio desde Vercel: no consultan Supabase ni necesitan cuenta.

Si Supabase pausa el proyecto gratuito, será necesario reanudarlo para administrar o publicar. La última versión desplegada en Vercel sigue disponible. El tráfico público de Vercel sigue sujeto a los límites de su propio plan.

## Conexión inicial de publicación

Proyecto Supabase exclusivo: **World Wide Frequencies**, ref `slnrpuaqjdvrodahgzbr`, Frankfurt, organización `vercel_icfg_rHIdnQtHgRSRWYgyXExSGwg3`.

1. En el proyecto Vercel existente, crea una variable **WWF_BUILD_TOKEN** para Production con el valor del archivo privado `.qa/VERCEL_BUILD_TOKEN.txt`. No uses prefijos públicos como `NEXT_PUBLIC_`.
2. Crea un Deploy Hook en Settings → Git para la rama `main` del repositorio `ISNM-pixels/world-wide-frequencies`.
3. En el panel de la web, Configuración → Conexión inicial con Vercel, introduce el Deploy Hook y pulsa **Conectar publicación**. El hook se guarda únicamente en el servidor, nunca vuelve al navegador.
4. Publica y comprueba la revisión en `/publication.json` y el estado del panel.

Una vez conectado el hook, las compilaciones de Vercel fallan de forma segura si falta el token: nunca sustituyen el catálogo gestionado por el JSON inicial del repositorio. Hasta completar esta conexión se admite un despliegue inicial desde el contenido local vacío, pero el botón Publicar muestra que la conexión está pendiente.

La integración opcional de GitHub dentro de Supabase no es necesaria para administrar el contenido ni publicar la web. Las migraciones y las funciones están versionadas en este repositorio. No habilites ramas Supabase ni extras de pago sin revisar su coste.

## Desarrollo y seguridad

Node 22 o posterior. Dependencias fijadas con lockfile.

```text
npm ci
npm run dev
npm test
```

El servidor local sirve únicamente `dist/`. Después de editar, ejecuta `npm run build` y recarga. Las pruebas unitarias usan catálogos y sesiones ficticias; las pruebas reales de integración son una operación puntual, con material privado temporal retirado al terminar.

`data/content.json` es el contenido inicial y el respaldo para desarrollo. Después de conectar el CMS, el borrador de Supabase es la fuente de edición y cada publicación es una copia inmutable. No edites `dist/`.

La función `wwf-admin` comprueba cada token de administrador con Supabase Auth y verifica su UUID contra la cuenta autorizada. El gateway JWT está desactivado porque el código valida las credenciales apropiadas para cada ruta: sesión para administrar, token privado para compilaciones y token de activación de un solo uso. Las tablas tienen RLS y no conceden acceso directo a `anon` ni `authenticated`. La clave privilegiada solo existe en el entorno de la Edge Function.

No guardes contraseñas de Postgres en migraciones. Todos los cambios remotos de esta implementación se restringen a `slnrpuaqjdvrodahgzbr`; el proyecto MPP está fuera del alcance.

## Demo Drop

El formulario conserva la validación y muestra “Demo submitted successfully.”. No envía correos ni guarda datos; se han retirado los textos públicos de simulación a petición del propietario. Conectar una recepción real será un trabajo separado.
