<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

class CompraController extends Controller
{
    protected $ordersTable = 'purchase_orders';
    protected $projectsTable = 'projects';

    public function index()
    {
        $moduleName = basename(dirname(__DIR__));
        return Inertia::render("{$moduleName}/Index");
    }

    /**
     * Listar todas las órdenes de compra con info del proyecto
     */
    public function list(Request $request)
    {
        $status = $request->input('status'); // pending, approved, rejected, all
        
        $query = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
            ])
            ->orderBy('purchase_orders.item_number', 'asc')
            ->orderBy('purchase_orders.created_at', 'desc');
        
        if ($status && $status !== 'all') {
            $query->where('purchase_orders.status', $status);
        }
        
        $orders = $query->get()->map(function ($order) {
            $order->materials = $order->materials ? json_decode($order->materials, true) : [];
            // Sort materials by item_number ascending
            if (is_array($order->materials)) {
                usort($order->materials, function($a, $b) {
                    return ($a['item_number'] ?? 0) <=> ($b['item_number'] ?? 0);
                });
            }
            return $order;
        });

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'total' => $orders->count()
        ]);
    }

    /**
     * Órdenes pendientes de aprobación
     */
    public function pending()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->leftJoin('users as approver', 'purchase_orders.approved_by', '=', 'approver.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name',
                'approver.name as approved_by_name'
            ])
            ->where('purchase_orders.status', 'pending')
            ->where('purchase_orders.type', 'material')
            ->orderBy('purchase_orders.created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'total' => $orders->count()
        ]);
    }

    /**
     * Órdenes aprobadas internamente para pago (to_pay)
     */
    public function toPayOrders()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->leftJoin('users as approver', 'purchase_orders.approved_by', '=', 'approver.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name',
                'approver.name as approved_by_name'
            ])
            ->where('purchase_orders.status', 'to_pay')
            ->orderBy('purchase_orders.created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'total' => $orders->count()
        ]);
    }

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
                ->update([
                    'status' => 'to_pay',
                    'updated_at' => now()
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Orden enviada a Por Pagar'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Aprobar múltiples órdenes y enviarlas a Por Pagar como una sola lista
     */
    public function markToPayBulk(Request $request)
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
            $orderIds = $request->input('order_ids');
            $prices = $request->input('prices');
            $currency = $request->input('currency');

            // Verify all orders are pending
            $pendingCount = DB::table($this->ordersTable)
                ->whereIn('id', $orderIds)
                ->where('status', 'pending')
                ->count();

            if ($pendingCount !== count($orderIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Algunas órdenes ya fueron procesadas'
                ], 400);
            }

            // Get exchange rate if USD
            $exchangeRate = null;
            if ($currency === 'USD') {
                $exchangeRate = $this->getExchangeRate();
                if (!$exchangeRate) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se pudo obtener el tipo de cambio'
                    ], 400);
                }
            }

            $batchId = 'AP-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));

            $sharedData = [
                'status' => 'to_pay',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
                'batch_id' => $batchId,
                'currency' => $currency,
                'exchange_rate' => $exchangeRate,
                'seller_name' => $request->input('seller_name'),
                'seller_document' => $request->input('seller_document'),
                'payment_type' => $request->input('payment_type', 'cash'),
                'issue_date' => $request->input('issue_date'),
                'due_date' => $request->input('due_date'),
                'updated_at' => now()
            ];

            foreach ($orderIds as $orderId) {
                $amount = floatval($prices[$orderId] ?? 0);
                if ($amount <= 0) continue;

                $amountPen = $currency === 'USD' ? $amount * $exchangeRate : $amount;

                DB::table($this->ordersTable)
                    ->where('id', $orderId)
                    ->update(array_merge($sharedData, [
                        'amount' => $amount,
                        'amount_pen' => $amountPen,
                        'total_with_igv' => $amountPen
                    ]));
            }

            return response()->json([
                'success' => true,
                'message' => count($orderIds) . ' órdenes enviadas a Por Pagar',
                'batch_id' => $batchId
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get unique sellers from approved orders for autocomplete
     */
    public function getSellers()
    {
        $sellers = DB::table($this->ordersTable)
            ->whereNotNull('seller_name')
            ->where('seller_name', '!=', '')
            ->where('status', 'approved')
            ->select('seller_name', 'seller_document')
            ->distinct()
            ->orderBy('seller_name')
            ->get();

        return response()->json([
            'success' => true,
            'sellers' => $sellers
        ]);
    }

    /**
     * Detalle de una orden
     */
    public function show($id)
    {
        $order = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name',
                'projects.available_amount as project_available'
            ])
            ->where('purchase_orders.id', $id)
            ->first();

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        $order->materials = $order->materials ? json_decode($order->materials, true) : [];

        return response()->json([
            'success' => true,
            'order' => $order
        ]);
    }

    /**
     * Aprobar orden de compra y asignar precio
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
            'currency' => 'required|in:PEN,USD'
        ]);

        try {
            $amount = floatval($request->amount);
            $currency = $request->currency;
            $exchangeRate = null;
            $amountPen = $amount;

            // Si es USD, obtener tipo de cambio y convertir
            if ($currency === 'USD') {
                $exchangeRate = $this->getExchangeRate();
                if ($exchangeRate) {
                    $amountPen = $amount * $exchangeRate;
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se pudo obtener el tipo de cambio'
                    ], 400);
                }
            }

            // IGV calculation
            $igvEnabled = $request->boolean('igv_enabled', false);
            $igvRate = floatval($request->input('igv_rate', 18.00));
            $igvAmount = 0;
            $totalWithIgv = $amountPen;
            
            if ($igvEnabled) {
                $igvAmount = $amountPen * ($igvRate / 100);
                $totalWithIgv = $amountPen + $igvAmount;
            }

            DB::table($this->ordersTable)
                ->where('id', $id)
                ->update([
                    'amount' => $amount,
                    'currency' => $currency,
                    'exchange_rate' => $exchangeRate,
                    'amount_pen' => $amountPen,
                    'igv_enabled' => $igvEnabled,
                    'igv_rate' => $igvRate,
                    'igv_amount' => $igvAmount,
                    'total_with_igv' => $totalWithIgv,
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
                    'updated_at' => now()
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Orden aprobada exitosamente',
                'exchange_rate' => $exchangeRate,
                'amount_pen' => $amountPen
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Aprobar múltiples órdenes de compra en lote
     * Comparten: proveedor, factura, fechas, IGV
     * Cada orden tiene su precio individual
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
            $orderIds = $request->input('order_ids');
            $prices = $request->input('prices'); // { order_id: amount }
            $currency = $request->input('currency');
            $igvEnabled = $request->boolean('igv_enabled', false);
            $igvRate = floatval($request->input('igv_rate', 18.00));

            // Verify all orders are pending
            $pendingCount = DB::table($this->ordersTable)
                ->whereIn('id', $orderIds)
                ->where('status', 'pending')
                ->count();

            if ($pendingCount !== count($orderIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Algunas órdenes ya fueron procesadas'
                ], 400);
            }

            // Get exchange rate if USD
            $exchangeRate = null;
            if ($currency === 'USD') {
                $exchangeRate = $this->getExchangeRate();
                if (!$exchangeRate) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se pudo obtener el tipo de cambio'
                    ], 400);
                }
            }

            // Generate batch ID
            $batchId = 'BATCH-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));

            // Shared data
            $sharedData = [
                'status' => 'approved',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
                'batch_id' => $batchId,
                'currency' => $currency,
                'exchange_rate' => $exchangeRate,
                'igv_enabled' => $igvEnabled,
                'igv_rate' => $igvRate,
                'seller_name' => $request->input('seller_name'),
                'seller_document' => $request->input('seller_document'),
                'issue_date' => $request->input('issue_date'),
                'payment_type' => $request->input('payment_type'),
                'payment_date' => $request->input('payment_type') === 'cash' ? $request->input('payment_date') : null,
                'due_date' => $request->input('payment_type') === 'loan' ? $request->input('due_date') : null,
                'notes' => $request->input('notes'),
                'updated_at' => now()
            ];

            // Update each order with its individual price
            foreach ($orderIds as $orderId) {
                $amount = floatval($prices[$orderId] ?? 0);
                if ($amount <= 0) continue;

                $amountPen = $currency === 'USD' ? $amount * $exchangeRate : $amount;
                $igvAmount = $igvEnabled ? $amountPen * ($igvRate / 100) : 0;
                $totalWithIgv = $amountPen + $igvAmount;

                DB::table($this->ordersTable)
                    ->where('id', $orderId)
                    ->update(array_merge($sharedData, [
                        'amount' => $amount,
                        'amount_pen' => $amountPen,
                        'igv_amount' => $igvAmount,
                        'total_with_igv' => $totalWithIgv
                    ]));
            }

            return response()->json([
                'success' => true,
                'message' => count($orderIds) . ' órdenes aprobadas exitosamente',
                'batch_id' => $batchId
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Pagar múltiples órdenes (Por Pagar)
     * Aplica precios y marca como pagadas
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
            $orderIds = $request->input('order_ids');
            $prices = $request->input('prices');
            $currency = $request->input('currency');
            $igvEnabled = $request->boolean('igv_enabled', false);
            $igvRate = floatval($request->input('igv_rate', 18.00));

            // Verify all orders are to_pay
            $toPayCount = DB::table($this->ordersTable)
                ->whereIn('id', $orderIds)
                ->where('status', 'to_pay')
                ->count();

            if ($toPayCount !== count($orderIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Algunas órdenes no están disponibles para pago'
                ], 400);
            }

            // Get exchange rate if USD
            $exchangeRate = null;
            if ($currency === 'USD') {
                $exchangeRate = $this->getExchangeRate();
                if (!$exchangeRate) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se pudo obtener el tipo de cambio'
                    ], 400);
                }
            }

            // Generate batch ID
            $batchId = 'PAY-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));

            $sharedData = [
                'status' => 'approved',
                'approved_by' => auth()->id(),
                'approved_at' => now(),
                'batch_id' => $batchId,
                'currency' => $currency,
                'exchange_rate' => $exchangeRate,
                'igv_enabled' => $igvEnabled,
                'igv_rate' => $igvRate,
                'seller_name' => $request->input('seller_name'),
                'seller_document' => $request->input('seller_document'),
                'issue_date' => $request->input('issue_date'),
                'payment_type' => $request->input('payment_type'),
                'payment_date' => $request->input('payment_type') === 'cash' ? $request->input('payment_date') : null,
                'due_date' => $request->input('payment_type') === 'loan' ? $request->input('due_date') : null,
                'notes' => $request->input('notes'),
                'payment_confirmed' => true,
                'payment_confirmed_at' => now(),
                'payment_confirmed_by' => auth()->id(),
                'updated_at' => now()
            ];

            foreach ($orderIds as $orderId) {
                $amount = floatval($prices[$orderId] ?? 0);
                if ($amount <= 0) continue;

                $amountPen = $currency === 'USD' ? $amount * $exchangeRate : $amount;
                $igvAmount = $igvEnabled ? $amountPen * ($igvRate / 100) : 0;
                $totalWithIgv = $amountPen + $igvAmount;

                DB::table($this->ordersTable)
                    ->where('id', $orderId)
                    ->update(array_merge($sharedData, [
                        'amount' => $amount,
                        'amount_pen' => $amountPen,
                        'igv_amount' => $igvAmount,
                        'total_with_igv' => $totalWithIgv
                    ]));
            }

            return response()->json([
                'success' => true,
                'message' => count($orderIds) . ' órdenes pagadas exitosamente',
                'batch_id' => $batchId
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Pagar un lote aprobado en Por Pagar (batch_id)
     */
    public function payBatch(Request $request)
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
            $proofPath = null;
            $proofLink = $request->input('payment_proof_link');

            if ($request->hasFile('payment_proof')) {
                $file = $request->file('payment_proof');
                $filename = 'proof_' . $batchId . '_' . time() . '.' . $file->getClientOriginalExtension();
                $proofPath = $file->storeAs('payment_proofs', $filename, 'public');
            }

            if (!$proofPath && !$proofLink) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe subir un archivo o ingresar un link de la factura'
                ], 400);
            }

            $updated = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('status', 'to_pay')
                ->update([
                    'status' => 'approved',
                    'payment_confirmed' => true,
                    'payment_confirmed_at' => now(),
                    'payment_confirmed_by' => auth()->id(),
                    'cdp_type' => $request->input('cdp_type'),
                    'cdp_serie' => $request->input('cdp_serie'),
                    'cdp_number' => $request->input('cdp_number'),
                    'payment_proof' => $proofPath,
                    'payment_proof_link' => $proofLink,
                    'updated_at' => now()
                ]);

            if ($updated === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron órdenes para pagar'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Pago confirmado'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener tipo de cambio USD -> PEN desde SUNAT (API decolecta)
     */
    protected function getExchangeRate($date = null)
    {
        try {
            $apiKey = 'sk_12725.xbGMYdLZTrQvrowVM3LNDAUeNadco86A';
            $url = 'https://api.decolecta.com/v1/tipo-cambio/sunat';
            
            if ($date) {
                $url .= '?date=' . $date;
            }

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && $response) {
                $data = json_decode($response, true);
                // Usar precio de venta (sell_price) para conversión
                return floatval($data['sell_price'] ?? 0);
            }

            return null;
        } catch (\Exception $e) {
            \Log::error('Error getting exchange rate: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * API endpoint para obtener tipo de cambio actual
     */
    public function exchangeRate()
    {
        $rate = $this->getExchangeRate();
        
        if ($rate) {
            return response()->json([
                'success' => true,
                'rate' => $rate,
                'date' => now()->format('Y-m-d')
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'No se pudo obtener el tipo de cambio'
        ], 500);
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
            DB::table($this->ordersTable)
                ->where('id', $id)
                ->update([
                    'status' => 'rejected',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                    'notes' => $request->input('notes', 'Rechazado'),
                    'updated_at' => now()
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Orden rechazada'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get approved but unpaid orders
     */
    public function approvedUnpaid()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
            ])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', false)
            ->orderBy('purchase_orders.approved_at', 'desc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'total' => $orders->count()
        ]);
    }

    /**
     * Get paid orders (payment_confirmed = true)
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
                'approver.name as approved_by_name'
            ])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', true)
            ->orderBy('purchase_orders.payment_confirmed_at', 'desc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'total' => $orders->count()
        ]);
    }

    /**
     * Get delivered orders (delivery_confirmed = true)
     */
    public function deliveredOrders()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
            ])
            ->where('purchase_orders.delivery_confirmed', true)
            ->orderBy('purchase_orders.delivery_confirmed_at', 'desc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json([
            'success' => true,
            'orders' => $orders,
            'total' => $orders->count()
        ]);
    }

    /**
     * Confirm payment for an approved order
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
            $proofPath = null;
            $proofLink = $request->input('payment_proof_link');
            
            // Handle file upload
            if ($request->hasFile('payment_proof')) {
                $file = $request->file('payment_proof');
                $filename = 'proof_' . $id . '_' . time() . '.' . $file->getClientOriginalExtension();
                $proofPath = $file->storeAs('payment_proofs', $filename, 'public');
            }

            if (!$proofPath && !$proofLink) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe subir un archivo o ingresar un link de la factura'
                ], 400);
            }

            DB::table($this->ordersTable)
                ->where('id', $id)
                ->update([
                    'payment_confirmed' => true,
                    'payment_confirmed_at' => now(),
                    'payment_confirmed_by' => auth()->id(),
                    'cdp_type' => $request->input('cdp_type'),
                    'cdp_serie' => $request->input('cdp_serie'),
                    'cdp_number' => $request->input('cdp_number'),
                    'payment_proof' => $proofPath,
                    'payment_proof_link' => $proofLink,
                    'updated_at' => now()
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Pago confirmado exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Estadísticas de compras
     */
    public function stats()
    {
        $pending = DB::table($this->ordersTable)->where('status', 'pending')->count();
        $approved = DB::table($this->ordersTable)->where('status', 'approved')->count();
        $rejected = DB::table($this->ordersTable)->where('status', 'rejected')->count();
        $totalApproved = DB::table($this->ordersTable)->where('status', 'approved')->sum('amount');

        return response()->json([
            'success' => true,
            'stats' => [
                'pending' => $pending,
                'approved' => $approved,
                'rejected' => $rejected,
                'total_approved_amount' => $totalApproved
            ]
        ]);
    }
    /**
     * Listar proyectos para selector
     */
    public function projects()
    {
        $projects = DB::table($this->projectsTable)
            ->select(['id', 'name', 'available_amount', 'status'])
            ->where('status', 'active')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'projects' => $projects
        ]);
    }

    /**
     * Exportar órdenes aprobadas a CSV (Excel compatible)
     */
    public function exportExcel(Request $request)
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.id',
                'purchase_orders.created_at as fecha_emision',
                'projects.name as proyecto',
                'purchase_orders.description',
                'purchase_orders.type',
                'purchase_orders.amount',
                'purchase_orders.currency',
                'purchase_orders.exchange_rate',
                'purchase_orders.amount_pen'
            ])
            ->where('purchase_orders.status', 'approved')
            ->orderBy('purchase_orders.created_at', 'desc')
            ->get();

        // Headers CSV
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="compras_' . date('Y-m-d') . '.csv"',
        ];

        $callback = function() use ($orders) {
            $file = fopen('php://output', 'w');
            
            // BOM for UTF-8 Excel compatibility
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            
            // Header row
            fputcsv($file, [
                'ID',
                'Fecha de Emisión',
                'Proyecto',
                'Descripción',
                'Tipo',
                'Monto Original',
                'Moneda',
                'Tipo de Cambio',
                'Monto en Soles'
            ], ';');
            
            // Data rows
            foreach ($orders as $order) {
                fputcsv($file, [
                    $order->id,
                    date('d/m/Y', strtotime($order->fecha_emision)),
                    $order->proyecto,
                    $order->description,
                    $order->type === 'service' ? 'Servicio' : 'Materiales',
                    number_format($order->amount, 2, '.', ''),
                    $order->currency,
                    $order->currency === 'USD' ? number_format($order->exchange_rate, 4, '.', '') : '',
                    number_format($order->amount_pen, 2, '.', '')
                ], ';');
            }
            
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Exportar órdenes pagadas a Excel (formato XLSX)
     * Formato compatible con registros de compras SUNAT
     */
    public function exportPaidExcel(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');
        
        $query = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
            ])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', true);
        
        // Filter by date range if provided
        if ($startDate) {
            $query->whereDate('purchase_orders.payment_confirmed_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('purchase_orders.payment_confirmed_at', '<=', $endDate);
        }
        
        $orders = $query->orderBy('purchase_orders.issue_date', 'asc')
            ->orderBy('purchase_orders.payment_confirmed_at', 'asc')
            ->get();

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Registro de Compras');

        // Headers
        $headers = [
            'FECHA DE EMISIÓN',
            'FECHA VCTO/PAGO',
            'TIPO CP/DOC',
            'SERIE DEL CDP',
            'NRO CP O DOC',
            'TIPO DOC IDENTIDAD',
            'NRO DOC IDENTIDAD',
            'APELLIDOS NOMBRES/ RAZÓN SOCIAL',
            'BI GRAVADO DG',
            'IGV / IPM DG',
            'VALOR ADQ. NO. GRA',
            'IGV',
            'TOTAL CP',
            'MONEDA',
            'TIPO CAMBIO',
            'FECHA EMISIÓN DOC MOD',
            'TIPO CP MOD',
            'NRO CP MOD',
            'COD. DAM O DSI',
            'NRO. DAM O DSI'
        ];

        // Set headers in row 1
        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . '1', $header);
            $col++;
        }

        // Style for header row
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 10
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '10B981']
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => '000000']
                ]
            ]
        ];
        $sheet->getStyle('A1:T1')->applyFromArray($headerStyle);
        $sheet->getRowDimension(1)->setRowHeight(30);

        // Column widths
        $widths = ['A' => 15, 'B' => 15, 'C' => 12, 'D' => 12, 'E' => 15, 'F' => 10, 'G' => 15, 'H' => 35, 'I' => 14, 'J' => 12, 'K' => 14, 'L' => 12, 'M' => 14, 'N' => 10, 'O' => 12, 'P' => 15, 'Q' => 12, 'R' => 15, 'S' => 12, 'T' => 12];
        foreach ($widths as $c => $w) {
            $sheet->getColumnDimension($c)->setWidth($w);
        }

        // Data rows
        $row = 2;
        foreach ($orders as $order) {
            // Determine document type based on seller_document length
            $docType = '';
            $sellerDoc = $order->seller_document ?? '';
            if (strlen($sellerDoc) === 11) {
                $docType = '6'; // RUC
            } elseif (strlen($sellerDoc) === 8) {
                $docType = '1'; // DNI
            }

            // Format dates
            $issueDate = $order->issue_date ? date('d/m/Y', strtotime($order->issue_date)) : '';
            $dueDate = $order->due_date ?? $order->payment_date ?? '';
            if ($dueDate) {
                $dueDate = date('d/m/Y', strtotime($dueDate));
            }

            // Calculate amounts
            $baseAmount = floatval($order->amount_pen ?? $order->amount ?? 0);
            $igvAmount = floatval($order->igv_amount ?? 0);
            $totalAmount = floatval($order->total_with_igv ?? $baseAmount);

            // If IGV is enabled but igv_amount is 0, recalculate
            if ($order->igv_enabled && $igvAmount == 0 && $baseAmount > 0) {
                $igvRate = floatval($order->igv_rate ?? 18);
                $igvAmount = $baseAmount * ($igvRate / 100);
                $totalAmount = $baseAmount + $igvAmount;
            }

            // Exchange rate
            $exchangeRate = ($order->currency === 'USD' && $order->exchange_rate) 
                ? floatval($order->exchange_rate) 
                : '';

            $sheet->setCellValue('A' . $row, $issueDate);
            $sheet->setCellValue('B' . $row, $dueDate);
            $sheet->setCellValue('C' . $row, $order->cdp_type ?? '');
            $sheet->setCellValue('D' . $row, $order->cdp_serie ?? '');
            $sheet->setCellValue('E' . $row, $order->cdp_number ?? '');
            $sheet->setCellValue('F' . $row, $docType);
            $sheet->setCellValue('G' . $row, $sellerDoc);
            $sheet->setCellValue('H' . $row, $order->seller_name ?? '');
            $sheet->setCellValue('I' . $row, $baseAmount);
            $sheet->setCellValue('J' . $row, $igvAmount);
            $sheet->setCellValue('K' . $row, '');
            $sheet->setCellValue('L' . $row, $igvAmount);
            $sheet->setCellValue('M' . $row, $totalAmount);
            $sheet->setCellValue('N' . $row, $order->currency ?? 'PEN');
            $sheet->setCellValue('O' . $row, $exchangeRate);
            $sheet->setCellValue('P' . $row, '');
            $sheet->setCellValue('Q' . $row, '');
            $sheet->setCellValue('R' . $row, '');
            $sheet->setCellValue('S' . $row, '');
            $sheet->setCellValue('T' . $row, '');

            $row++;
        }

        // Format number columns
        $lastRow = $row - 1;
        if ($lastRow >= 2) {
            $sheet->getStyle('I2:M' . $lastRow)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('O2:O' . $lastRow)->getNumberFormat()->setFormatCode('#,##0.000');
            
            // Borders for data
            $sheet->getStyle('A2:T' . $lastRow)->applyFromArray([
                'borders' => [
                    'allBorders' => [
                        'borderStyle' => Border::BORDER_THIN,
                        'color' => ['rgb' => 'CCCCCC']
                    ]
                ]
            ]);
        }

        // Generate file
        $filename = 'registro_compras_' . date('Y-m-d') . '.xlsx';
        $tempFile = tempnam(sys_get_temp_dir(), 'excel_');
        
        $writer = new Xlsx($spreadsheet);
        $writer->save($tempFile);

        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }
}
