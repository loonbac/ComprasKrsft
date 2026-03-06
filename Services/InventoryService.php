<?php

namespace Modulos_ERP\ComprasKrsft\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class InventoryService
{
    /**
     * Enviar items comprados al inventario como apartados
     */
    public function sendItems(int $projectId, array $items, string $batchId, string $projectName): void
    {
        try {
            foreach ($items as $item) {
                $sku = 'INV-' . substr(md5($batchId . ($item['description'] ?? '') . microtime()), 0, 8);

                if (DB::table('inventario_productos')->where('sku', $sku)->exists()) {
                    continue;
                }

                $qty = intval($item['qty'] ?? 1);
                $subtotal = floatval($item['subtotal'] ?? 0);
                $unitPrice = $qty > 0 ? round($subtotal / $qty, 2) : 0;

                DB::table('inventario_productos')->insert([
                    'nombre' => $item['material_type'] ?? 'Material sin tipo',
                    'sku' => $sku,
                    'descripcion' => $item['description'] ?? '',
                    'cantidad' => $qty,
                    'unidad' => $item['unit'] ?? 'UND',
                    'precio' => $subtotal,
                    'precio_unitario' => $unitPrice,
                    'moneda' => $item['currency'] ?? 'PEN',
                    'categoria' => 'Materiales Comprados',
                    'ubicacion' => null,
                    'estado' => 'activo',
                    'apartado' => true,
                    'nombre_proyecto' => $projectName,
                    'estado_ubicacion' => 'pendiente',
                    'project_id' => $projectId,
                    'batch_id' => $batchId,
                    'diameter' => $item['diameter'] ?? null,
                    'series' => $item['series'] ?? null,
                    'material_type' => $item['material_type'] ?? null,
                    'amount' => $item['subtotal'] ?? 0,
                    'amount_pen' => $item['amount_pen'] ?? ($item['subtotal'] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                Log::info('Item agregado a inventario', [
                    'sku' => $sku,
                    'batch_id' => $batchId,
                    'project_id' => $projectId,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error sending items to inventory: ' . $e->getMessage());
        }
    }

    /**
     * Convertir una orden de compra a items de inventario y enviarlos
     */
    public function sendOrderItems(object $order, float $amount, string $currency, float $amountPen, string $batchId): void
    {
        $materials = $order->materials ? json_decode($order->materials, true) : [];
        $items = [];

        if (is_array($materials) && count($materials) > 0) {
            // Calcular la cantidad total para distribuir el monto proporcionalmente
            $totalQty = array_sum(array_map(fn($m) => intval($m['qty'] ?? 1), $materials));
            $totalQty = max($totalQty, 1);

            foreach ($materials as $material) {
                $qty = intval($material['qty'] ?? 1);
                // Distribuir proporcionalmente el monto total entre los materiales
                $materialAmount = $totalQty > 0 ? round(($qty / $totalQty) * $amount, 2) : $amount;
                $materialAmountPen = $totalQty > 0 ? round(($qty / $totalQty) * $amountPen, 2) : $amountPen;

                $items[] = [
                    'description' => $material['description'] ?? $order->description,
                    'qty' => $qty,
                    'unit' => $material['unit'] ?? $order->unit ?? 'UND',
                    'subtotal' => $materialAmount,
                    'currency' => $currency,
                    'diameter' => $material['diameter'] ?? null,
                    'series' => $material['series'] ?? null,
                    'material_type' => $material['material_type'] ?? null,
                    'amount_pen' => $materialAmountPen,
                ];
            }
        } else {
            $items[] = [
                'description' => $order->description,
                'qty' => 1,
                'unit' => $order->unit ?? 'UND',
                'subtotal' => $amount,
                'currency' => $currency,
                'diameter' => $order->diameter ?? null,
                'series' => $order->series ?? null,
                'material_type' => $order->material_type ?? null,
                'amount_pen' => $amountPen,
            ];
        }

        $this->sendItems(
            $order->project_id,
            $items,
            $batchId,
            $order->project_name
        );
    }

    /**
     * Reservar stock del inventario cuando se usa para cumplir un pedido.
     * Crea un registro en inventory_reservations para que el material
     * aparezca en el flujo de recuento al finalizar el proyecto.
     */
    public function deductStock(?int $inventoryItemId, int $qty, int $orderId, ?int $projectId = null): void
    {
        if (!$inventoryItemId || $qty <= 0) {
            return;
        }

        try {
            if (!DB::getSchemaBuilder()->hasTable('inventario_productos')) {
                Log::warning('Tabla inventario_productos no existe para descontar stock');
                return;
            }

            $item = DB::table('inventario_productos')->find($inventoryItemId);
            if (!$item) {
                Log::warning("Item de inventario #{$inventoryItemId} no encontrado para descontar");
                return;
            }

            // Precio unitario histórico del inventario
            $unitPrice = $item->precio_unitario
                ?? ($item->cantidad > 0 ? $item->precio / $item->cantidad : 0);
            $totalCost = round($qty * $unitPrice, 2);

            // Crear reserva de inventario para el flujo de recuento
            if ($projectId && DB::getSchemaBuilder()->hasTable('inventory_reservations')) {
                DB::table('inventory_reservations')->insert([
                    'inventory_item_id'         => $inventoryItemId,
                    'project_id'                => $projectId,
                    'purchase_order_id'         => $orderId,
                    'quantity_reserved'         => $qty,
                    'unit_price_at_reservation' => round($unitPrice, 2),
                    'total_cost'                => $totalCost,
                    'currency'                  => $item->moneda ?? 'PEN',
                    'status'                    => 'active',
                    'reserved_by'               => auth()->id(),
                    'created_at'                => now(),
                    'updated_at'                => now(),
                ]);

                // Incrementar cantidad_reservada (el stock físico no cambia, solo se marca como reservado)
                DB::table('inventario_productos')
                    ->where('id', $inventoryItemId)
                    ->update([
                        'cantidad_reservada' => DB::raw("COALESCE(cantidad_reservada, 0) + {$qty}"),
                        'updated_at' => now(),
                    ]);

                Log::info('Stock reservado de inventario con reservation', [
                    'inventory_item_id' => $inventoryItemId,
                    'qty_reserved' => $qty,
                    'unit_price' => $unitPrice,
                    'project_id' => $projectId,
                    'purchase_order_id' => $orderId,
                ]);
            } else {
                // Fallback: sin proyecto, descontar directamente (comportamiento legacy)
                $newQty = max(0, $item->cantidad - $qty);

                DB::table('inventario_productos')
                    ->where('id', $inventoryItemId)
                    ->update([
                        'cantidad' => $newQty,
                        'updated_at' => now(),
                    ]);

                Log::info('Stock descontado de inventario (sin proyecto)', [
                    'inventory_item_id' => $inventoryItemId,
                    'qty_deducted' => $qty,
                    'new_qty' => $newQty,
                    'purchase_order_id' => $orderId,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Error al descontar/reservar inventario: ' . $e->getMessage());
        }
    }

    /**
     * Buscar coincidencias en inventario para un material
     */
    public function search(string $search, ?int $projectId = null): array
    {
        $search = str_replace(['%', '_'], ['\%', '\_'], $search);

        if (!DB::getSchemaBuilder()->hasTable('inventario_productos')) {
            return ['available' => false, 'items' => collect([])];
        }

        // Dividir búsqueda en palabras individuales para búsqueda flexible.
        // Ej: "Cemento Portland tipo I" → busca items que contengan "cemento" OR "portland" OR "tipo"
        // Ignorar palabras muy cortas (< 3 chars) como "de", "la", "I", etc.
        $words = array_filter(
            preg_split('/\s+/', trim($search)),
            fn ($w) => mb_strlen($w) >= 3
        );

        // Si no quedan palabras útiles, usar el texto original
        if (empty($words)) {
            $words = [trim($search)];
        }

        // Solo devolver items realmente disponibles:
        // 1. Sin proyecto asociado (registrados manualmente en inventario)
        // 2. De proyectos terminados con materiales liberados (apartado=0)
        $items = DB::table('inventario_productos')
            ->where(function ($q) use ($words) {
                foreach ($words as $word) {
                    $escaped = str_replace(['%', '_'], ['\%', '\_'], $word);
                    $q->orWhere('nombre', 'LIKE', "%{$escaped}%")
                      ->orWhere('descripcion', 'LIKE', "%{$escaped}%")
                      ->orWhere('sku', 'LIKE', "%{$escaped}%")
                      ->orWhere('diameter', 'LIKE', "%{$escaped}%")
                      ->orWhere('series', 'LIKE', "%{$escaped}%")
                      ->orWhere('material_type', 'LIKE', "%{$escaped}%");
                }
            })
            ->where('cantidad', '>', 0)
            ->where(function ($q) {
                // Item disponible: no apartado (liberado de proyecto o registrado manualmente)
                $q->where('apartado', false)
                  ->orWhereNull('apartado');
            })
            ->orderBy('nombre')
            ->get()
            ->map(function ($item) {
                $reservada = (int) ($item->cantidad_reservada ?? 0);
                $disponible = max(0, (int) $item->cantidad - $reservada);
                $unitCost = $disponible > 0
                    ? ($item->precio_unitario ?? ($item->precio / $item->cantidad))
                    : 0;

                return [
                    'id'              => $item->id,
                    'name'            => $item->nombre,
                    'description'     => $item->descripcion,
                    'sku'             => $item->sku,
                    'stock_available'  => $disponible,
                    'unit_price'      => round($unitCost, 2),
                    'total_price'     => $item->precio,
                    'currency'        => $item->moneda ?? 'PEN',
                    'unit'            => $item->unidad ?? 'und',
                    'diameter'        => $item->diameter,
                    'series'          => $item->series,
                    'material_type'   => $item->material_type,
                    'location'        => $item->ubicacion ?? null,
                    'project_id'      => $item->project_id,
                    'nombre_proyecto'  => $item->nombre_proyecto,
                ];
            })
            ->filter(fn ($item) => $item['stock_available'] > 0)
            ->values();

        return ['available' => true, 'items' => $items];
    }
}
