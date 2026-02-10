# Plan de Integración: Compras - Inventario

## Objetivo
Optimizar el gasto en materiales verificando existencias en inventario antes de realizar una compra ("Por Aprobar"), permitiendo el cumplimiento parcial o total del requerimiento con stock existente.

---

## 1. Análisis de Similitud (Backend)

### Endpoint de Búsqueda
Se utilizará/mejorará el endpoint existente `GET /search-inventory` para buscar materiales similares.

**Lógica de Búsqueda:**
- Búsqueda "fuzzy" o por palabras clave.
- Ejemplo: Si el ítem a comprar es "Grava de arena", buscar "Grava".
- Retornar coincidencias con Stock disponible > 0.

**Respuesta Esperada:**
```json
{
  "matches": [
    {
      "id": 105,
      "name": "Grava de Tierra",
      "stock_available": 50,
      "unit": "m3",
      "similarity_score": 0.85
    }
  ]
}
```

---

## 2. Flujo en Modal "Por Aprobar" (Frontend)

El modal donde se definen precios antes de pasar a "Por Pagar" será el punto de control.

### Interfaz de Usuario
1.  **Detección Automática:** Al abrir el modal, el sistema verificará en segundo plano (simultáneamente) si hay coincidencias para los materiales de la orden.
2.  **Indicador Visual:**
    - Si hay coincidencia, mostrar un icono/badge "📦 En Inventario" junto al nombre del material.
    - Hover/Click en el badge muestra qué ítems similares existen y su stock.
3.  **Acción de Dividir (Split):**
    - Botón **"Usar Stock"**.
    - Al hacer clic, se abre un pequeño popover o fila expandida.
    - **Input:** Cantidad a tomar de inventario (Máx: Stock disponible o Cantidad requerida).

### Lógica de División
Si el usuario decide usar stock (ej. Pedido: 30, Inventory: 20):
- La fila original se divide en dos:
    - **Fila A (Compra):** Cantidad 10. Precio editable (el usuario debe poner precio). Estado: `pending_payment`.
    - **Fila B (Inventario):** Cantidad 20. Precio 0 (bloqueado). Badge "De Inventario". Estado interno: `inventory_sourced`.

---

## 3. Procesamiento en Backend (Approve)

Al enviar el formulario "Aprobar":

1.  **Separación de Ítems:**
    - Los ítems de **Compra** siguen el flujo normal → Pasan a estado `to_pay`.
    - Los ítems de **Inventario** deben manejarse diferente:
        - **Opción A (Transferencia Inmediata):** Se crea una "Salida de Almacén" automáticamente y el ítem en la orden de compra se marca como `delivered` (Entregado) inmediatamente, saltándose el pago.
        - **Opción B (Reserva):** Se marca como `to_pickup` (Por Recoger) y se descuenta/reserva del stock físico.

### Cambios en Base de Datos (Sugeridos)
- **Tabla `purchase_order_items`**:
    - Nuevo campo `source_type`: `external` (default) vs `inventory`.
    - Nuevo campo `inventory_item_id`: FK al ítem de inventario usado.

---

## 4. Visualización en "Por Pagar"

- En la lista "Por Pagar", solo se muestra el monto de los ítems comprados.
- Los ítems de inventario pueden:
    - Omitirse de esta vista (ya que no se pagan).
    - O mostrarse en una sección separada "Materiales de Stock" dentro del detalle del lote, meramente informativo.

---

## 5. Resumen del Algoritmo de Coincidencia

1.  Normalizar strings (minusculas, quitar acentos).
2.  Tokenizar nombre del requerimiento (ej: "Tubo", "Acero", "2pulg").
3.  Buscar en DB Insumos que contengan tokens principales.
4.  Filtrar aquellos con `stock > 0`.
