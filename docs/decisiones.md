# Decisiones — BioConect

## TP1 — Git colaborativo
- Estrategia de branching: GitHub Flow (rama corta por feature, PR obligatorio, merge por squash).
- Motivo: es la recomendada por la catedra para proyectos con deploy continuo simple, y al ser un TP individual no necesito coordinar ramas paralelas de otras personas.

## Conflicto de merge
Se genero un conflicto real entre dos ramas (feature/titulo-a y feature/titulo-b) que
modificaban la misma linea del README partiendo del mismo commit base. Git no pudo
resolverlo solo porque no tiene forma de saber cual de las dos versiones de contenido
es la correcta - eso es una decision humana. Ademas, Git detecto el archivo como
binario en un merge intermedio (por diferencias de codificacion), por lo que no
inserto marcadores automaticos y hubo que reescribir el archivo a mano con el
contenido final decidido.
