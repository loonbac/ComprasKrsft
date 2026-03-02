<?php

namespace Modulos_ERP\ComprasKrsft\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Servicio de lógica de negocio para el flujo transversal
 * Proyectos → Compras → Almacén.
 *
 * Responsabilidades:
 * - Transiciones de estado de órdenes de compra
 * - Cálculo de precio unitario
 * - Gestión de reservas de inventario
 * - Liberación de materiales al finalizar proyecto
 * - Lógica de división de cantidades (stock + compra nueva)
 */
class CrossFlowService
{
    // ── Constantes de estado ────────────────────────────────────────────

    // Estados de purchase_orders en el flujo completo
    const STATUS_DRAFT     = 'draft';       // Supervisor ingresa materiales
    const STATUS_PENDING   = 'pending';     // Jefe aprueba → "Pendiente de Compra"
    const STATUS_TO_PAY    = 'to_pay';      // Agente aprueba → "Por Pagar"
    const STATUS_PURCHASED = 'purchased';   // Pagado → "Comprado"
    const STATUS_APPROVED  = 'approved';    // Legacy: aprobado directamente
    const STATUS_REJECTED  = 'rejected';

    // Estados de warehouse_status / estado_flujo en inventario
    const WH_PROXIMO     = 'proximo_a_llegar';
    const WH_APARTADO    = 'apartado';
    const WH_DISPONIBLE  = 'disponible';

    // ====================================================================
    //  1. TRANSICIONES DE ESTADO
    // ====================================================================

    /**
     * Marcar una orden como "Comprado" y calcular precio unitario.
     * Transición: to_pay → purchased
     *
     * Los materiales en inventario pasan a "Próximo a llegar".
     */
    public function markAsPurchased(int $orderId, float $totalPrice, ?int $userId = null): array
    {
        return DB::transaction(function () use ($orderId, $totalPrice, $userId) {
            $order = DB::table('purchase_orders')->find($orderId);

            if (!$order) {
                return ['success' => false, 'message' => 'Orden no encontrada'];
            }

            if (!in_array($order->status, [self::STATUS_TO_PAY, self::STATUS_APPROVED])) {
                return ['success' => false, 'message' => "Estado inválido para marcar como comprado: {$order->status}"];
            }

            // Calcular cantidad total de la orden
            $totalQty = $this->getOrderQuantity($order);

            // Calcular precio unitario
            $unitPrice = $totalQty > 0 ? $totalPrice / $totalQty : $totalPrice;

            // Actualizar orden
            DB::table('purchase_orders')->where('id', $orderId)->update([
                'status'          => self::STATUS_PURCHASED,
                'unit_price'      => round($unitPrice, 2),
                'qty_purchased'   => $totalQty,
                'warehouse_status' => self::WH_PROXIMO,
                'purchased_at'    => now(),
                'purchased_by'    => $userId ?? auth()->id(),
                'updated_at'      => now(),
            ]);

            // Actualizar items en inventario → "próximo a llegar"
            $this->updateInventoryFlowStatus($order, self::WH_PROXIMO);

            // Registrar historial de precios
            $this->recordPriceHistory($order, $totalPrice, $unitPrice, $totalQty);

            return [
                'success'    => true,
                'message'    => 'Orden marcada como comprada',
                'unit_price' => round($unitPrice, 2),
                'qty'        => $totalQty,
            ];
        });
    }

    /**
     * Confirmar recepción en almacén → materiales pasan a "Apartado".
     * Transición: purchased → (warehouse_status: apartado)
     */
    public function confirmWarehouseReceipt(int $orderId, ?int $userId = null): array
    {
        return DB::transaction(function () use ($orderId, $userId) {
            $order = DB::table('purchase_orders')->find($orderId);

            if (!$order) {
                return ['success' => false, 'message' => 'Orden no encontrada'];
            }

            if ($order->status !== self::STATUS_PURCHASED && $order->warehouse_status !== self::WH_PROXIMO) {
                return ['success' => false, 'message' => 'La orden no está en estado "Comprado/Próximo a llegar"'];
            }

            // Actualizar orden
            DB::table('purchase_orders')->where('id', $orderId)->update([
                'warehouse_status'       => self::WH_APARTADO,
                'delivery_confirmed'     => true,
                'delivery_confirmed_at'  => now(),
                'delivery_confirmed_by'  => $userId ?? auth()->id(),
                'updated_at'             => now(),
            ]);

            // Actualizar inventario → "apartado" (reservado para el proyecto)
            $this->updateInventoryFlowStatus($order, self::WH_APARTADO);

            return ['success' => true, 'message' => 'Materiales recibidos y apartados para el proyecto'];
        });
    }

    // ====================================================================
    //  2. FINALIZACIÓN DE PROYECTO
    // ====================================================================

    /**
     * Al finalizar un proyecto, liberar todos los materiales "Apartado" → "Disponible".
     * Calcula y persiste el precio unitario histórico.
     */
    public function releaseProjectMaterials(int $projectId, ?int $userId = null): array
    {
        return DB::transaction(function () use ($projectId, $userId) {
            $project = DB::table('projects')->find($projectId);
            if (!$project) {
                return ['success' => false, 'message' => 'Proyecto no encontrado'];
            }

            // 1. Liberar items del inventario
            $updatedInventory = DB::table('inventario_productos')
                ->where('project_id', $projectId)
                ->where(function ($q) {
                    $q->where('apartado', true)
                      ->orWhere('estado_flujo', self::WH_APARTADO);
                })
                ->get();

            $releasedCount = 0;

            foreach ($updatedInventory as $item) {
                // Calcular precio unitario si no existe
                $unitPrice = $item->precio_unitario;
                if (!$unitPrice && $item->cantidad > 0) {
                    $unitPrice = $item->precio / $item->cantidad;
                }

                DB::table('inventario_productos')
                    ->where('id', $item->id)
                    ->update([
                        'apartado'         => false,
                        'estado_flujo'     => self::WH_DISPONIBLE,
                        // Mantener project_id y nombre_proyecto para rastrear origen
                        'precio_unitario'  => $unitPrice ? round($unitPrice, 2) : null,
                        'updated_at'       => now(),
                    ]);

                $releasedCount++;
            }

            // 2. Liberar reservas activas
            DB::table('inventory_reservations')
                ->where('project_id', $projectId)
                ->where('status', 'active')
                ->update([
                    'status'      => 'released',
                    'released_by' => $userId ?? auth()->id(),
                    'released_at' => now(),
                    'notes'       => 'Liberado automáticamente al finalizar proyecto',
                    'updated_at'  => now(),
                ]);

            // 3. Actualizar warehouse_status de purchase_orders
            DB::table('purchase_orders')
                ->where('project_id', $projectId)
                ->where('warehouse_status', self::WH_APARTADO)
                ->update([
                    'warehouse_status' => self::WH_DISPONIBLE,
                    'updated_at'       => now(),
                ]);

            // 4. Marcar proyecto como completado
            DB::table('projects')
                ->where('id', $projectId)
                ->update([
                    'status'     => 'completed',
                    'updated_at' => now(),
                ]);

            Log::info('Materiales liberados por finalización de proyecto', [
                'project_id' => $projectId,
                'released'   => $releasedCount,
            ]);

            return [
                'success'        => true,
                'message'        => "Proyecto finalizado. {$releasedCount} materiales liberados al inventario disponible.",
                'released_count' => $releasedCount,
            ];
        });
    }

    // ====================================================================
    //  3. LÓGICA DE REUTILIZACIÓN DE STOCK (DIVISIÓN DE CANTIDADES)
    // ====================================================================

    /**
     * Obtener materiales disponibles en almacén para reutilización.
     * Solo devuelve items NO apartados con stock > 0.
     */
    public function getAvailableStock(string $search, ?int $excludeProjectId = null): array
    {
        if (!DB::getSchemaBuilder()->hasTable('inventario_productos')) {
            return ['available' => false, 'items' => []];
        }

        $search = str_replace(['%', '_'], ['\%', '\_'], $search);

        $items = DB::table('inventario_productos')
            ->where(function ($q) use ($search) {
                $q->where('nombre', 'LIKE', "%{$search}%")
                  ->orWhere('descripcion', 'LIKE', "%{$search}%")
                  ->orWhere('sku', 'LIKE', "%{$search}%")
                  ->orWhere('material_type', 'LIKE', "%{$search}%")
                  ->orWhere('diameter', 'LIKE', "%{$search}%")
                  ->orWhere('series', 'LIKE', "%{$search}%");
            })
            ->where('cantidad', '>', 0)
            ->where(function ($q) {
                $q->where('estado_flujo', self::WH_DISPONIBLE)
                  ->orWhere(function ($q2) {
                      $q2->where('apartado', false)
                         ->orWhereNull('apartado');
                  });
            })
            ->orderBy('nombre')
            ->get()
            ->map(function ($item) {
                $disponible = $item->cantidad - ($item->cantidad_reservada ?? 0);
                $unitPrice = $item->precio_unitario
                    ?? ($item->cantidad > 0 ? $item->precio / $item->cantidad : $item->precio);

                return [
                    'id'           => $item->id,
                    'name'         => $item->nombre,
                    'description'  => $item->descripcion,
                    'sku'          => $item->sku,
                    'available'    => max(0, $disponible),
                    'unitPrice'    => round($unitPrice, 2),
                    'totalPrice'   => $item->precio,
                    'currency'     => $item->moneda ?? 'PEN',
                    'unit'         => $item->unidad ?? 'UND',
                    'location'     => $item->ubicacion,
                    'diameter'     => $item->diameter,
                    'series'       => $item->series,
                    'materialType' => $item->material_type,
                    'estado_flujo' => $item->estado_flujo ?? self::WH_DISPONIBLE,
                ];
            })
            ->filter(fn($item) => $item['available'] > 0)
            ->values();

        return ['available' => true, 'items' => $items];
    }

    /**
     * Procesar selección mixta: parte de almacén + parte compra nueva.
     *
     * @param int   $orderId           ID de la orden de compra
     * @param int   $inventoryItemId   ID del producto en inventario
     * @param int   $qtyFromStock      Cantidad tomada del stock
     * @param float $newPurchasePrice  Precio total para la compra de la parte restante
     * @param int   $projectId         ID del proyecto
     *
     * @return array Resultado con costos calculados
     */
    public function processMixedSource(
        int $orderId,
        int $inventoryItemId,
        int $qtyFromStock,
        float $newPurchasePrice,
        int $projectId
    ): array {
        return DB::transaction(function () use ($orderId, $inventoryItemId, $qtyFromStock, $newPurchasePrice, $projectId) {
            $order = DB::table('purchase_orders')->find($orderId);
            if (!$order) {
                return ['success' => false, 'message' => 'Orden no encontrada'];
            }

            $inventoryItem = DB::table('inventario_productos')->find($inventoryItemId);
            if (!$inventoryItem) {
                return ['success' => false, 'message' => 'Item de inventario no encontrado'];
            }

            $totalQtyRequired = $this->getOrderQuantity($order);
            $qtyToBuy = max(0, $totalQtyRequired - $qtyFromStock);

            // Validar disponibilidad
            $disponible = $inventoryItem->cantidad - ($inventoryItem->cantidad_reservada ?? 0);
            if ($qtyFromStock > $disponible) {
                return ['success' => false, 'message' => "Stock insuficiente. Disponible: {$disponible}"];
            }

            // Precio unitario histórico del inventario
            $stockUnitPrice = $inventoryItem->precio_unitario
                ?? ($inventoryItem->cantidad > 0 ? $inventoryItem->precio / $inventoryItem->cantidad : 0);
            $stockCost = round($qtyFromStock * $stockUnitPrice, 2);

            // Precio unitario de la nueva compra
            $purchaseUnitPrice = $qtyToBuy > 0 ? $newPurchasePrice / $qtyToBuy : 0;

            // 1. Crear reserva de inventario
            $reservationId = DB::table('inventory_reservations')->insertGetId([
                'inventory_item_id'        => $inventoryItemId,
                'project_id'               => $projectId,
                'purchase_order_id'        => $orderId,
                'quantity_reserved'        => $qtyFromStock,
                'unit_price_at_reservation' => round($stockUnitPrice, 2),
                'total_cost'               => $stockCost,
                'currency'                 => $inventoryItem->moneda ?? 'PEN',
                'status'                   => 'active',
                'reserved_by'              => auth()->id(),
                'created_at'               => now(),
                'updated_at'               => now(),
            ]);

            // 2. Actualizar stock en inventario
            DB::table('inventario_productos')
                ->where('id', $inventoryItemId)
                ->update([
                    'cantidad_reservada' => DB::raw("cantidad_reservada + {$qtyFromStock}"),
                    'updated_at'         => now(),
                ]);

            // 3. Actualizar la orden con info de split
            $updateData = [
                'source_type'       => $qtyToBuy > 0 ? 'mixed' : 'inventory',
                'inventory_item_id' => $inventoryItemId,
                'reference_price'   => round($stockUnitPrice, 2),
                'updated_at'        => now(),
            ];

            // Si queda algo por comprar, ajustar la orden
            if ($qtyToBuy > 0) {
                $updateData['amount']       = $newPurchasePrice;
                $updateData['unit_price']   = round($purchaseUnitPrice, 2);
                $updateData['qty_purchased'] = $qtyToBuy;

                // Actualizar materiales JSON con la cantidad ajustada
                $materials = $order->materials ? json_decode($order->materials, true) : [];
                if (!empty($materials)) {
                    foreach ($materials as &$mat) {
                        $mat['original_qty'] = $mat['qty'] ?? $totalQtyRequired;
                        $mat['qty'] = $qtyToBuy;
                        $mat['qty_from_stock'] = $qtyFromStock;
                        $mat['stock_unit_price'] = round($stockUnitPrice, 2);
                        $mat['stock_cost'] = $stockCost;
                    }
                    unset($mat);
                    $updateData['materials'] = json_encode($materials);
                }
            } else {
                // 100% desde inventario
                $updateData['amount']     = 0;
                $updateData['amount_pen'] = 0;
                $updateData['status']     = self::STATUS_APPROVED;
                $updateData['payment_confirmed']    = true;
                $updateData['payment_confirmed_at'] = now();
                $updateData['delivery_confirmed']   = true;
                $updateData['delivery_confirmed_at'] = now();
                $updateData['warehouse_status']     = self::WH_APARTADO;
            }

            DB::table('purchase_orders')->where('id', $orderId)->update($updateData);

            // 4. Registrar historial de precios
            $this->recordMixedPriceHistory(
                $order, $projectId,
                $qtyFromStock, $stockUnitPrice, $stockCost,
                $qtyToBuy, $purchaseUnitPrice, $newPurchasePrice
            );

            return [
                'success'             => true,
                'message'             => $qtyToBuy > 0
                    ? "Dividido: {$qtyFromStock} de almacén + {$qtyToBuy} por comprar"
                    : "Totalmente cubierto con stock de almacén ({$qtyFromStock} unidades)",
                'reservation_id'      => $reservationId,
                'stock_qty'           => $qtyFromStock,
                'stock_unit_price'    => round($stockUnitPrice, 2),
                'stock_cost'          => $stockCost,
                'purchase_qty'        => $qtyToBuy,
                'purchase_unit_price' => round($purchaseUnitPrice, 2),
                'purchase_cost'       => $newPurchasePrice,
                'total_cost'          => $stockCost + $newPurchasePrice,
            ];
        });
    }

    /**
     * Calcular vista previa de división sin persistir cambios.
     */
    public function previewMixedSource(
        int $orderId,
        int $inventoryItemId,
        int $qtyFromStock
    ): array {
        $order = DB::table('purchase_orders')->find($orderId);
        if (!$order) {
            return ['success' => false, 'message' => 'Orden no encontrada'];
        }

        $inventoryItem = DB::table('inventario_productos')->find($inventoryItemId);
        if (!$inventoryItem) {
            return ['success' => false, 'message' => 'Item de inventario no encontrado'];
        }

        $totalQty = $this->getOrderQuantity($order);
        $qtyToBuy = max(0, $totalQty - $qtyFromStock);
        $disponible = $inventoryItem->cantidad - ($inventoryItem->cantidad_reservada ?? 0);

        if ($qtyFromStock > $disponible) {
            return ['success' => false, 'message' => "Stock insuficiente. Disponible: {$disponible}"];
        }

        $stockUnitPrice = $inventoryItem->precio_unitario
            ?? ($inventoryItem->cantidad > 0 ? $inventoryItem->precio / $inventoryItem->cantidad : 0);
        $stockCost = round($qtyFromStock * $stockUnitPrice, 2);

        return [
            'success'          => true,
            'total_required'   => $totalQty,
            'stock_qty'        => $qtyFromStock,
            'stock_unit_price' => round($stockUnitPrice, 2),
            'stock_cost'       => $stockCost,
            'purchase_qty'     => $qtyToBuy,
            'stock_available'  => $disponible,
            'currency'         => $inventoryItem->moneda ?? 'PEN',
        ];
    }

    /**
     * Obtener materiales con estado "próximo a llegar" para vista de almacén.
     */
    public function getIncomingMaterials(?int $projectId = null): array
    {
        $query = DB::table('purchase_orders')
            ->join('projects', 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name',
            ])
            ->where(function ($q) {
                $q->where('purchase_orders.warehouse_status', self::WH_PROXIMO)
                  ->orWhere(function ($q2) {
                      $q2->where('purchase_orders.status', self::STATUS_PURCHASED)
                         ->whereNull('purchase_orders.warehouse_status');
                  });
            });

        if ($projectId) {
            $query->where('purchase_orders.project_id', $projectId);
        }

        $orders = $query->orderBy('purchase_orders.purchased_at', 'desc')->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return ['success' => true, 'orders' => $orders, 'total' => $orders->count()];
    }

    /**
     * Obtener historial de precios de un material.
     */
    public function getMaterialPriceHistory(string $materialName, ?string $unit = null): array
    {
        $query = DB::table('material_price_history')
            ->where('material_name', 'LIKE', "%{$materialName}%")
            ->orderBy('created_at', 'desc');

        if ($unit) {
            $query->where('unit', $unit);
        }

        return $query->limit(20)->get()->toArray();
    }

    // ====================================================================
    //  MÉTODOS PRIVADOS
    // ====================================================================

    /**
     * Obtener cantidad total de una orden de compra.
     */
    private function getOrderQuantity(object $order): int
    {
        $materials = $order->materials ? json_decode($order->materials, true) : [];

        if (!empty($materials) && is_array($materials)) {
            return array_sum(array_map(fn($m) => intval($m['qty'] ?? 1), $materials));
        }

        return 1;
    }

    /**
     * Actualizar estado_flujo de los items de inventario asociados a una orden.
     */
    private function updateInventoryFlowStatus(object $order, string $newStatus): void
    {
        if (!DB::getSchemaBuilder()->hasTable('inventario_productos')) {
            return;
        }

        DB::table('inventario_productos')
            ->where('batch_id', $order->batch_id)
            ->where('project_id', $order->project_id)
            ->update([
                'estado_flujo' => $newStatus,
                'apartado'     => $newStatus === self::WH_APARTADO,
                'updated_at'   => now(),
            ]);
    }

    /**
     * Registrar historial de precios para una compra directa.
     */
    private function recordPriceHistory(object $order, float $totalPrice, float $unitPrice, int $qty): void
    {
        $materials = $order->materials ? json_decode($order->materials, true) : [];
        $materialName = !empty($materials) ? ($materials[0]['description'] ?? $order->description) : $order->description;

        DB::table('material_price_history')->insert([
            'purchase_order_id' => $order->id,
            'inventory_item_id' => $order->inventory_item_id ?? null,
            'project_id'        => $order->project_id,
            'material_name'     => $materialName,
            'unit'              => $order->unit ?? 'UND',
            'quantity'          => $qty,
            'total_price'       => $totalPrice,
            'unit_price'        => round($unitPrice, 2),
            'currency'          => $order->currency ?? 'PEN',
            'total_price_pen'   => $order->amount_pen ?? $totalPrice,
            'unit_price_pen'    => $order->amount_pen ? round($order->amount_pen / max($qty, 1), 2) : round($unitPrice, 2),
            'exchange_rate'     => $order->exchange_rate,
            'supplier_name'     => $order->seller_name,
            'supplier_document' => $order->seller_document,
            'source_type'       => 'purchase',
            'created_at'        => now(),
            'updated_at'        => now(),
        ]);
    }

    /**
     * Registrar historial de precios para una compra mixta (stock + compra nueva).
     */
    private function recordMixedPriceHistory(
        object $order,
        int $projectId,
        int $stockQty,
        float $stockUnitPrice,
        float $stockCost,
        int $purchaseQty,
        float $purchaseUnitPrice,
        float $purchaseCost
    ): void {
        $materials = $order->materials ? json_decode($order->materials, true) : [];
        $materialName = !empty($materials) ? ($materials[0]['description'] ?? $order->description) : $order->description;
        $unit = $order->unit ?? 'UND';

        // Registro de la parte de stock
        if ($stockQty > 0) {
            DB::table('material_price_history')->insert([
                'purchase_order_id' => $order->id,
                'inventory_item_id' => $order->inventory_item_id ?? null,
                'project_id'        => $projectId,
                'material_name'     => $materialName,
                'unit'              => $unit,
                'quantity'          => $stockQty,
                'total_price'       => $stockCost,
                'unit_price'        => round($stockUnitPrice, 2),
                'currency'          => $order->currency ?? 'PEN',
                'supplier_name'     => null,
                'source_type'       => 'inventory',
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
        }

        // Registro de la parte de compra nueva
        if ($purchaseQty > 0) {
            DB::table('material_price_history')->insert([
                'purchase_order_id' => $order->id,
                'project_id'        => $projectId,
                'material_name'     => $materialName,
                'unit'              => $unit,
                'quantity'          => $purchaseQty,
                'total_price'       => $purchaseCost,
                'unit_price'        => round($purchaseUnitPrice, 2),
                'currency'          => $order->currency ?? 'PEN',
                'supplier_name'     => $order->seller_name,
                'source_type'       => 'mixed',
                'created_at'        => now(),
                'updated_at'        => now(),
            ]);
        }
    }
}
