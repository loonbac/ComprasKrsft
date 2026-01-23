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
     * Exportar órdenes pagadas a Excel (formato contable)
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

        // Generate XML Spreadsheet (Excel compatible)
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?mso-application progid="Excel.Sheet"?>' . "\n";
        $xml .= '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Size="9"/>
   <Interior ss:Color="#10b981" ss:Pattern="Solid"/>
   <Font ss:Color="#FFFFFF"/>
   <Alignment ss:Horizontal="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="Date">
   <NumberFormat ss:Format="dd/mm/yyyy"/>
  </Style>
  <Style ss:ID="Number">
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
  <Style ss:ID="Rate">
   <NumberFormat ss:Format="#,##0.000"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Registro de Compras">
  <Table>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="60"/>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
   <Column ss:Width="50"/>
   <Column ss:Width="90"/>
   <Column ss:Width="200"/>
   <Column ss:Width="80"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Column ss:Width="80"/>
   <Column ss:Width="50"/>
   <Column ss:Width="60"/>
   <Column ss:Width="80"/>
   <Column ss:Width="60"/>
   <Column ss:Width="80"/>
   <Column ss:Width="70"/>
   <Column ss:Width="70"/>
   <Row>
    <Cell ss:StyleID="Header"><Data ss:Type="String">FECHA DE EMISIÓN</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">FECHA VCTO/PAGO</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">TIPO CP/DOC</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">SERIE DEL CDP</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">NRO CP O DOC</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">TIPO DOC</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">NRO DOCUMENTO</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">RAZÓN SOCIAL / NOMBRE</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">BI GRAVADO</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">IGV/IPM</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">NO GRAVADO</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">IGV</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">TOTAL CP</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">MONEDA</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">T. CAMBIO</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">F. EMISIÓN MOD</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">TIPO CP MOD</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">NRO CP MOD</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">COD DAM/DSI</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">NRO DAM/DSI</Data></Cell>
   </Row>';

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
            $issueDate = $order->issue_date ? date('Y-m-d', strtotime($order->issue_date)) : '';
            $dueDate = $order->due_date ?? $order->payment_date ?? '';
            if ($dueDate) {
                $dueDate = date('Y-m-d', strtotime($dueDate));
            }

            // Calculate base amount (without IGV)
            $baseAmount = floatval($order->amount_pen ?? $order->amount ?? 0);
            $igvAmount = floatval($order->igv_amount ?? 0);
            $totalAmount = floatval($order->total_with_igv ?? $baseAmount);

            // If IGV is enabled but igv_amount is 0, recalculate
            if ($order->igv_enabled && $igvAmount == 0 && $baseAmount > 0) {
                $igvRate = floatval($order->igv_rate ?? 18);
                $igvAmount = $baseAmount * ($igvRate / 100);
                $totalAmount = $baseAmount + $igvAmount;
            }

            $xml .= '   <Row>';
            
            // FECHA DE EMISIÓN
            $xml .= '<Cell ss:StyleID="Date"><Data ss:Type="' . ($issueDate ? 'DateTime' : 'String') . '">' . 
                    ($issueDate ? $issueDate . 'T00:00:00.000' : '') . '</Data></Cell>';
            
            // FECHA VCTO/PAGO
            $xml .= '<Cell ss:StyleID="Date"><Data ss:Type="' . ($dueDate ? 'DateTime' : 'String') . '">' . 
                    ($dueDate ? $dueDate . 'T00:00:00.000' : '') . '</Data></Cell>';
            
            // TIPO CP/DOC
            $xml .= '<Cell><Data ss:Type="String">' . htmlspecialchars($order->cdp_type ?? '') . '</Data></Cell>';
            
            // SERIE DEL CDP
            $xml .= '<Cell><Data ss:Type="String">' . htmlspecialchars($order->cdp_serie ?? '') . '</Data></Cell>';
            
            // NRO CP O DOC
            $xml .= '<Cell><Data ss:Type="String">' . htmlspecialchars($order->cdp_number ?? '') . '</Data></Cell>';
            
            // TIPO DOC IDENTIDAD
            $xml .= '<Cell><Data ss:Type="String">' . $docType . '</Data></Cell>';
            
            // NRO DOC IDENTIDAD
            $xml .= '<Cell><Data ss:Type="String">' . htmlspecialchars($sellerDoc) . '</Data></Cell>';
            
            // APELLIDOS NOMBRES / RAZÓN SOCIAL
            $xml .= '<Cell><Data ss:Type="String">' . htmlspecialchars($order->seller_name ?? '') . '</Data></Cell>';
            
            // BI GRAVADO DG (Base imponible)
            $xml .= '<Cell ss:StyleID="Number"><Data ss:Type="Number">' . number_format($baseAmount, 2, '.', '') . '</Data></Cell>';
            
            // IGV / IPM DG
            $xml .= '<Cell ss:StyleID="Number"><Data ss:Type="Number">' . number_format($igvAmount, 2, '.', '') . '</Data></Cell>';
            
            // VALOR ADQ. NO GRAVADO (vacío)
            $xml .= '<Cell><Data ss:Type="String"></Data></Cell>';
            
            // IGV (repetido)
            $xml .= '<Cell ss:StyleID="Number"><Data ss:Type="Number">' . number_format($igvAmount, 2, '.', '') . '</Data></Cell>';
            
            // TOTAL CP
            $xml .= '<Cell ss:StyleID="Number"><Data ss:Type="Number">' . number_format($totalAmount, 2, '.', '') . '</Data></Cell>';
            
            // MONEDA
            $xml .= '<Cell><Data ss:Type="String">' . ($order->currency ?? 'PEN') . '</Data></Cell>';
            
            // TIPO CAMBIO
            $exchangeRate = $order->currency === 'USD' && $order->exchange_rate ? 
                number_format($order->exchange_rate, 3, '.', '') : '';
            $xml .= '<Cell ss:StyleID="Rate"><Data ss:Type="' . ($exchangeRate ? 'Number' : 'String') . '">' . $exchangeRate . '</Data></Cell>';
            
            // FECHA EMISIÓN DOC MODIFICADO (vacío)
            $xml .= '<Cell><Data ss:Type="String"></Data></Cell>';
            
            // TIPO CP MODIFICADO (vacío)
            $xml .= '<Cell><Data ss:Type="String"></Data></Cell>';
            
            // NRO CP MODIFICADO (vacío)
            $xml .= '<Cell><Data ss:Type="String"></Data></Cell>';
            
            // COD DAM O DSI (vacío)
            $xml .= '<Cell><Data ss:Type="String"></Data></Cell>';
            
            // NRO DAM O DSI (vacío)
            $xml .= '<Cell><Data ss:Type="String"></Data></Cell>';
            
            $xml .= '</Row>' . "\n";
        }

        $xml .= '  </Table>
 </Worksheet>
</Workbook>';

        $headers = [
            'Content-Type' => 'application/vnd.ms-excel',
            'Content-Disposition' => 'attachment; filename="registro_compras_' . date('Y-m-d') . '.xls"',
            'Cache-Control' => 'max-age=0',
        ];

        return response($xml, 200, $headers);
    }
}
