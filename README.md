# CertiRecall

**CertiRecall** es una aplicación web de estudio para prepararse en fundamentos de Claude mediante recuerdo activo y repetición espaciada. Es un proyecto estático, funcional y publicable en GitHub Pages.

## Problemática y usuario objetivo

Leer o ver videos de forma pasiva no siempre permite recordar lo aprendido días después ni detectar los temas que necesitan refuerzo. CertiRecall está dirigida a estudiantes y profesionales con 15–20 minutos diarios que quieren organizar su repaso de API, prompting, herramientas, MCP, agentes y conceptos relacionados.

## Objetivo

Convertir un plan breve de estudio en sesiones de preguntas y repasos programados, para que cada persona practique recuperar la información y distribuya mejor su esfuerzo.

## Funcionalidades

- Plan de 10 días con lecciones ampliadas, glosario, ejemplos, errores comunes, fuentes oficiales y 12 preguntas por tema.
- Cuestionario de opción múltiple y flashcards con explicación y calificación de recuerdo.
- Opciones mezcladas de forma estable durante cada pregunta, con retroalimentación visual de la respuesta correcta e incorrecta.
- Repetición espaciada por tarjeta, preguntas marcadas para revisar, modo de preguntas difíciles y resumen de sesión.
- Fecha simulada para avanzar días y observar repasos vencidos.
- Inicio con avance, racha, pendientes y mapa de actividad de 30 días.
- Reporte con datos simulados o actividad propia, ranking de dificultad, gráficos SVG/CSS, tabla y preguntas falladas agrupadas por enunciado.
- Glosario buscable y simulacro de hasta 20 preguntas con temporizador y resultado por tema. El simulacro no altera el planificador.
- Ajustes de preguntas diarias, exportación e importación JSON y reinicio confirmado.
- Persistencia local en `localStorage`, diseño adaptable y soporte de modo oscuro del sistema.

Las vistas se abren con las rutas `#inicio`, `#estudiar`, `#quiz`, `#reporte`, `#ajustes`, `#glosario` y `#simulacro`.

## Recuerdo activo y repetición espaciada

El **recuerdo activo** consiste en intentar recuperar una idea antes de consultar la respuesta. Después, la persona califica la dificultad. La repetición espaciada programa el siguiente intento según esa calificación, favoreciendo volver a una tarjeta cuando conviene reforzarla.

El planificador es una simplificación inspirada en SM-2: la facilidad empieza en 2.5; «Otra vez» vuelve a la cola de la sesión y programa un día, «Difícil» aplica un factor de 1.2 y reduce la facilidad, «Bien» usa intervalos iniciales de 1 y 3 días y después multiplica por la facilidad, y «Fácil» añade un factor de 1.3 y aumenta la facilidad. Es una demostración educativa, no una implementación completa de Anki.

## Tecnologías

HTML5, CSS3 y JavaScript vanilla con módulos ES. Los datos de contenido e historial de demostración están en JSON. No se usan frameworks, dependencias, servicios externos ni backend.

## Estructura

```text
CertiRecall/
├── index.html
├── css/styles.css
├── data/
│   ├── temario.json
│   └── historial-demo.json
├── js/
│   ├── app.js
│   ├── data.js
│   ├── quiz.js
│   ├── report.js      # cálculo y presentación de reportes
│   ├── scheduler.js
│   ├── storage.js
│   └── ui.js          # vistas y componentes visuales
└── README.md
```

`temario.json` contiene `certificacion` y `dias`; cada día declara su número, tema, lección y preguntas. La lección puede incluir conceptos, ejemplo, errores comunes y fuentes. Cada pregunta tiene un identificador único y un nivel de dificultad; las preguntas de opción múltiple incluyen opciones y respuesta correcta, y las flashcards incluyen respuesta y explicación. `historial-demo.json` es una lista de 400 eventos ficticios con `fecha`, `preguntaId`, `temaId`, `calificacion`, `acierto` y `tiempoSeg`; utiliza preguntas que existen en el temario y distribuye la misma cantidad de eventos entre los temas.

La respuesta correcta aparece dos veces en cada posición (A, B, C y D) por tema en el JSON. Durante una sesión, las opciones se mezclan una sola vez y conservan el orden mientras se muestra la retroalimentación.

## Ejecución local

1. Abre esta carpeta en Visual Studio Code.
2. Instala/activa la extensión **Live Server** y ejecuta «Open with Live Server» sobre `index.html`.
3. No abras el archivo mediante doble clic: `fetch()` necesita un servidor HTTP para cargar los JSON. La aplicación mostrará esta indicación si detecta `file://`.

## Publicación en GitHub Pages

Publica la carpeta en la rama configurada para GitHub Pages y selecciona la raíz del repositorio como origen. Al ser un sitio estático sin build, `index.html` se sirve directamente.

**URL de GitHub Pages:** https://patriciosotohidalgo-source.github.io/CertiRecall/

> El temario es de ejemplo, no oficial. El reporte de demostración usa datos simulados con fines ilustrativos; revisa el contenido antes de usarlo como material de certificación.

## Uso de GitHub Copilot

Completa esta plantilla con la experiencia real del equipo antes de entregar:

- **Modelo utilizado:** [indicar modelo mostrado por la herramienta]
- **Tareas en las que ayudó:** [estructura, implementación, revisión, documentación, pruebas, etc.]
- **Sugerencias aceptadas:** [qué se aceptó y por qué]
- **Sugerencias modificadas:** [qué se adaptó y por qué]
- **Sugerencias rechazadas:** [qué se descartó y por qué]
