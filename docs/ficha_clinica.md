## Análisis Arquitectónico: Ficha Clínica Asíncrona

### 1\. Observación General

La solicitud representa una evolución fundamental en la arquitectura del sistema: la introducción de **tareas de generación asíncronas y de larga duración**, iniciadas por eventos de la aplicación (creación de paciente, clic en UI) en lugar de por una entrada conversacional directa. Este nuevo patrón debe coexistir con el flujo de chat en tiempo real sin interferir en él, operando de manera independiente para generar un artefacto de datos persistente y de alto valor: la **Ficha Clínica**. La implementación exitosa de esta capacidad depende de una clara separación de responsabilidades y del uso de los componentes correctos del SDK para el trabajo adecuado.

-----

### 2\. Puntos Fuertes de la Visión del Producto

  * **Desacoplamiento Inteligente:** Separar la generación de la Ficha Clínica de la conversación activa es una decisión arquitectónica excelente. Evita bloquear la interfaz de usuario, permite que el modelo se tome el tiempo necesario para una síntesis de alta calidad y mejora la experiencia del psicólogo.
  * **Creación de Activos de Datos:** La Ficha Clínica se convierte en un activo de datos estructurado y anclado al paciente, un pilar para futuras funcionalidades como el seguimiento de la evolución, la identificación de patrones o la supervisión a largo plazo.
  * **Flujo de Trabajo Clínico Realista:** El modelo de una generación inicial automática seguida de actualizaciones explícitas bajo demanda refleja con precisión cómo se manejan los expedientes en la práctica clínica real.

-----

### 3\. Brechas y Riesgos Arquitectónicos

1.  **Sobrecarga del Orquestador Conversacional:** El `Orquestador / Enrutador de Intenciones` actual está diseñado para analizar y dirigir el *input conversacional inmediato* del usuario. Forzarlo a gestionar tareas asíncronas iniciadas por la UI (como "actualizar ficha") sobrecargaría su propósito, mezclando incorrectamente flujos de trabajo en tiempo real con procesos de fondo. Es la herramienta incorrecta para este trabajo y su mal uso generaría una arquitectura frágil y difícil de mantener.

2.  **Gestión de Estado y Persistencia del Artefacto:** La Ficha Clínica no es un mensaje de chat; es un documento persistente con su propio ciclo de vida y estado (ej. `generando`, `completado`, `error`, `actualizando`). El modelo de persistencia actual, centrado en `chat_sessions` en IndexedDB, es una base excelente pero insuficiente. Necesita una extensión para manejar estos nuevos artefactos de datos, su versionado y su estado de generación.

3.  **Riesgo de Grounding Clínico:** El riesgo más significativo es que el "Archivista Clínico", al sintetizar un historial extenso, pueda **alucinar o inventar detalles** no presentes en los datos originales. En un contexto clínico, una alucinación no es un error trivial; es un riesgo ético y de seguridad grave. El proceso de generación debe estar rigurosamente "anclado" (grounded) a los datos de origen (formulario inicial e historial de conversaciones).

-----

### 4\. Recomendación Estratégica (Basada en el SDK)

Para abordar estas brechas y materializar la visión de producto, recomiendo la implementación de los siguientes patrones arquitectónicos, utilizando componentes específicos del SDK de GenAI.

#### **a. Creación de un "Orquestador de Tareas Asíncronas"**

Propongo la creación de un nuevo componente, separado del enrutador conversacional, cuya única responsabilidad sea gestionar trabajos de IA de larga duración.

  * **Justificación:** Este orquestador no escuchará el input del chat, sino **eventos del sistema de la aplicación** (ej. `evento:pacienteCreado`, `evento:actualizarFichaClicado`). Esto crea una separación de responsabilidades limpia y escalable. El Orquestador conversacional maneja el diálogo; el Orquestador de Tareas maneja los procesos de fondo.
  * **Impacto Esperado:** Una arquitectura mucho más robusta y mantenible que aísla los flujos de trabajo síncronos de los asíncronos, previniendo cuellos de botella y simplificando la lógica de la aplicación.

#### **b. Extensión del Mecanismo de Persistencia para Fichas Clínicas**

Debemos ampliar nuestra estrategia de almacenamiento en el lado del cliente.

  * **Recomendación:** Extender la clase `ClinicalContextStorage` (basada en **IndexedDB**) del documento de arquitectura para incluir un nuevo `objectStore` llamado `fichas_clinicas`. Cada objeto en este almacén representará una Ficha Clínica y tendrá una estructura definida:
    ```typescript
    interface FichaClinicaState {
      fichaId: string; // e.g., "ficha-paciente-XYZ"
      pacienteId: string;
      estado: 'generando' | 'completado' | 'error' | 'actualizando';
      contenido: string; // El contenido Markdown/texto de la ficha
      version: number;
      ultimaActualizacion: Date;
      historialVersiones: { version: number, fecha: Date }[];
    }
    ```
  * **Justificación:** Esto proporciona un modelo de datos robusto para rastrear no solo el contenido de la ficha, sino también su estado actual, lo cual es crucial para reflejar en la UI si una ficha "está siendo actualizada".
  * **Impacto Esperado:** Gestión de estado completa y persistente para las Fichas Clínicas, permitiendo a la UI reaccionar a su ciclo de vida y proporcionando un historial de versiones auditable.

#### **c. Implementación del "Archivista Clínico" con `ai.models.generateContent`**

Para la generación real del contenido de la ficha, el Orquestador de Tareas Asíncronas debe invocar al especialista "Archivista Clínico" utilizando el método más adecuado del SDK.

  * **Componente del SDK:** **`ai.models.generateContent`**
  * **Justificación:** Esta es la elección crítica. A diferencia de `ai.chats.create`, que está diseñado para interacciones conversacionales con estado, `generateContent` es una llamada **sin estado (stateless)** y de un solo turno. Es perfecta para tareas de síntesis como esta, donde se proporciona un contexto completo de una vez y se espera una única salida estructurada. No necesitamos la sobrecarga de la gestión de historial de un objeto de chat.
  * **Flujo de Trabajo:**
    1.  El Orquestador de Tareas recupera todo el contexto necesario de IndexedDB (el formulario inicial o el historial completo de chats del paciente).
    2.  Se construye un único y completo `prompt` con todo este contexto.
    3.  Se realiza una única llamada a `ai.models.generateContent`.
  * **Componente del SDK Adicional:** **Ventana de contexto larga de Gemini (1-2M de tokens)**. Es fundamental mencionar al CEO que esta arquitectura es viable gracias a esta capacidad. Podemos consolidar historiales de pacientes muy extensos en un solo `prompt` sin necesidad de complejas estrategias de resumen intermedias, simplificando drásticamente la implementación.
  * **Impacto Esperado:** Una implementación de generación de fichas eficiente, de bajo acoplamiento y que aprovecha al máximo las capacidades nativas del modelo para procesar grandes volúmenes de texto.

#### **d. Aseguramiento del Grounding Clínico Mediante `systemInstruction`**

Para mitigar el riesgo de alucinaciones, debemos anclar rigurosamente la generación del modelo a los datos de origen.

  * **Componente del SDK:** Parámetro **`systemInstruction`** dentro de la llamada a `ai.models.generateContent`.
  * **Justificación:** Esta es la herramienta más poderosa del SDK para dirigir el comportamiento del modelo a un alto nivel. Crearemos una `systemInstruction` muy estricta para el "Archivista Clínico" que le ordene explícitamente: "*Actúa como un archivista clínico. Tu única tarea es sintetizar una ficha clínica formal basada exclusivamente en la información proporcionada. No infieras, no añadas información externa y no completes datos faltantes. Cita únicamente los hechos presentes en el historial y el formulario de admisión. La precisión y la fidelidad a la fuente son tu máxima prioridad.*"
  * **Impacto Esperado:** Reducción drástica del riesgo de alucinación. Aumenta la fiabilidad y seguridad clínica del contenido generado, convirtiendo al "Archivista Clínico" en una herramienta de síntesis y no de creación.

-----

### 5\. Consideraciones Adicionales

  * **Retroalimentación en la UI:** La aplicación cliente debe observar el `objectStore` de `fichas_clinicas` para actualizar la interfaz en tiempo real, mostrando indicadores de "generando ficha..." o "actualizando..." basados en el campo `estado`.
  * **Manejo de Errores:** El Orquestador de Tareas debe implementar un manejo de errores robusto. Si la llamada a `generateContent` falla, el `estado` de la ficha en IndexedDB debe actualizarse a `error` para que la UI pueda ofrecer al usuario la opción de reintentar.
  * **Optimización de Costos:** Las llamadas con contextos muy largos son más costosas. Debemos monitorizar el uso de tokens y considerar estrategias de caché con el módulo `ai.caches` del SDK para partes muy repetitivas del contexto si fuera necesario en el futuro.

Esta arquitectura proporciona un camino claro y robusto para implementar la funcionalidad de Ficha Clínica, alineándose perfectamente con las capacidades del SDK de GenAI y asegurando la escalabilidad y fiabilidad que un producto clínico de esta naturaleza exige.