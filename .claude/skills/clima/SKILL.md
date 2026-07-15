---
name: clima
description: Consulta el clima actual de una ciudad localmente vía wttr.in (sin API key). Úsala cuando el usuario pida el clima, temperatura, pronóstico o estado del tiempo de una ciudad. Por defecto consulta Palmira, Valle del Cauca, Colombia.
---

# Clima

Obtiene el clima actual de una ciudad usando `wttr.in` (servicio gratuito, sin API key, solo requiere `curl`).

## Uso

Ejecuta el script `scripts/clima.sh` pasando opcionalmente la ciudad como argumento.
Si no se pasa ciudad, usa **Palmira** (Valle del Cauca, Colombia) por defecto.

```bash
# Ciudad por defecto (Palmira)
bash .claude/skills/clima/scripts/clima.sh

# Otra ciudad
bash .claude/skills/clima/scripts/clima.sh "Bogota"
bash .claude/skills/clima/scripts/clima.sh "Medellin"
```

El script imprime: temperatura, sensación térmica, condición del cielo, humedad y viento.

## Reportar al usuario

Tras ejecutar el script, resume el resultado de forma breve en español:
temperatura, sensación térmica y condición del cielo. No repitas el JSON crudo.

## Notas

- Requiere conexión a internet y `curl` (disponible en Windows 10/11 y macOS/Linux).
- Si `wttr.in` no responde, informa al usuario en vez de reintentar en bucle.
- Este es un método **local** (una llamada `curl` desde la máquina del usuario),
  distinto de una búsqueda web.
