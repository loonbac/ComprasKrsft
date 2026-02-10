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

                DB::table('inventario_productos')->insert([
                    'nombre' => $item['description'] ?? 'Material sin descripción',
                    'sku' => $sku,
                    'descripcion' => $item['description'] ?? '',
                    'cantidad' => $item['qty'] ?? 1,
                    'unidad' => $item['unit'] ?? 'UND',
                    'precio' => $item['subtotal'] ?? 0,
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
            foreach ($materials as $material) {
                $items[] = [
                    'description' => $material['description'] ?? $order->description,
                    'qty' => $material['qty'] ?? 1,
                    'unit' => $material['unit'] ?? $order->unit ?? 'UND',
                    'subtotal' => $amount,
                    'currency' => $currency,
                    'diameter' => $material['diameter'] ?? null,
                    'series' => $material['series'] ?? null,
                    'material_type' => $material['material_type'] ?? null,
                    'amount_pen' => $amountPen,
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
     * Descontar stock del inventario cuando se usa para cumplir un pedido
     */
    public function deductStock(?int $inventoryItemId, int $qty, int $orderId): void
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

            $newQty = max(0, $item->cantidad - $qty);

            DB::table('inventario_productos')
                ->where('id', $inventoryItemId)
                ->update([
                    'cantidad' => $newQty,
                    'updated_at' => now(),
                ]);

            Log::info('Stock descontado de inventario', [
                'inventory_item_id' => $inventoryItemId,
                'qty_deducted' => $qty,
                'new_qty' => $newQty,
                'purchase_order_id' => $orderId,
            ]);
        } catch (\Exception $e) {
            Log::error('Error al descontar inventario: ' . $e->getMessage());
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

        $items = DB::table('inventario_productos')
            ->where(function ($q) use ($search) {
                $q->where('nombre', 'LIKE', "%{$search}%")
                  ->orWhere('descripcion', 'LIKE', "%{$search}%")
                  ->orWhere('sku', 'LIKE', "%{$search}%")
                  ->orWhere('diameter', 'LIKE', "%{$search}%")
                  ->orWhere('series', 'LIKE', "%{$search}%")
                  ->orWhere('material_type', 'LIKE', "%{$search}%");
            })
            ->where('cantidad', '>', 0)
            ->orderByRaw('CASE WHEN apartado = 1 OR apartado = true THEN 1 ELSE 0 END')
            ->orderBy('nombre')
            ->get()
            ->map(function ($item) use ($projectId) {
                $unitCost = $item->cantidad > 0 ? ($item->precio / $item->cantidad) : $item->precio;
                $isReserved = $item->apartado && $item->project_id && $item->project_id != $projectId;

                return [
                    'id' => $item->id,
                    'nombre' => $item->nombre,
                    'descripcion' => $item->descripcion,
                    'sku' => $item->sku,
                    'cantidad_disponible' => $item->cantidad,
                    'precio_total' => $item->precio,
                    'costo_unitario' => round($unitCost, 4),
                    'moneda' => $item->moneda ?? 'PEN',
                    'unidad' => $item->unidad ?? 'und',
                    'diameter' => $item->diameter,
                    'series' => $item->series,
                    'material_type' => $item->material_type,
                    'project_id' => $item->project_id,
                    'nombre_proyecto' => $item->nombre_proyecto,
                    'apartado' => $isReserved,
                    'disponible' => !$isReserved,
                ];
            });

        return ['available' => true, 'items' => $items];
    }
}
