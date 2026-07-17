---
description: Crea un git worktree aislado para un requerimiento y ejecuta las instrucciones dadas dentro de ese worktree
---

El usuario invocó `/worktree` con el siguiente requerimiento:

$ARGUMENTS

Sigue estos pasos:

1. **Determina un nombre** corto en kebab-case para el worktree, basado en el requerimiento (ej: `fix-collision-bug`, `add-hold-piece`, `mejora-panel-ui`). No preguntes al usuario por el nombre, decídelo tú.

2. **Verifica el estado del repo** con `git status` antes de crear el worktree, para asegurarte de no pisar trabajo en curso.

3. **Crea el worktree** con una nueva rama basada en la rama actual:
   ```
   git worktree add .trees/<nombre> -b <nombre>
   ```
   Si `.trees/` no existe, se crea automáticamente. Asegúrate de que `.trees/` esté en `.gitignore` (agrégalo si no lo está, ya que estos directorios son de trabajo local y no deben commitearse).

4. **Cámbiate al worktree** usando la herramienta `EnterWorktree` (si está disponible) apuntando a `.trees/<nombre>`, para que todo el trabajo subsiguiente (lectura, edición, comandos) ocurra de forma aislada del código principal en el árbol de trabajo original.

5. **Ejecuta las instrucciones del requerimiento** de manera completa e independiente dentro de ese worktree: lee el código relevante, implementa los cambios, y verifica que funcionen (siguiendo las convenciones de este proyecto descritas en `CLAUDE.md`).

6. Al terminar, informa al usuario en qué worktree y rama quedó el trabajo (`.trees/<nombre>`, rama `<nombre>`), y qué cambios se hicieron. No hagas merge, push ni elimines el worktree a menos que el usuario lo pida explícitamente.
