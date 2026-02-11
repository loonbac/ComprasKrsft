<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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

            $approvedOrder = $this->orderService->getOrderWithProject($id);

            if ($approvedOrder && $approvedOrder->type === 'material') {
                $this->inventoryService->sendOrderItems(
                    $approvedOrder,
                    floatval($approvedOrder->amount ?? 0),
                    $approvedOrder->currency ?? 'PEN',
                    floatval($approvedOrder->amount_pen ?? 0),
                    $approvedOrder->batch_id ?: 'AP-' . date('Ymd') . '-' . $id
                );
            }

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
        $request->validate([
            'order_ids' => 'required|array|min:1',
            'order_ids.*' => 'required|integer',
            'prices' => 'required|array',
            'currency' => 'required|in:PEN,USD',
            'seller_name' => 'required|string',
        ]);

        try {
            $result = DB::transaction(function () use ($request) {
                $orderIds = $request->input('order_ids');
                $prices = $request->input('prices');
                $currency = $request->input('currency');
                $inventorySplits = $request->input('inventory_splits', []);

                if (!$this->orderService->verifyOrdersStatus($orderIds, 'pending')) {
                    return response()->json(['success' => false, 'message' => 'Algunas órdenes ya fueron procesadas'], 400);
                }

                $exchangeRate = null;
                if ($currency === 'USD') {
                    $exchangeRate = $this->exchangeRateService->getRate();
                    if (!$exchangeRate) {
                        return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 400);
                    }
                }

                $batchId = $this->orderService->generateBatchId('AP');
                $igvEnabled = $request->boolean('igv_enabled', false);
                $igvRate = floatval($request->input('igv_rate', 18.00));
                $sharedData = $this->orderService->buildSharedData($request, $exchangeRate, $batchId);

                $inventoryOrderIds = [];

                foreach ($orderIds as $orderId) {
                    $split = $inventorySplits[$orderId] ?? [];
                    $sourceType = $split['source_type'] ?? 'external';

                    // CASO 1: 100% desde inventario
                    if ($sourceType === 'inventory' && (!isset($split['qty_to_buy']) || $split['qty_to_buy'] <= 0)) {
                        $this->processInventoryOnly($orderId, $split, $prices, $sharedData, $currency, $exchangeRate);
                        $inventoryOrderIds[] = $orderId;
                        continue;
                    }

                    // CASO 2: Split parcial (parte inventario + parte compra)
                    if ($sourceType === 'split' && isset($split['qty_from_inventory']) && $split['qty_from_inventory'] > 0) {
                        $newOrderId = $this->processSplitOrder(
                            $orderId, $split, $prices, $sharedData,
                            $currency, $exchangeRate, $igvEnabled, $igvRate, $request, $batchId
                        );
                        if ($newOrderId) {
                            $inventoryOrderIds[] = $newOrderId;
                        }
                        continue;
                    }

                    // CASO 3: Compra normal (100% externa)
                    $this->processExternalPurchase($orderId, $prices, $sharedData, $currency, $exchangeRate, $igvEnabled, $igvRate);
                }

                // Enviar órdenes de COMPRA al inventario
                $this->sendPurchaseOrdersToInventory(
                    array_diff($orderIds, $inventoryOrderIds),
                    $prices, $currency, $exchangeRate, $batchId
                );

                return $this->buildBulkResponse($orderIds, $inventoryOrderIds, $batchId);
            });

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en markToPayBulk', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
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
            $exchangeRate = null;
            $amountPen = $amount;

            if ($currency === 'USD') {
                $exchangeRate = $this->exchangeRateService->getRate();
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
                'updated_at' => now(),
            ]);

            // Enviar al inventario si es material
            $approvedOrder = $this->orderService->getOrderWithProject($id);
            if ($approvedOrder && $approvedOrder->type === 'material') {
                $materials = $approvedOrder->materials ? json_decode($approvedOrder->materials, true) : [];
                if (!empty($materials)) {
                    $inventoryItems = array_map(fn($m) => [
                        'description' => $m['description'] ?? $approvedOrder->description,
                        'qty' => $m['qty'] ?? 1,
                        'unit' => $m['unit'] ?? $approvedOrder->unit ?? 'UND',
                        'subtotal' => $amount,
                        'currency' => $currency,
                        'diameter' => $m['diameter'] ?? null,
                        'series' => $m['series'] ?? null,
                        'material_type' => $m['material_type'] ?? null,
                        'amount_pen' => $amountPen,
                    ], $materials);

                    $this->inventoryService->sendItems(
                        $approvedOrder->project_id,
                        $inventoryItems,
                        'AP-' . date('Ymd') . '-' . $id,
                        $approvedOrder->project_name
                    );
                }
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

                $exchangeRate = null;
                if ($currency === 'USD') {
                    $exchangeRate = $this->exchangeRateService->getRate();
                    if (!$exchangeRate) {
                        return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 400);
                    }
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
     */
    private function processInventoryOnly(int $orderId, array $split, array $prices, array $sharedData, string $currency, ?float $exchangeRate): void
    {
        $referencePrice = floatval($split['reference_price'] ?? $prices[$orderId] ?? 0);

        DB::table($this->ordersTable)->where('id', $orderId)->update(array_merge($sharedData, [
            'status' => 'approved',
            'source_type' => 'inventory',
            'inventory_item_id' => $split['inventory_item_id'] ?? null,
            'reference_price' => $referencePrice,
            'amount' => 0,
            'amount_pen' => 0,
            'igv_amount' => 0,
            'total_with_igv' => 0,
            'payment_confirmed' => true,
            'payment_confirmed_at' => now(),
            'payment_confirmed_by' => auth()->id(),
            'delivery_confirmed' => true,
            'delivery_confirmed_at' => now(),
        ]));

        $this->inventoryService->deductStock(
            $split['inventory_item_id'] ?? null,
            $split['qty_from_inventory'] ?? 0,
            $orderId
        );
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
        $qtyToBuy = intval($split['qty_to_buy'] ?? 0);
        $referencePrice = floatval($split['reference_price'] ?? 0);
        $purchaseAmount = floatval($prices[$orderId] ?? 0);

        $amounts = $this->orderService->calculateAmounts($purchaseAmount, $currency, $exchangeRate, $igvEnabled, $igvRate);

        // Actualizar orden original como compra parcial
        $originalMaterials = $originalOrder->materials ? json_decode($originalOrder->materials, true) : [];
        if (!empty($originalMaterials)) {
            foreach ($originalMaterials as &$mat) {
                $mat['qty'] = $qtyToBuy;
                $mat['original_qty'] = $mat['qty'] ?? $qtyToBuy;
            }
            unset($mat);
        }

        DB::table($this->ordersTable)->where('id', $orderId)->update(array_merge($sharedData, [
            'status' => 'to_pay',
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

        $newOrderId = DB::table($this->ordersTable)->insertGetId([
            'project_id' => $originalOrder->project_id,
            'type' => $originalOrder->type,
            'description' => $originalOrder->description . ' [De Inventario]',
            'materials' => json_encode($inventoryMaterials),
            'unit' => $originalOrder->unit ?? null,
            'item_number' => $originalOrder->item_number,
            'source_type' => 'inventory',
            'inventory_item_id' => $split['inventory_item_id'] ?? null,
            'reference_price' => floatval($split['reference_price'] ?? 0),
            'parent_order_id' => $orderId,
            'amount' => 0,
            'amount_pen' => 0,
            'currency' => $currency,
            'exchange_rate' => $exchangeRate,
            'igv_amount' => 0,
            'total_with_igv' => 0,
            'status' => 'approved',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'batch_id' => $batchId,
            'seller_name' => $request->input('seller_name'),
            'seller_document' => $request->input('seller_document'),
            'payment_type' => $request->input('payment_type', 'cash'),
            'issue_date' => $request->input('issue_date'),
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
            $newOrderId
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
            'status' => 'to_pay',
            'source_type' => 'external',
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
            $message = "{$purchaseCount} a Por Pagar, {$inventoryCount} de Inventario (entregadas)";
        } elseif ($inventoryCount > 0) {
            $message = "{$inventoryCount} órdenes cubiertas con inventario";
        } else {
            $message = "{$purchaseCount} órdenes enviadas a Por Pagar";
        }

        return [
            'success' => true,
            'message' => $message,
            'batch_id' => $batchId,
            'inventory_count' => $inventoryCount,
            'purchase_count' => $purchaseCount,
        ];
    }
}
