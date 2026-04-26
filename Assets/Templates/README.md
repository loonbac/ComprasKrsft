# Plantillas de Excel – Módulo de Compras (compraskrsft)

## Estructura del archivo de importación de materiales

El archivo Excel de importación de materiales utiliza la siguiente estructura de filas:

### Filas de Metadata (6-7)

Estas filas contienen información general de la orden de compra y se aplican a todos los materiales importados en el archivo.

| Fila | Columna A | Columna B | Columna C | Columna D |
|------|-----------|-----------|-----------|-----------|
| **6** | Fecha Requerida (YYYY-MM-DD o DD/MM/AAAA) | Prioridad (alta/media/baja) | Solicitado por | Cargo |
| **7** | *(vacío o reserva)* | *(vacío o reserva)* | *(vacío o reserva)* | *(vacío o reserva)* |

**Nota:** La fila 7 está reservada y puede estar vacía. El sistema extrae los valores de la fila 6.

### Filas de Encabezado (8-9)

| Fila | Contenido |
|------|-----------|
| 8 | Encabezados de columnas (ITEM, CANTIDAD, TIPO DE MATERIAL, etc.) |
| 9 | *(vacío o línea separadora)* |

### Filas de Datos (10+)

Comienzan en la fila 10 (1-indexed). Cada fila representa un material.

| Columna | Campo |
|---------|-------|
| A | ITEM (ignorado – se auto-asigna) |
| B | CANTIDAD |
| C | TIPO DE MATERIAL |
| D | ESPECIFICACION TECNICA |
| E | MEDIDA |
| F | TIPO DE CONEXIÓN |
| G | OBSERVACIONES |

### Ejemplo de valores de metadata

```
| Fecha Requerida | Prioridad | Solicitado por | Cargo |
|-----------------|-----------|----------------|-------|
| 2026-05-15      | alta      | Juan Pérez     | Supervisor de Compras |
```

### Validaciones

- **prioridad**: Solo se acepta `alta`, `media` o `baja` (insensible a mayúsculas). Valores inválidos se ignoran.
- **fecha_requerida**: Se acepta formato `YYYY-MM-DD` o `DD/MM/AAAA`. Fechas inválidas se ignoran.
- **solicitado_por** y **cargo**: Se recortan espacios en blanco. Si están vacíos, se almacenan como null.

### Compatibilidad hacia atrás

Si el archivo no contiene metadata en las filas 6-7 (están vacías), el sistema continúa funcionando normalmente y los campos de metadata quedan como null en todas las órdenes importadas.

## Archivo contasis_template.xlsx

Este archivo es una plantilla para el proceso de Contasis y no está relacionado con la importación de materiales.