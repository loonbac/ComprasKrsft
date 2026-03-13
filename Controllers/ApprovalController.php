<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modulos_ERP\ComprasKrsft\Controllers\SupplierController;
use Modulos_ERP\ComprasKrsft\Services\ExchangeRateService;
use Modulos_ERP\ComprasKrsft\Services\InventoryService;
use Modulos_ERP\ComprasKrsft\Services\OrderService;

class ApprovalController extends Controller
{
    protected string $ordersTable = 'purchase_orders';
    protected string $projectsTable = 'projects';

    public function __construct(
        protected ExchangeRateService $exchangeRateService,
        protected InventoryService $inventoryService,
        protected OrderService $orderService
    ) {}

    /**
     * Aprobar internamente una orden pendiente y enviarla a Por Pagar
     */
    public function markToPay(Request $request, $id)
    {
        $order = DB::table($this->ordersTable)->find($id);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        if (!in_array($order->status, ['pending', 'to_pay'])) {
            return response()->json(['success' => false, 'message' => 'Esta orden ya fue procesada'], 400);
        }

        try {
            DB::table($this->ordersTable)
                ->where('id', $id)
                ->update(['status' => 'to_pay', 'updated_at' => now()]);

            // NO crear items de inventario aquí — se crean al confirmar pago

            return response()->json(['success' => true, 'message' => 'Orden enviada a Por Pagar']);
        } catch (\Exception $e) {
            Log::error('Error en markToPay', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al procesar la orden'], 500);
        }
    }

    /**
     * Aprobar múltiples órdenes y enviarlas a Por Pagar como una sola lista
     * Soporta: 100% inventario, split parcial, 100% compra externa
     */
    public function markToPayBulk(Request $request)
    {
        // Determinar si TODAS las órdenes son 100% inventario para relajar validación
        $allInventory = $this->isAllInventoryOnly($request);

        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'required|integer',
            'prices' => 'required|array',
            'prices.*' => 'required|numeric|min:0',
            'currency' => 'required|in:PEN,USD',
            'seller_name' => $allInventory ? 'nullable|string' : 'required|string',
        ]);

        try {
            $result = DB::transaction(function () use ($request) {
                $orderIds = $request->input('order_ids');
                $prices = $request->input('prices');
                $currency = $request->input('currency');

                if (!$this->orderService->verifyOrdersStatus($orderIds, 'pending')) {
                    return response()->json(['success' => false, 'message' => 'Algunas órdenes ya fueron procesadas'], 400);
                }

                $exchangeRate = $this->exchangeRateService->getRate();
                if ($currency === 'USD' && !$exchangeRate) {
                    return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 400);
                }

                $batchId = $this->orderService->generateBatchId('AP');
                $igvEnabled = $request->boolean('igv_enabled', false);
                $igvRate = floatval($request->input('igv_rate', 18.00));
                $sharedData = $this->orderService->buildSharedData($request, $exchangeRate, $batchId);

                $inventoryOrderIds = [];
                $purchaseOrderIds = [];
                $splits = $request->input('splits', []);

                foreach ($orderIds as $orderId) {
                    $split = $splits[$orderId] ?? null;

                    if ($split && !empty($split['inventory_item_id'])) {
                        // Determinar si es 100% inventario o split parcial
                        $order = DB::table($this->ordersTable)->find($orderId);
                        if (!$order) continue;

                        $totalQty = $this->getOrderQuantity($order);
                        $qtyFromInventory = intval($split['qty_from_inventory'] ?? 0);
                        $qtyToBuy = max(0, $totalQty - $qtyFromInventory);

                        if ($qtyToBuy <= 0) {
                            // CASO 1: 100% cubierto desde inventario
                            $this->processInventoryOnly($orderId, $split, $prices, $sharedData, $currency, $exchangeRate);
                            $inventoryOrderIds[] = $orderId;
                        } else {
                            // CASO 2: Split parcial (parte inventario + parte compra)
                            $newOrderId = $this->processSplitOrder(
                                $orderId, $split, $prices, $sharedData,
                                $currency, $exchangeRate, $igvEnabled, $igvRate,
                                $request, $batchId
                            );
                            if ($newOrderId) {
                                $inventoryOrderIds[] = $newOrderId;
                            }
                            $purchaseOrderIds[] = $orderId;
                        }
                    } else {
                        // CASO 3: Compra normal (100% externa)
                        $this->processExternalPurchase($orderId, $prices, $sharedData, $currency, $exchangeRate, $igvEnabled, $igvRate);
                        $purchaseOrderIds[] = $orderId;
                    }
                }

                // NO crear items de inventario aquí — se crean al confirmar pago (payBatch/confirmPayment)

                // Registrar proveedor automáticamente (solo si hay datos de proveedor)
                $sellerName = $request->input('seller_name');
                if ($sellerName) {
                    try {
                        SupplierController::upsertFromApproval(
                            $sellerName,
                            $request->input('seller_document')
                        );
                    } catch (\Throwable $e) {
                        Log::warning('Error al registrar proveedor en markToPayBulk', ['error' => $e->getMessage()]);
                    }
                }

                return $this->buildBulkResponse($orderIds, $inventoryOrderIds, $batchId);
            });

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en markToPayBulk', ['error' => $e->getMessage(), 'file' => $e->getFile(), 'line' => $e->getLine(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al procesar las órdenes'], 500);
        }
    }

    /**
     * Aprobar orden de compra individual y asignar precio
     */
    public function approve(Request $request, $id)
    {
        $order = DB::table($this->ordersTable)->find($id);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        if ($order->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Esta orden ya fue procesada'], 400);
        }

        $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'currency' => 'required|in:PEN,USD',
        ]);

        try {
            $amount = floatval($request->amount);
            $currency = $request->currency;
            $exchangeRate = $this->exchangeRateService->getRate();
            $amountPen = $amount;

            if ($currency === 'USD') {
                if (!$exchangeRate) {
                    return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 400);
                }
                $amountPen = $amount * $exchangeRate;
            }

            $igvEnabled = $request->boolean('igv_enabled', false);
            $igvRate = floatval($request->input('igv_rate', 18.00));
            $igv = $this->exchangeRateService->calculateIgv($amountPen, $igvEnabled, $igvRate);

            DB::table($this->ordersTable)->where('id', $id)->update([
                'amount' => $amount,
                'currency' => $currency,
                'exchange_rate' => $exchangeRate,
                'amount_pen' => $amountPen,
                'igv_enabled' => $igvEnabled,
                'igv_rate' => $igvRate,
                'igv_amount' => $igv['igv_amount'],
                'total_with_igv' => $igv['total_with_igv'],
                'status' => 'approved',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
                'notes' => $request->input('notes'),
                'issue_date' => $request->input('issue_date'),
                'payment_type' => $request->input('payment_type'),
                'payment_date' => $request->input('payment_type') === 'cash' ? $request->input('payment_date') : null,
                'due_date' => $request->input('payment_type') === 'loan' ? $request->input('due_date') : null,
                'seller_name' => $request->input('seller_name'),
                'seller_document' => $request->input('seller_document'),
                'expense_type' => $request->input('expense_type'),
                'updated_at' => now(),
            ]);

            // Enviar al inventario si es material
            $approvedOrder = $this->orderService->getOrderWithProject($id);
            if ($approvedOrder && $approvedOrder->type === 'material') {
                $materials = $approvedOrder->materials ? json_decode($approvedOrder->materials, true) : [];
                if (!empty($materials)) {
                    $inventoryItems = array_map(fn($m) => [
                        'description'   => $m['description'] ?? $m['name'] ?? $approvedOrder->description,
                        'qty'           => $m['qty'] ?? 1,
                        'unit'          => $m['unit'] ?? $approvedOrder->unit ?? 'UND',
                        'subtotal'      => $amount,
                        'currency'      => $currency,
                        'diameter'      => $m['diameter'] ?? $approvedOrder->diameter ?? null,
                        'series'        => $m['series']   ?? $approvedOrder->series   ?? null,
                        'material_type' => $m['material_type'] ?? $approvedOrder->material_type ?? null,
                        'amount_pen'    => $amountPen,
                    ], $materials);

                    $this->inventoryService->sendItems(
                        $approvedOrder->project_id,
                        $inventoryItems,
                        'AP-' . date('Ymd') . '-' . $id,
                        $approvedOrder->project_name
                    );
                }
            }

            // Registrar proveedor automáticamente
            try {
                SupplierController::upsertFromApproval(
                    $request->input('seller_name'),
                    $request->input('seller_document')
                );
            } catch (\Throwable $e) {
                Log::warning('Error al registrar proveedor en approve', ['error' => $e->getMessage()]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Orden aprobada exitosamente',
                'exchange_rate' => $exchangeRate,
                'amount_pen' => $amountPen,
            ]);
        } catch (\Exception $e) {
            Log::error('Error en approve', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al aprobar la orden'], 500);
        }
    }

    /**
     * Aprobar múltiples órdenes de compra en lote
     */
    public function approveBulk(Request $request)
    {
        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'required|integer',
            'prices' => 'required|array',
            'prices.*' => 'required|numeric|min:0.01',
            'currency' => 'required|in:PEN,USD',
            'seller_name' => 'required|string',
        ]);

        try {
            $result = DB::transaction(function () use ($request) {
                $orderIds = $request->input('order_ids');
                $prices = $request->input('prices');
                $currency = $request->input('currency');
                $igvEnabled = $request->boolean('igv_enabled', false);
                $igvRate = floatval($request->input('igv_rate', 18.00));

                if (!$this->orderService->verifyOrdersStatus($orderIds, 'pending')) {
                    return response()->json(['success' => false, 'message' => 'Algunas órdenes ya fueron procesadas'], 400);
                }

                $exchangeRate = $this->exchangeRateService->getRate();
                if ($currency === 'USD' && !$exchangeRate) {
                    return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 400);
                }

                $batchId = $this->orderService->generateBatchId('BATCH');
                $sharedData = $this->orderService->buildSharedData($request, $exchangeRate, $batchId, [
                    'status' => 'approved',
                ]);

                foreach ($orderIds as $orderId) {
                    $amount = floatval($prices[$orderId] ?? 0);
                    if ($amount <= 0) continue;

                    $amounts = $this->orderService->calculateAmounts($amount, $currency, $exchangeRate, $igvEnabled, $igvRate);

                    DB::table($this->ordersTable)->where('id', $orderId)->update(array_merge($sharedData, [
                        'amount' => $amount,
                        'amount_pen' => $amounts['amount_pen'],
                        'igv_amount' => $amounts['igv_amount'],
                        'total_with_igv' => $amounts['total_with_igv'],
                    ]));
                }

                // Enviar materiales al inventario
                $paidOrders = $this->orderService->getOrdersWithProject($orderIds);
                foreach ($paidOrders as $order) {
                    if ($order->type !== 'material') continue;
                    $amount = floatval($prices[$order->id] ?? 0);
                    if ($amount <= 0) continue;
                    $amountPen = $currency === 'USD' ? $amount * $exchangeRate : $amount;
                    $this->inventoryService->sendOrderItems($order, $amount, $currency, $amountPen, $batchId);
                }

                // Registrar proveedor automáticamente
                try {
                    SupplierController::upsertFromApproval(
                        $request->input('seller_name'),
                        $request->input('seller_document')
                    );
                } catch (\Throwable $e) {
                    Log::warning('Error al registrar proveedor en approveBulk', ['error' => $e->getMessage()]);
                }

                return [
                    'success' => true,
                    'message' => count($orderIds) . ' órdenes aprobadas exitosamente',
                    'batch_id' => $batchId,
                ];
            });

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en approveBulk', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al aprobar las órdenes'], 500);
        }
    }

    /**
     * Rechazar orden de compra
     */
    public function reject(Request $request, $id)
    {
        $order = DB::table($this->ordersTable)->find($id);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        if ($order->status !== 'pending') {
            return response()->json(['success' => false, 'message' => 'Esta orden ya fue procesada'], 400);
        }

        try {
            DB::table($this->ordersTable)->where('id', $id)->update([
                'status' => 'rejected',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
                'notes' => $request->input('notes', 'Rechazado'),
                'updated_at' => now(),
            ]);

            return response()->json(['success' => true, 'message' => 'Orden rechazada']);
        } catch (\Exception $e) {
            Log::error('Error en reject', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al rechazar la orden'], 500);
        }
    }

    // ====================================================================
    // MÉTODOS PRIVADOS para markToPayBulk
    // ====================================================================

    /**
     * CASO 1: Orden 100% cubierta desde inventario
     * NO se mezcla con $sharedData (facturación) — es transferencia interna pura.
     */
    private function processInventoryOnly(int $orderId, array $split, array $prices, array $sharedData, string $currency, ?float $exchangeRate): void
    {
        $referencePrice = floatval($split['reference_price'] ?? $prices[$orderId] ?? 0);
        $order = DB::table($this->ordersTable)->find($orderId);
        $qtyFromInventory = intval($split['qty_from_inventory'] ?? 0);
        $inventoryCost = round($referencePrice * $qtyFromInventory, 2);
        $inventoryCostPen = ($currency === 'USD' && $exchangeRate > 0)
            ? round($inventoryCost * $exchangeRate, 2)
            : $inventoryCost;

        // Enriquecer con datos del item de inventario si la orden no los tiene
        $enrichData = $this->enrichFromInventoryItem($split['inventory_item_id'] ?? null, $order);

        DB::table($this->ordersTable)->where('id', $orderId)->update(array_merge($enrichData, [
            'status' => 'approved',
            'source_type' => 'inventory',
            'inventory_item_id' => $split['inventory_item_id'] ?? null,
            'reference_price' => $referencePrice,
            'amount' => $inventoryCost,
            'amount_pen' => $inventoryCostPen,
            'igv_amount' => 0,
            'total_with_igv' => $inventoryCost,
            'igv_enabled' => false,
            'payment_confirmed' => true,
            'payment_confirmed_at' => now(),
            'payment_confirmed_by' => auth()->id(),
            'delivery_confirmed' => true,
            'delivery_confirmed_at' => now(),
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'updated_at' => now(),
        ]));

        $this->inventoryService->deductStock(
            $split['inventory_item_id'] ?? null,
            $split['qty_from_inventory'] ?? 0,
            $orderId,
            $order->project_id ?? null
        );
    }

    /**
     * Obtener datos de visualización del item de inventario.
     * SIEMPRE sobreescribe todos los campos con los datos exactos del inventario,
     * incluyendo vacíos (si inventario no tiene un dato, se deja vacío).
     */
    private function enrichFromInventoryItem(?int $inventoryItemId, ?object $order): array
    {
        $data = [];
        if (!$inventoryItemId) return $data;

        $invItem = DB::table('inventario_productos')->find($inventoryItemId);
        if (!$invItem) return $data;

        $data['description'] = $invItem->descripcion ?? '';
        $data['material_type'] = $invItem->material_type ?? $invItem->nombre ?? null;
        $data['diameter'] = $invItem->diameter ?? null;
        $data['series'] = $invItem->series ?? null;
        $data['unit'] = $invItem->unidad ?? null;

        return $data;
    }

    /**
     * CASO 2: Split parcial (parte inventario + parte compra)
     */
    private function processSplitOrder(
        int $orderId, array $split, array $prices, array $sharedData,
        string $currency, ?float $exchangeRate, bool $igvEnabled, float $igvRate,
        Request $request, string $batchId
    ): ?int {
        $originalOrder = DB::table($this->ordersTable)->find($orderId);
        if (!$originalOrder) return null;

        $qtyFromInventory = intval($split['qty_from_inventory']);
        $totalQty = $this->getOrderQuantity($originalOrder);
        $qtyToBuy = max(0, $totalQty - $qtyFromInventory);
        $referencePrice = floatval($split['reference_price'] ?? 0);
        $purchaseAmount = floatval($prices[$orderId] ?? 0);

        $amounts = $this->orderService->calculateAmounts($purchaseAmount, $currency, $exchangeRate, $igvEnabled, $igvRate);

        // Actualizar orden original como compra parcial
        $originalMaterials = $originalOrder->materials ? json_decode($originalOrder->materials, true) : [];
        if (!empty($originalMaterials)) {
            foreach ($originalMaterials as &$mat) {
                $mat['original_qty'] = $mat['qty'] ?? $totalQty;
                $mat['qty'] = $qtyToBuy;
                $mat['qty_from_stock'] = $qtyFromInventory;
                $mat['stock_unit_price'] = round($referencePrice, 2);
            }
            unset($mat);
        }

        DB::table($this->ordersTable)->where('id', $orderId)->update(array_merge($sharedData, [
            'status' => 'quoted',
            'source_type' => 'external',
            'amount' => $purchaseAmount,
            'amount_pen' => $amounts['amount_pen'],
            'igv_amount' => $amounts['igv_amount'],
            'total_with_igv' => $amounts['total_with_igv'],
            'materials' => json_encode($originalMaterials),
        ]));

        // Crear nueva orden para la parte de inventario
        $inventoryMaterials = $originalOrder->materials ? json_decode($originalOrder->materials, true) : [];
        if (!empty($inventoryMaterials)) {
            foreach ($inventoryMaterials as &$mat) {
                $mat['qty'] = $qtyFromInventory;
            }
            unset($mat);
        }

        // Obtener siguiente item_number disponible para el proyecto (evitar unique constraint)
        $maxItemNumber = DB::table($this->ordersTable)
            ->where('project_id', $originalOrder->project_id)
            ->max('item_number') ?? 0;
        $nextItemNumber = $maxItemNumber + 1;

        // Enriquecer con datos del item de inventario (siempre prioriza inventario)
        $invEnrich = $this->enrichFromInventoryItem($split['inventory_item_id'] ?? null, $originalOrder);
        $invDescription = $invEnrich['description'] ?? $originalOrder->description;
        $invMaterialType = $invEnrich['material_type'] ?? $originalOrder->material_type ?? null;
        $invDiameter = $invEnrich['diameter'] ?? $originalOrder->diameter ?? null;
        $invSeries = $invEnrich['series'] ?? $originalOrder->series ?? null;
        $invUnit = $invEnrich['unit'] ?? $originalOrder->unit ?? null;

        $newOrderId = DB::table($this->ordersTable)->insertGetId([
            'project_id' => $originalOrder->project_id,
            'type' => $originalOrder->type,
            'description' => $invDescription,
            'materials' => json_encode($inventoryMaterials),
            'unit' => $invUnit,
            'item_number' => $nextItemNumber,
            'source_type' => 'inventory',
            'inventory_item_id' => $split['inventory_item_id'] ?? null,
            'reference_price' => floatval($split['reference_price'] ?? 0),
            'parent_order_id' => $orderId,
            'amount' => round($referencePrice * $qtyFromInventory, 2),
            'amount_pen' => ($currency === 'USD' && $exchangeRate > 0)
                ? round($referencePrice * $qtyFromInventory * $exchangeRate, 2)
                : round($referencePrice * $qtyFromInventory, 2),
            'currency' => $currency,
            'exchange_rate' => $exchangeRate,
            'igv_amount' => 0,
            'total_with_igv' => round($referencePrice * $qtyFromInventory, 2),
            'igv_enabled' => false,
            'status' => 'approved',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'source_filename' => $originalOrder->source_filename ?? null,
            'imported_at' => $originalOrder->imported_at ?? null,
            'material_type' => $invMaterialType,
            'diameter' => $invDiameter,
            'series' => $invSeries,
            'notes' => $originalOrder->notes ?? null,
            'payment_confirmed' => true,
            'payment_confirmed_at' => now(),
            'payment_confirmed_by' => auth()->id(),
            'delivery_confirmed' => true,
            'delivery_confirmed_at' => now(),
            'created_by' => $originalOrder->created_by ?? auth()->id(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->inventoryService->deductStock(
            $split['inventory_item_id'] ?? null,
            $qtyFromInventory,
            $newOrderId,
            $originalOrder->project_id ?? null
        );

        return $newOrderId;
    }

    /**
     * CASO 3: Compra normal (100% externa)
     */
    private function processExternalPurchase(
        int $orderId, array $prices, array $sharedData,
        string $currency, ?float $exchangeRate, bool $igvEnabled, float $igvRate
    ): void {
        $amount = floatval($prices[$orderId] ?? 0);
        if ($amount <= 0) return;

        $amounts = $this->orderService->calculateAmounts($amount, $currency, $exchangeRate, $igvEnabled, $igvRate);

        DB::table($this->ordersTable)->where('id', $orderId)->update(array_merge($sharedData, [
            'status' => 'quoted',
            'amount' => $amount,
            'amount_pen' => $amounts['amount_pen'],
            'igv_amount' => $amounts['igv_amount'],
            'total_with_igv' => $amounts['total_with_igv'],
        ]));
    }

    /**
     * Enviar órdenes de compra (no inventario) al inventario
     */
    private function sendPurchaseOrdersToInventory(array $purchaseOrderIds, array $prices, string $currency, ?float $exchangeRate, string $batchId): void
    {
        if (empty($purchaseOrderIds)) return;

        $approvedOrders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select('purchase_orders.*', 'projects.name as project_name')
            ->whereIn('purchase_orders.id', $purchaseOrderIds)
            ->where('purchase_orders.source_type', 'external')
            ->get();

        foreach ($approvedOrders as $order) {
            if ($order->type !== 'material') continue;
            $amount = floatval($prices[$order->id] ?? 0);
            if ($amount <= 0) continue;
            $amountPen = ($currency === 'USD' && $exchangeRate) ? $amount * $exchangeRate : $amount;
            $this->inventoryService->sendOrderItems($order, $amount, $currency, $amountPen, $batchId);
        }
    }

    /**
     * Construir respuesta para markToPayBulk
     */
    private function buildBulkResponse(array $orderIds, array $inventoryOrderIds, string $batchId): array
    {
        $totalProcessed = count($orderIds);
        $inventoryCount = count($inventoryOrderIds);
        $purchaseCount = $totalProcessed - $inventoryCount;

        if ($inventoryCount > 0 && $purchaseCount > 0) {
            $message = "{$purchaseCount} cotizadas para revisión, {$inventoryCount} de Inventario (entregadas)";
        } elseif ($inventoryCount > 0) {
            $message = "{$inventoryCount} órdenes cubiertas con inventario";
        } else {
            $message = "{$purchaseCount} órdenes enviadas a Por Aprobar";
        }

        return [
            'success' => true,
            'message' => $message,
            'batch_id' => $batchId,
            'inventory_count' => $inventoryCount,
            'purchase_count' => $purchaseCount,
        ];
    }

    // ====================================================================
    // APROBACIÓN GERENCIAL DE COTIZACIONES (quoted → to_pay)
    // ====================================================================

    /**
     * Aprobar en lote las órdenes cotizadas y enviarlas a Por Pagar.
     * No requiere re-ingresar precios — ya fueron fijados en la cotización.
     */
    public function approveQuotedBulk(Request $request)
    {
        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'required|integer',
        ]);

        try {
            $result = DB::transaction(function () use ($request) {
                $orderIds = $request->input('order_ids');

                $orders = DB::table($this->ordersTable)
                    ->whereIn('id', $orderIds)
                    ->get();

                foreach ($orders as $order) {
                    if ($order->status !== 'quoted') {
                        return ['success' => false, 'message' => "La orden #{$order->id} no está en estado cotizado"];
                    }
                }

                DB::table($this->ordersTable)
                    ->whereIn('id', $orderIds)
                    ->where('status', 'quoted')
                    ->update([
                        'status'      => 'to_pay',
                        'approved_by' => auth()->id(),
                        'approved_at' => now(),
                        'updated_at'  => now(),
                    ]);

                $count = count($orderIds);
                return [
                    'success' => true,
                    'message' => "{$count} orden" . ($count !== 1 ? 'es' : '') . " enviada" . ($count !== 1 ? 's' : '') . " a Por Pagar",
                ];
            });

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en approveQuotedBulk', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al aprobar las cotizaciones'], 500);
        }
    }

    /**
     * Rechazar una cotización y devolverla a Pendiente para corrección.
     */
    public function rejectQuoted(Request $request, $id)
    {
        $order = DB::table($this->ordersTable)->find($id);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        if ($order->status !== 'quoted') {
            return response()->json(['success' => false, 'message' => 'La orden no está en estado cotizado'], 400);
        }

        try {
            DB::table($this->ordersTable)->where('id', $id)->update([
                'status'     => 'pending',
                'updated_at' => now(),
            ]);

            return response()->json(['success' => true, 'message' => 'Cotización devuelta a Pendiente para corrección']);
        } catch (\Exception $e) {
            Log::error('Error en rejectQuoted', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Rechazar en lote las cotizaciones y devolverlas a Por Cotizar.
     */
    public function rejectQuotedBulk(Request $request)
    {
        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'required|integer',
        ]);

        try {
            $result = DB::transaction(function () use ($request) {
                $orderIds = $request->input('order_ids');

                $orders = DB::table($this->ordersTable)
                    ->whereIn('id', $orderIds)
                    ->get();

                foreach ($orders as $order) {
                    if ($order->status !== 'quoted') {
                        return ['success' => false, 'message' => "La orden #{$order->id} no está en estado cotizado"];
                    }
                }

                DB::table($this->ordersTable)
                    ->whereIn('id', $orderIds)
                    ->where('status', 'quoted')
                    ->update([
                        'status'      => 'pending',
                        'amount'      => null,
                        'currency'    => 'PEN',
                        'seller_name' => null,
                        'seller_document' => null,
                        'batch_id'    => null,
                        'approved_by' => null,
                        'approved_at' => null,
                        'updated_at'  => now(),
                    ]);

                $count = count($orderIds);
                return [
                    'success' => true,
                    'message' => "{$count} orden" . ($count !== 1 ? 'es' : '') . " devuelta" . ($count !== 1 ? 's' : '') . " a Por Cotizar",
                ];
            });

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en rejectQuotedBulk', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al rechazar las cotizaciones'], 500);
        }
    }

    /**
     * Obtener cantidad total de una orden de compra desde su JSON de materiales
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
     * Verifica si TODAS las órdenes del request están 100% cubiertas por inventario.
     * Se usa para relajar la validación de seller_name.
     */
    private function isAllInventoryOnly(Request $request): bool
    {
        $orderIds = $request->input('order_ids', []);
        $splits = $request->input('splits', []);

        if (empty($orderIds) || empty($splits)) return false;

        foreach ($orderIds as $orderId) {
            $split = $splits[$orderId] ?? null;
            if (!$split || empty($split['inventory_item_id'])) return false;

            $order = DB::table($this->ordersTable)->find($orderId);
            if (!$order) return false;

            $totalQty = $this->getOrderQuantity($order);
            $qtyFromInventory = intval($split['qty_from_inventory'] ?? 0);

            if ($qtyFromInventory < $totalQty) return false;
        }

        return true;
    }
}
