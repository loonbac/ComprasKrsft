<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

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
            ->orderBy('purchase_orders.created_at', 'desc');
        
        if ($status && $status !== 'all') {
            $query->where('purchase_orders.status', $status);
        }
        
        $orders = $query->get()->map(function ($order) {
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
     * Órdenes pendientes de aprobación
     */
    public function pending()
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
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
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
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
        ]);

        try {
            $proofPath = null;
            
            // Handle file upload
            if ($request->hasFile('payment_proof')) {
                $file = $request->file('payment_proof');
                $filename = 'proof_' . $id . '_' . time() . '.' . $file->getClientOriginalExtension();
                $proofPath = $file->storeAs('payment_proofs', $filename, 'public');
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
     * Exportar órdenes pagadas a Excel (formato CSV compatible)
     * Formato compatible con registros de compras SUNAT
     */
    public function exportPaidExcel(Request $request)
    {
        $orders = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name'
            ])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', true)
            ->orderBy('purchase_orders.issue_date', 'asc')
            ->orderBy('purchase_orders.payment_confirmed_at', 'asc')
            ->get();

        $filename = 'registro_compras_' . date('Y-m-d') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'max-age=0',
        ];

        $callback = function() use ($orders) {
            $file = fopen('php://output', 'w');
            
            // BOM for UTF-8 Excel compatibility
            fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));
            
            // Header row
            fputcsv($file, [
                'FECHA DE EMISIÓN',
                'FECHA VCTO/PAGO',
                'TIPO CP/DOC',
                'SERIE DEL CDP',
                'NRO CP O DOC. NRO INICIAL RANGO',
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
                'FECHA EMISIÓN DOC MODIFICADO',
                'TIPO CP MODIFICADO',
                'NRO CP MODIFICADO',
                'COD. DAM O DSI',
                'NRO. DAM O DSI'
            ], ';');
            
            // Data rows
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
                    ? number_format($order->exchange_rate, 3, '.', '') 
                    : '';

                fputcsv($file, [
                    $issueDate,                                          // FECHA DE EMISIÓN
                    $dueDate,                                            // FECHA VCTO/PAGO
                    $order->cdp_type ?? '',                              // TIPO CP/DOC
                    $order->cdp_serie ?? '',                             // SERIE DEL CDP
                    $order->cdp_number ?? '',                            // NRO CP O DOC
                    $docType,                                            // TIPO DOC IDENTIDAD
                    $sellerDoc,                                          // NRO DOC IDENTIDAD
                    $order->seller_name ?? '',                           // RAZÓN SOCIAL
                    number_format($baseAmount, 2, '.', ''),              // BI GRAVADO DG
                    number_format($igvAmount, 2, '.', ''),               // IGV / IPM DG
                    '',                                                  // VALOR ADQ. NO GRAVADO
                    number_format($igvAmount, 2, '.', ''),               // IGV
                    number_format($totalAmount, 2, '.', ''),             // TOTAL CP
                    $order->currency ?? 'PEN',                           // MONEDA
                    $exchangeRate,                                       // TIPO CAMBIO
                    '',                                                  // FECHA EMISIÓN DOC MODIFICADO
                    '',                                                  // TIPO CP MODIFICADO
                    '',                                                  // NRO CP MODIFICADO
                    '',                                                  // COD. DAM O DSI
                    ''                                                   // NRO. DAM O DSI
                ], ';');
            }
            
            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
