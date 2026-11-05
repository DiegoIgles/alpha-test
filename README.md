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

## Datos

Las respuestas se guardan en `data/respuestas.json`, con nombres y edades de los participantes: respalda esa carpeta y no la compartas.

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
