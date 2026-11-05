# Test vocacional de ALPHA ACADEMY

Página con dos roles:

- **Usuario** (`/`): escribe sus datos, responde 36 frases y ve sus afinidades y las carreras de la UAGRM más cercanas a su perfil.
- **Administrador** (`/admin`): con contraseña, ve todas las respuestas, puede buscarlas, eliminarlas y descargarlas para Excel.

## Cómo iniciarla

Solo necesita Node.js 18 o superior; no hay que instalar dependencias.

```
npm start
```

Abre http://localhost:3000.

La primera vez se genera la contraseña de administrador: aparece en la consola y queda en `data/admin-password.txt`. Para elegir otra, define la variable `ADMIN_PASSWORD` antes de iniciar.

## Poner el logo

Guarda la imagen como `public/logo.png`. Reemplaza sola al recuadro "LOGO" en todas las pantallas.

## Usarla desde otros equipos

Por defecto solo responde en el propio equipo. Para abrirla a la red local, inicia así en PowerShell y entra con la IP del equipo:

```
$env:HOST="0.0.0.0"; npm start
```

Si se publica en internet, ponla detrás de HTTPS para proteger la contraseña y los datos personales.

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `PORT` | Puerto | `3000` |
| `HOST` | Interfaz de red | `127.0.0.1` |
| `ADMIN_PASSWORD` | Contraseña del panel | Generada al primer inicio |
| `DATA_DIR` | Carpeta de respuestas | `data/` |

## Publicarla en Vercel

No usa base de datos, pero el disco de Vercel no conserva archivos, así que las respuestas se guardan en Vercel Blob.

1. En el proyecto de Vercel, entra en **Storage → Create Storage → Blob**, elige acceso **Private** y conéctalo al proyecto en todos los entornos. El acceso privado es importante: las respuestas contienen datos personales.
2. En **Settings → Environment Variables**, agrega `ADMIN_PASSWORD` con una contraseña larga.
3. Vuelve a desplegar (**Deployments → Redeploy**). Los cambios solo se aplican en un despliegue nuevo.

En el plan Hobby, Blob incluye 2.000 operaciones avanzadas al mes: cada test enviado usa una, y cada vez que se abre el panel de administración se usa al menos otra. Si se supera algún límite, Vercel bloquea el almacén hasta que pasen 30 días. El consumo se ve en **Observability** dentro de Vercel. Conviene descargar el Excel de vez en cuando como respaldo.

## Datos

Fuera de Vercel, las respuestas se guardan en `data/respuestas.json`. Contienen nombres y edades de los participantes: respalda esos datos y no los compartas.

## Cómo se calcula el resultado

Las preguntas siguen las seis áreas de intereses del modelo RIASEC de Holland, con seis frases por área. Cada respuesta vale de 0 a 4 puntos y el total de un área se expresa en porcentaje.

Cada carrera tiene un código de tres áreas en `catalogo/carreras.json`. Su afinidad es el promedio de esas áreas con pesos de 50 %, 30 % y 20 %.

Las preguntas y los códigos de las carreras son una propuesta sin validación psicométrica: conviene que un profesional de orientación los revise. Se pueden ajustar editando `catalogo/test.json` y `catalogo/carreras.json`.

## Carreras

`catalogo/carreras.json` se tomó de https://www.uagrm.edu.bo/carreras el 4 de noviembre de 2026: 98 ofertas agrupadas en 58 carreras. Si la universidad cambia su oferta, hay que actualizar este archivo.

## Pruebas

```
npm test
```
