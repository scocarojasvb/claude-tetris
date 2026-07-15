#!/usr/bin/env bash
# Consulta el clima actual de una ciudad vía wttr.in (sin API key).
# Uso: clima.sh [ciudad]   (por defecto: Palmira, Valle del Cauca, Colombia)
set -euo pipefail

CIUDAD="${1:-Palmira}"
# wttr.in no codifica espacios en la ruta: los convertimos a '+'.
CIUDAD_URL="${CIUDAD// /+}"

# %l = ubicación, %t = temp, %f = sensación térmica, %C = condición,
# %h = humedad, %w = viento. lang=es para condiciones en español.
FORMATO='%l: %t (sensacion %f), %C, humedad %h, viento %w'

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: 'curl' no esta disponible en el sistema." >&2
  exit 1
fi

# -G + --data-urlencode codifica ciudad y formato (espacios/parentesis) de forma segura.
# --fail para que un error HTTP devuelva codigo != 0; timeout para no colgarse.
if ! curl -fsS --max-time 15 -G "https://wttr.in/${CIUDAD_URL}" \
     --data-urlencode "format=${FORMATO}" \
     --data-urlencode "lang=es"; then
  echo "Error: no se pudo obtener el clima desde wttr.in." >&2
  exit 1
fi
echo
