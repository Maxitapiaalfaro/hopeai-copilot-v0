# Validación del Agente de Roleplay Clínico

HopeAI expande su experiencia multi-agente para que el terapeuta pueda ensayar con un "Paciente Simulado" que refleja la ficha clínica disponible. Este documento resume cómo preparar el entorno, ejecutar verificaciones automáticas y completar la validación manual para garantizar una simulación creíble e integrada en el flujo de trabajo clínico.

## Objetivos de la validación

- **Confirmar registro del agente**: asegurar que `ClinicalAgentRouter` reconoce al agente `roleplay` con instrucciones completas.
- **Verificar orquestación inteligente**: comprobar que `IntelligentIntentRouter` enruta solicitudes de roleplay con contexto enriquecido (`roleplay_profile`, `roleplay_state`, ficha).
- **Validar persistencia de contexto**: confirmar que `HopeAISystem` hidrata, actualiza y persiste `RoleplaySessionContext`.
- **Garantizar tipado coherente**: revisar que `types/clinical-types.ts` mantiene compatibilidad con el nuevo modo.

## Prerrequisitos

- Node.js ≥ 18 instalado.
- Dependencias del proyecto instaladas (`npm install`).
- Acceso a la ficha clínica y registros de sesión en almacenamiento configurado para `HopeAISystem`.

## Verificación automática

1. Ejecuta el script dedicado:

```bash
node scripts/test-roleplay-simulation.js
```

2. El script genera validaciones sobre los archivos clave:
   - `lib/clinical-agent-router.ts`
   - `lib/intelligent-intent-router.ts`
   - `lib/hopeai-system.ts`
   - `types/clinical-types.ts`

3. Se produce un reporte en `roleplay-agent-test-report.json` con el resumen de pruebas (éxitos, advertencias, fallas). Conservar este archivo para auditorías internas.

## Interpretación de resultados

- **Todos los checks PASS**: la configuración mínima para el roleplay está lista.
- **WARN**: revisar el detalle (palabras clave, foco terapéutico, etc.) y ajustar si se requiere mayor cobertura semántica.
- **FAIL**: bloquear despliegue hasta corregir el archivo señalado. El reporte incluye timestamp y contexto.

## Validación manual recomendada

- **Ensayo de sesión**: iniciar conversación en el chat, solicitar explícitamente "simula al paciente" y verificar que `HopeAISystem.sendMessage()` active el agente `roleplay` según la derivación descrita.
- **Revisión de estado**: durante la sesión, confirmar que el estado (`RoleplayPatientState`) refleja cambios tras cada intervención del terapeuta.
- **Revisión de ficha**: validar que la ficha clínica (`roleplay_ficha_snapshot`) se mantiene sincronizada con `PatientSessionMeta`.
- **Respuestas del paciente**: las respuestas deben permanecer dentro del marco clínico de la ficha, sin inventar datos externos.

## Seguimiento

- Integrar el script a la batería de verificaciones que corren previo a despliegues.
- Registrar métricas de uso y feedback del terapeuta para futuras mejoras del simulador.
- Actualizar este documento cuando se agreguen nuevos escenarios de roleplay o se modifique la arquitectura de orquestación.
