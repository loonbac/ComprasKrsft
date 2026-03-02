<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SupplierController extends Controller
{
    protected string $suppliersTable = 'suppliers';
    protected string $ordersTable = 'purchase_orders';

    /**
     * Listar todos los proveedores activos
     */
    public function index()
    {
        $suppliers = DB::table($this->suppliersTable)
            ->where('active', true)
            ->orderBy('name', 'asc')
            ->get();

        return response()->json(['success' => true, 'suppliers' => $suppliers]);
    }

    /**
     * Buscar proveedores para autocompletado (por nombre o documento)
     */
    public function search(Request $request)
    {
        $q = $request->input('q', '');
        if (strlen($q) < 2) {
            return response()->json(['success' => true, 'suppliers' => []]);
        }

        $suppliers = DB::table($this->suppliersTable)
            ->where('active', true)
            ->where(function ($query) use ($q) {
                $query->where('name', 'like', "%{$q}%")
                      ->orWhere('document', 'like', "%{$q}%");
            })
            ->orderBy('name', 'asc')
            ->limit(10)
            ->get();

        return response()->json(['success' => true, 'suppliers' => $suppliers]);
    }

    /**
     * Obtener un proveedor con su detalle de gastos.
     * Convierte USD a PEN usando el exchange_rate original de cada transacción.
     */
    public function show($id)
    {
        $supplier = DB::table($this->suppliersTable)->find($id);

        if (!$supplier) {
            return response()->json(['success' => false, 'message' => 'Proveedor no encontrado'], 404);
        }

        $orders = $this->getSupplierOrders($supplier->name, $supplier->document);

        return response()->json([
            'success' => true,
            'supplier' => $supplier,
            'orders' => $orders,
        ]);
    }

    /**
     * Listar todos los proveedores con su gasto total en PEN.
     * Para órdenes en USD, se usa el exchange_rate registrado en la transacción original.
     */
    public function indexWithSpending()
    {
        $suppliers = DB::table($this->suppliersTable)
            ->where('active', true)
            ->orderBy('name', 'asc')
            ->get();

        // Obtener totales de gasto por proveedor (agrupado por seller_name + seller_document)
        // Se convierten montos USD→PEN usando el exchange_rate exacto de cada orden
        $result = $suppliers->map(function ($supplier) {
            $orders = $this->getSupplierOrders($supplier->name, $supplier->document);

            $totalPen = 0;
            $orderCount = 0;
            $ordersByProject = [];

            foreach ($orders as $order) {
                $orderCount++;

                // total_with_igv ya está en PEN (calculado al aprobar)
                $orderPen = floatval($order->total_with_igv ?? $order->amount_pen ?? 0);
                $totalPen += $orderPen;

                // Agrupar por proyecto
                $projectId = $order->project_id;
                if (!isset($ordersByProject[$projectId])) {
                    $ordersByProject[$projectId] = [
                        'project_id' => $projectId,
                        'project_name' => $order->project_name,
                        'total_pen' => 0,
                        'order_count' => 0,
                        'orders' => [],
                    ];
                }
                $ordersByProject[$projectId]['total_pen'] += $orderPen;
                $ordersByProject[$projectId]['order_count']++;
                $ordersByProject[$projectId]['orders'][] = [
                    'id' => $order->id,
                    'description' => $order->description,
                    'amount' => floatval($order->amount),
                    'currency' => $order->currency,
                    'exchange_rate' => floatval($order->exchange_rate ?? 0),
                    'amount_pen' => floatval($order->amount_pen ?? 0),
                    'igv_amount' => floatval($order->igv_amount ?? 0),
                    'total_with_igv' => floatval($order->total_with_igv ?? 0),
                    'status' => $order->status,
                    'approved_at' => $order->approved_at,
                    'payment_confirmed_at' => $order->payment_confirmed_at,
                ];
            }

            $supplier->total_pen = round($totalPen, 2);
            $supplier->order_count = $orderCount;
            $supplier->projects = array_values($ordersByProject);

            return $supplier;
        });

        return response()->json(['success' => true, 'suppliers' => $result]);
    }

    /**
     * Actualizar datos de un proveedor
     */
    public function update(Request $request, $id)
    {
        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'document' => 'sometimes|nullable|string|max:20',
            'document_type' => 'sometimes|nullable|string|in:RUC,DNI,CE',
            'contact_phone' => 'sometimes|nullable|string|max:30',
            'contact_email' => 'sometimes|nullable|string|max:100',
            'address' => 'sometimes|nullable|string|max:500',
            'notes' => 'sometimes|nullable|string|max:1000',
        ]);

        $supplier = DB::table($this->suppliersTable)->find($id);
        if (!$supplier) {
            return response()->json(['success' => false, 'message' => 'Proveedor no encontrado'], 404);
        }

        $fields = ['name', 'document', 'document_type', 'contact_phone',
                    'contact_email', 'address', 'notes'];

        $updateData = [];
        foreach ($fields as $field) {
            if ($request->has($field)) {
                $updateData[$field] = $request->input($field, '') ?: null;
            }
        }

        // name nunca debe ser null
        if (isset($updateData['name'])) {
            $updateData['name'] = $request->input('name');
        }

        $updateData['updated_at'] = now();

        DB::table($this->suppliersTable)->where('id', $id)->update($updateData);

        return response()->json(['success' => true, 'message' => 'Proveedor actualizado']);
    }

    /**
     * Desactivar un proveedor (soft delete)
     */
    public function destroy($id)
    {
        $supplier = DB::table($this->suppliersTable)->find($id);
        if (!$supplier) {
            return response()->json(['success' => false, 'message' => 'Proveedor no encontrado'], 404);
        }

        DB::table($this->suppliersTable)->where('id', $id)->update([
            'active' => false,
            'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'message' => 'Proveedor desactivado']);
    }

    // ── Helpers privados ────────────────────────────────────────────────

    /**
     * Obtener órdenes asociadas a un proveedor (por nombre y/o documento).
     * Incluye órdenes aprobadas y pagadas (no pendientes ni rechazadas).
     */
    private function getSupplierOrders(string $name, ?string $document)
    {
        $query = DB::table($this->ordersTable)
            ->join('projects', 'purchase_orders.project_id', '=', 'projects.id')
            ->select([
                'purchase_orders.*',
                'projects.name as project_name',
            ])
            ->whereIn('purchase_orders.status', ['to_pay', 'approved']);

        if ($document && $document !== '') {
            // Buscar por documento exacto O por nombre
            $query->where(function ($q) use ($name, $document) {
                $q->where('purchase_orders.seller_document', $document)
                  ->orWhere('purchase_orders.seller_name', $name);
            });
        } else {
            $query->where('purchase_orders.seller_name', $name);
        }

        return $query->orderBy('purchase_orders.approved_at', 'desc')->get();
    }

    /**
     * Crear o actualizar proveedor a partir de datos de una compra aprobada.
     * Se llama automáticamente al aprobar órdenes.
     *
     * @param string $sellerName
     * @param string|null $sellerDocument
     * @return int ID del proveedor
     */
    public static function upsertFromApproval(string $sellerName, ?string $sellerDocument): int
    {
        $now = now();

        // Buscar primero por documento (si existe), luego por nombre
        $existing = null;
        if ($sellerDocument && $sellerDocument !== '') {
            $existing = DB::table('suppliers')
                ->where('document', $sellerDocument)
                ->first();
        }

        if (!$existing) {
            $existing = DB::table('suppliers')
                ->where('name', $sellerName)
                ->first();
        }

        if ($existing) {
            // Actualizar nombre si el documento coincide (puede haber cambiado la razón social)
            $update = ['updated_at' => $now, 'active' => true];
            if ($sellerDocument && $sellerDocument !== '' && $existing->document !== $sellerDocument) {
                $update['document'] = $sellerDocument;
            }
            if ($existing->name !== $sellerName) {
                $update['name'] = $sellerName;
            }
            DB::table('suppliers')->where('id', $existing->id)->update($update);
            return $existing->id;
        }

        // Crear nuevo proveedor
        $documentType = 'RUC';
        if ($sellerDocument) {
            $len = strlen(preg_replace('/\D/', '', $sellerDocument));
            if ($len === 8) $documentType = 'DNI';
        }

        return DB::table('suppliers')->insertGetId([
            'name' => $sellerName,
            'document' => $sellerDocument,
            'document_type' => $documentType,
            'active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }
}
