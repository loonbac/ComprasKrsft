<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modulos_ERP\ComprasKrsft\Services\ExchangeRateService;
use Modulos_ERP\ComprasKrsft\Services\InventoryService;
use Modulos_ERP\ComprasKrsft\Services\OrderService;

class PaymentController extends Controller
{
    protected string $ordersTable = 'purchase_orders';
    protected string $projectsTable = 'projects';

    public function __construct(
        protected ExchangeRateService $exchangeRateService,
        protected InventoryService $inventoryService,
        protected OrderService $orderService
    ) {}

    /**
     * Pagar múltiples órdenes (Por Pagar) - aplica precios y marca como pagadas
     */
    public function payBulk(Request $request)
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

                if (!$this->orderService->verifyOrdersStatus($orderIds, 'to_pay')) {
                    return response()->json(['success' => false, 'message' => 'Algunas órdenes no están disponibles para pago'], 400);
                }

                $exchangeRate = null;
                if ($currency === 'USD') {
                    $exchangeRate = $this->exchangeRateService->getRate();
                    if (!$exchangeRate) {
                        return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 400);
                    }
                }

                $batchId = $this->orderService->generateBatchId('PAY');
                $sharedData = $this->orderService->buildSharedData($request, $exchangeRate, $batchId, [
                    'status' => 'approved',
                    'payment_confirmed' => true,
                    'payment_confirmed_at' => now(),
                    'payment_confirmed_by' => auth()->id(),
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

                return [
                    'success' => true,
                    'message' => count($orderIds) . ' órdenes pagadas exitosamente',
                    'batch_id' => $batchId,
                ];
            });

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en payBulk', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al procesar el pago'], 500);
        }
    }

    /**
     * Pagar un lote aprobado en Por Pagar (por batch_id)
     */
    public function payBatch(Request $request)
    {
        $request->validate([
            'batch_id' => 'required|string',
            'cdp_type' => 'nullable|string|max:10',
            'cdp_serie' => 'nullable|string|max:20',
            'cdp_number' => 'nullable|string|max:20',
            'payment_proof_link' => 'nullable|string|max:2048',
        ]);

        try {
            $batchId = $request->input('batch_id');
            $proofPath = $this->orderService->handlePaymentProof($request, $batchId);
            $proofLink = $request->input('payment_proof_link');

            $updated = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('status', 'to_pay')
                ->update([
                    'status' => 'approved',
                    'payment_confirmed' => true,
                    'payment_confirmed_at' => now(),
                    'payment_confirmed_by' => auth()->id(),
                    'cdp_type' => $request->input('cdp_type') ?: null,
                    'cdp_serie' => $request->input('cdp_serie') ?: null,
                    'cdp_number' => $request->input('cdp_number') ?: null,
                    'payment_proof' => $proofPath,
                    'payment_proof_link' => $proofLink,
                    'updated_at' => now(),
                ]);

            if ($updated === 0) {
                return response()->json(['success' => false, 'message' => 'No se encontraron órdenes para pagar'], 404);
            }

            // Enviar al inventario
            $paidOrders = DB::table($this->ordersTable)
                ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
                ->select('purchase_orders.*', 'projects.name as project_name')
                ->where('purchase_orders.batch_id', $batchId)
                ->get();

            foreach ($paidOrders as $order) {
                if ($order->type !== 'material') continue;
                $this->inventoryService->sendOrderItems(
                    $order,
                    floatval($order->amount ?? 0),
                    $order->currency ?? 'PEN',
                    floatval($order->amount_pen ?? 0),
                    $batchId
                );
            }

            return response()->json(['success' => true, 'message' => 'Pago confirmado']);
        } catch (\Exception $e) {
            Log::error('Error en payBatch', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al confirmar el pago'], 500);
        }
    }

    /**
     * Actualizar comprobante de pago de un lote
     */
    public function updateComprobante(Request $request)
    {
        $request->validate([
            'batch_id' => 'required|string',
            'cdp_type' => 'required|string|max:10',
            'cdp_serie' => 'required|string|max:20',
            'cdp_number' => 'required|string|max:20',
            'payment_proof_link' => 'nullable|string|max:2048',
        ]);

        try {
            $batchId = $request->input('batch_id');
            $proofPath = $this->orderService->handlePaymentProof($request, $batchId);
            $proofLink = $request->input('payment_proof_link');

            $updateData = [
                'cdp_type' => $request->input('cdp_type'),
                'cdp_serie' => $request->input('cdp_serie'),
                'cdp_number' => $request->input('cdp_number'),
                'updated_at' => now(),
            ];

            if ($proofPath) {
                $updateData['payment_proof'] = $proofPath;
            }
            if ($proofLink) {
                $updateData['payment_proof_link'] = $proofLink;
            }

            $updated = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('payment_confirmed', true)
                ->update($updateData);

            if ($updated === 0) {
                return response()->json(['success' => false, 'message' => 'No se encontraron órdenes para actualizar'], 404);
            }

            return response()->json(['success' => true, 'message' => 'Comprobante actualizado correctamente']);
        } catch (\Exception $e) {
            Log::error('Error en updateComprobante', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al actualizar comprobante'], 500);
        }
    }

    /**
     * Quick Pay - Crear órdenes y marcar como pagadas en un solo flujo
     */
    public function quickPay(Request $request)
    {
        try {
            return DB::transaction(function () use ($request) {
                $projectId = $request->input('project_id');
                $sellerName = $request->input('seller_name');
                $sellerDocument = $request->input('seller_document');
                $paymentType = $request->input('payment_type');
                $currency = $request->input('currency');
                $issueDate = $request->input('issue_date');
                $dueDate = $request->input('due_date');
                $items = json_decode($request->input('items'), true);

                if (!$projectId || !$sellerName || !$sellerDocument || !$items || count($items) === 0) {
                    return response()->json(['success' => false, 'message' => 'Datos incompletos'], 400);
                }

                $project = DB::table($this->projectsTable)
                    ->where('id', $projectId)
                    ->select('id', 'name')
                    ->first();

                $projectName = $project ? $project->name : 'Proyecto #' . $projectId;
                $batchId = 'QP-' . date('YmdHis') . '-' . substr(md5(microtime()), 0, 8);

                $proofPath = $this->orderService->handlePaymentProof($request, $batchId);
                $proofLink = $request->input('payment_proof_link');

                if (!$proofPath && !$proofLink) {
                    return response()->json(['success' => false, 'message' => 'Suba comprobante'], 400);
                }

                $maxItemNumber = DB::table('purchase_orders')
                    ->where('project_id', $projectId)
                    ->max('item_number');
                $nextItemNumber = ($maxItemNumber ?? 0) + 1;

                foreach ($items as $index => $item) {
                    $subtotal = $item['subtotal'] ?? 0;

                    DB::table($this->ordersTable)->insert([
                        'project_id' => $projectId,
                        'batch_id' => $batchId,
                        'item_number' => $nextItemNumber + $index,
                        'seller_name' => $sellerName,
                        'seller_document' => $sellerDocument,
                        'type' => 'material',
                        'description' => $item['description'] ?? '',
                        'materials' => json_encode([['name' => $item['description'] ?? '', 'qty' => $item['qty'] ?? 1]]),
                        'unit' => $item['unit'] ?? 'UND',
                        'diameter' => $item['diameter'] ?? null,
                        'series' => $item['series'] ?? null,
                        'material_type' => $item['material_type'] ?? null,
                        'amount' => $subtotal,
                        'amount_pen' => $subtotal,
                        'currency' => $currency,
                        'exchange_rate' => 1.0,
                        'total_with_igv' => $subtotal,
                        'status' => 'approved',
                        'payment_type' => $paymentType,
                        'issue_date' => $issueDate,
                        'due_date' => $dueDate,
                        'payment_confirmed' => true,
                        'payment_confirmed_at' => now(),
                        'payment_confirmed_by' => auth()->id(),
                        'cdp_type' => $request->input('cdp_type'),
                        'cdp_serie' => $request->input('cdp_serie'),
                        'cdp_number' => $request->input('cdp_number'),
                        'payment_proof' => $proofPath,
                        'payment_proof_link' => $proofLink,
                        'supervisor_approved' => true,
                        'supervisor_approved_by' => auth()->id(),
                        'supervisor_approved_at' => now(),
                        'manager_approved' => true,
                        'manager_approved_by' => auth()->id(),
                        'manager_approved_at' => now(),
                        'created_by' => auth()->id(),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                // Enviar items al inventario como apartados
                $this->inventoryService->sendItems($projectId, $items, $batchId, $projectName);

                return response()->json(['success' => true, 'message' => 'Pago rápido completado']);
            });
        } catch (\Exception $e) {
            Log::error('Error en quickPay', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al procesar pago rápido'], 500);
        }
    }

    /**
     * Confirmar pago para una orden aprobada
     */
    public function confirmPayment(Request $request, $id)
    {
        $order = DB::table($this->ordersTable)->find($id);

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        if ($order->status !== 'approved') {
            return response()->json(['success' => false, 'message' => 'La orden debe estar aprobada'], 400);
        }

        $request->validate([
            'cdp_type' => 'required|string|max:10',
            'cdp_serie' => 'required|string|max:20',
            'cdp_number' => 'required|string|max:20',
            'payment_proof_link' => 'nullable|string|max:2048',
        ]);

        try {
            $proofPath = $this->orderService->handlePaymentProof($request, (string) $id);
            $proofLink = $request->input('payment_proof_link');

            if (!$proofPath && !$proofLink) {
                return response()->json(['success' => false, 'message' => 'Debe subir un archivo o ingresar un link de la factura'], 400);
            }

            DB::table($this->ordersTable)->where('id', $id)->update([
                'payment_confirmed' => true,
                'payment_confirmed_at' => now(),
                'payment_confirmed_by' => auth()->id(),
                'cdp_type' => $request->input('cdp_type'),
                'cdp_serie' => $request->input('cdp_serie'),
                'cdp_number' => $request->input('cdp_number'),
                'payment_proof' => $proofPath,
                'payment_proof_link' => $proofLink,
                'updated_at' => now(),
            ]);

            $paidOrder = $this->orderService->getOrderWithProject($id);

            if ($paidOrder && $paidOrder->type === 'material') {
                $this->inventoryService->sendOrderItems(
                    $paidOrder,
                    floatval($paidOrder->amount ?? 0),
                    $paidOrder->currency ?? 'PEN',
                    floatval($paidOrder->amount_pen ?? 0),
                    $paidOrder->batch_id ?: 'PAY-' . date('Ymd') . '-' . $id
                );
            }

            return response()->json(['success' => true, 'message' => 'Pago confirmado exitosamente']);
        } catch (\Exception $e) {
            Log::error('Error en confirmPayment', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return response()->json(['success' => false, 'message' => 'Error interno al confirmar el pago'], 500);
        }
    }

    /**
     * Órdenes aprobadas pero sin pagar
     */
    public function approvedUnpaid()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select(['purchase_orders.*', 'projects.name as project_name'])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', false)
            ->orderBy('purchase_orders.approved_at', 'desc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json(['success' => true, 'orders' => $orders, 'total' => $orders->count()]);
    }

    /**
     * Órdenes pagadas (payment_confirmed = true)
     */
    public function paidOrders()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->leftJoin('users as payer', 'purchase_orders.payment_confirmed_by', '=', 'payer.id')
            ->leftJoin('users as approver', 'purchase_orders.approved_by', '=', 'approver.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name',
                'payer.name as payment_confirmed_by_name',
                'approver.name as approved_by_name',
            ])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', true)
            ->orderBy('purchase_orders.payment_confirmed_at', 'desc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json(['success' => true, 'orders' => $orders, 'total' => $orders->count()]);
    }

    /**
     * Órdenes entregadas (delivery_confirmed = true)
     */
    public function deliveredOrders()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select(['purchase_orders.*', 'projects.name as project_name'])
            ->where('purchase_orders.delivery_confirmed', true)
            ->orderBy('purchase_orders.delivery_confirmed_at', 'desc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json(['success' => true, 'orders' => $orders, 'total' => $orders->count()]);
    }
}
