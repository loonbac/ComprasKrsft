<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Modulos_ERP\ComprasKrsft\Services\InventoryService;

class CancellationController extends Controller
{
    protected string $ordersTable = 'purchase_orders';
    protected string $projectsTable = 'projects';

    public function __construct(
        protected InventoryService $inventoryService
    ) {}

    /**
     * Paso 1: Iniciar anulación — solo cambia el estado
     * El usuario hizo clic en "Anular Factura" → la factura pasa a 'solicitando_anulacion'
     * y mostrará una alerta pidiendo datos de NC.
     */
    public function initCancellation(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermission('module.compraskrsft.paid_full')) {
            abort(403, 'No tienes permiso para anular facturas.');
        }

        $request->validate([
            'batch_id' => 'required|string',
        ]);

        try {
            $batchId = $request->input('batch_id');

            $orders = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('payment_confirmed', true)
                ->whereNull('cancellation_status')
                ->get();

            if ($orders->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron facturas válidas para anular',
                ], 404);
            }

            DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('payment_confirmed', true)
                ->whereNull('cancellation_status')
                ->update([
                    'cancellation_status'       => 'solicitando_anulacion',
                    'cancellation_requested_by' => auth()->id(),
                    'cancellation_requested_at' => now(),
                    'updated_at'                => now(),
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Anulación iniciada. Debe ingresar los datos de la Nota de Crédito.',
            ]);
        } catch (\Exception $e) {
            Log::error('Error en initCancellation', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Paso 2: Guardar datos de Nota de Crédito
     * La factura ya está en 'solicitando_anulacion', el usuario llena los datos de NC.
     */
    public function requestCancellation(Request $request)
    {
        $request->validate([
            'batch_id'         => 'required|string',
            'nc_serie'         => 'required|string|max:20',
            'nc_number'        => 'required|string|max:20',
            'nc_document_link' => 'nullable|string|max:2048',
        ]);

        try {
            $batchId = $request->input('batch_id');

            // Verificar que las órdenes estén en estado 'solicitando_anulacion'
            $orders = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('cancellation_status', 'solicitando_anulacion')
                ->get();

            if ($orders->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron facturas en estado de solicitud de anulación',
                ], 404);
            }

            // Manejar archivo de NC
            $ncDocPath = null;
            if ($request->hasFile('nc_document')) {
                $file = $request->file('nc_document');
                $filename = 'nc_' . $batchId . '_' . time() . '.' . $file->getClientOriginalExtension();
                $ncDocPath = $file->storeAs('nc_documents', $filename, 'public');
            }

            $ncLink = $request->input('nc_document_link');

            // Validar que al menos haya archivo o link
            if (!$ncDocPath && !$ncLink) {
                return response()->json([
                    'success' => false,
                    'message' => 'Debe adjuntar un archivo PDF o ingresar un link de la Nota de Crédito',
                ], 422);
            }

            $updateData = [
                'nc_type'    => '07',
                'nc_serie'   => $request->input('nc_serie'),
                'nc_number'  => $request->input('nc_number'),
                'updated_at' => now(),
            ];

            if ($ncDocPath) {
                $updateData['nc_document'] = $ncDocPath;
            }
            if ($ncLink) {
                $updateData['nc_document_link'] = $ncLink;
            }

            DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('cancellation_status', 'solicitando_anulacion')
                ->update($updateData);

            return response()->json([
                'success' => true,
                'message' => 'Datos de Nota de Crédito registrados.',
            ]);
        } catch (\Exception $e) {
            Log::error('Error en requestCancellation', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error interno al registrar datos de NC',
            ], 500);
        }
    }

    /**
     * Paso 2: Confirmar datos de NC — cambiar a 'finalizar_anulacion'
     * (El usuario revisó los datos y confirma que son correctos)
     */
    public function confirmCancellation(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermission('module.compraskrsft.paid_full')) {
            abort(403, 'No tienes permiso para confirmar anulaciones.');
        }

        $request->validate([
            'batch_id' => 'required|string',
        ]);

        try {
            $batchId = $request->input('batch_id');

            $updated = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('cancellation_status', 'solicitando_anulacion')
                ->update([
                    'cancellation_status' => 'finalizar_anulacion',
                    'updated_at'          => now(),
                ]);

            if ($updated === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron facturas en estado de solicitud de anulación',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Anulación confirmada. Pendiente de finalización.',
            ]);
        } catch (\Exception $e) {
            Log::error('Error en confirmCancellation', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Paso 3a: Finalizar anulación — marcar como 'anulada'
     * Revierte presupuesto del proyecto, devuelve ítems a POR APROBAR,
     * y revierte inventario si aplica.
     */
    public function finalizeCancellation(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermission('module.compraskrsft.paid_full')) {
            abort(403, 'No tienes permiso para finalizar anulaciones.');
        }

        $request->validate([
            'batch_id' => 'required|string',
        ]);

        try {
            return DB::transaction(function () use ($request) {
                $batchId = $request->input('batch_id');

                $orders = DB::table($this->ordersTable)
                    ->where('batch_id', $batchId)
                    ->where('cancellation_status', 'finalizar_anulacion')
                    ->get();

                if ($orders->isEmpty()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se encontraron facturas pendientes de finalización',
                    ], 404);
                }

                // 1. Marcar todas las órdenes del batch como anuladas
                DB::table($this->ordersTable)
                    ->where('batch_id', $batchId)
                    ->where('cancellation_status', 'finalizar_anulacion')
                    ->update([
                        'cancellation_status' => 'anulada',
                        'cancelled_by'        => auth()->id(),
                        'cancelled_at'        => now(),
                        'updated_at'          => now(),
                    ]);

                // 2. Buscar órdenes hijas de inventario (splits) vinculadas a este batch
                $parentIds = $orders->pluck('id')->toArray();
                $childInventoryOrders = collect();
                if (!empty($parentIds)) {
                    $childInventoryOrders = DB::table($this->ordersTable)
                        ->whereIn('parent_order_id', $parentIds)
                        ->where('source_type', 'inventory')
                        ->whereNull('cancellation_status')
                        ->get();

                    // Marcar órdenes hijas de inventario como anuladas
                    if ($childInventoryOrders->isNotEmpty()) {
                        DB::table($this->ordersTable)
                            ->whereIn('id', $childInventoryOrders->pluck('id')->toArray())
                            ->update([
                                'cancellation_status' => 'anulada',
                                'cancelled_by'        => auth()->id(),
                                'cancelled_at'        => now(),
                                'updated_at'          => now(),
                            ]);
                    }
                }

                // Lookup de orden hija por parent_order_id
                $childByParent = $childInventoryOrders->keyBy('parent_order_id');

                foreach ($orders as $order) {
                    $childOrder = $childByParent->get($order->id);

                    // 3. Devolver ítems a POR APROBAR (con cantidad original restaurada)
                    $this->returnItemsToPending($order, $childOrder);

                    // 4. Revertir inventario del batch (elimina productos, revierte reservaciones)
                    $this->reverseInventory($order);
                }

                // 5. Revertir reservaciones de inventario de las órdenes hijas
                foreach ($childInventoryOrders as $childOrder) {
                    $this->reverseInventory($childOrder);
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Factura anulada exitosamente. Los ítems han sido devueltos a Por Aprobar.',
                ]);
            });
        } catch (\Exception $e) {
            Log::error('Error en finalizeCancellation', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error interno al finalizar la anulación',
            ], 500);
        }
    }

    /**
     * Paso 3b: Rechazar anulación — devolver a 'solicitando_anulacion'
     * para que el usuario corrija los datos.
     */
    public function rejectCancellation(Request $request)
    {
        $user = $request->user();
        if (!$user->isAdmin() && !$user->hasPermission('module.compraskrsft.paid_full')) {
            abort(403, 'No tienes permiso para rechazar anulaciones.');
        }

        $request->validate([
            'batch_id' => 'required|string',
        ]);

        try {
            $batchId = $request->input('batch_id');

            // Limpiar datos de NC y devolver a estado sin anulación
            $updated = DB::table($this->ordersTable)
                ->where('batch_id', $batchId)
                ->where('cancellation_status', 'finalizar_anulacion')
                ->update([
                    'cancellation_status'       => null,
                    'nc_type'                   => null,
                    'nc_serie'                  => null,
                    'nc_number'                 => null,
                    'nc_document'               => null,
                    'nc_document_link'          => null,
                    'cancellation_requested_by' => null,
                    'cancellation_requested_at' => null,
                    'updated_at'                => now(),
                ]);

            if ($updated === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron facturas para rechazar',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Anulación rechazada. La factura vuelve a su estado normal.',
            ]);
        } catch (\Exception $e) {
            Log::error('Error en rejectCancellation', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Clonar los ítems de la orden como nuevas órdenes en estado 'pending'
     * para que aparezcan en la pestaña "Por Aprobar".
     */
    private function returnItemsToPending(object $order, ?object $childInventoryOrder = null): void
    {
        try {
            // No clonar órdenes que son 100% de inventario (solo se revierten reservaciones)
            if ($order->source_type === 'inventory') {
                Log::info('Omitiendo clone a pending para orden de inventario', [
                    'order_id' => $order->id,
                ]);
                return;
            }

            // Restaurar cantidad original si fue un split parcial
            $materials = $order->materials;
            if ($materials && $childInventoryOrder) {
                $decoded = json_decode($materials, true);
                if (is_array($decoded)) {
                    foreach ($decoded as &$mat) {
                        if (isset($mat['original_qty'])) {
                            $mat['qty'] = $mat['original_qty'];
                            unset($mat['original_qty'], $mat['qty_from_stock'], $mat['stock_unit_price']);
                        }
                    }
                    unset($mat);
                    $materials = json_encode($decoded);
                }
            }

            // Obtener el siguiente item_number disponible para el proyecto
            $maxItemNumber = DB::table($this->ordersTable)
                ->where('project_id', $order->project_id)
                ->max('item_number');
            $nextItemNumber = ($maxItemNumber ?? 0) + 1;

            DB::table($this->ordersTable)->insert([
                'project_id'      => $order->project_id,
                'item_number'     => $nextItemNumber,
                'type'            => $order->type,
                'description'     => $order->description,
                'materials'       => $materials,
                'unit'            => $order->unit,
                'diameter'        => $order->diameter ?? null,
                'series'          => $order->series ?? null,
                'material_type'   => $order->material_type ?? null,
                'status'          => 'pending',
                'source_type'     => 'external',
                'source_filename' => $order->source_filename ?? null,
                'imported_at'     => $order->imported_at ?? null,
                'created_by'      => auth()->id(),
                'notes'           => 'Devuelto por anulación de factura (Lote: ' . $order->batch_id . ')',
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);

            Log::info('Ítem devuelto a POR APROBAR por anulación', [
                'original_order_id' => $order->id,
                'project_id'        => $order->project_id,
                'new_item_number'   => $nextItemNumber,
            ]);
        } catch (\Exception $e) {
            Log::error('Error al devolver ítem a pending: ' . $e->getMessage());
        }
    }

    /**
     * Revertir los ítems de inventario asociados a esta orden.
     * Elimina los productos del inventario que fueron creados al pagar.
     */
    private function reverseInventory(object $order): void
    {
        try {
            if ($order->type !== 'material') {
                return;
            }

            $batchId = $order->batch_id;

            // Eliminar productos de inventario creados con este batch (solo si tiene batch_id)
            if ($batchId && DB::getSchemaBuilder()->hasTable('inventario_productos')) {
                $deleted = DB::table('inventario_productos')
                    ->where('batch_id', $batchId)
                    ->where('project_id', $order->project_id)
                    ->delete();

                if ($deleted > 0) {
                    Log::info('Inventario revertido por anulación', [
                        'batch_id'   => $batchId,
                        'project_id' => $order->project_id,
                        'deleted'    => $deleted,
                    ]);
                }
            }

            // Revertir reservaciones de inventario (siempre, independiente de batch_id)
            if (DB::getSchemaBuilder()->hasTable('inventory_reservations')) {
                $reservations = DB::table('inventory_reservations')
                    ->where('purchase_order_id', $order->id)
                    ->where('status', 'active')
                    ->get();

                foreach ($reservations as $reservation) {
                    // Devolver cantidad reservada al item de inventario
                    DB::table('inventario_productos')
                        ->where('id', $reservation->inventory_item_id)
                        ->update([
                            'cantidad_reservada' => DB::raw("GREATEST(0, COALESCE(cantidad_reservada, 0) - {$reservation->quantity_reserved})"),
                            'updated_at'         => now(),
                        ]);

                    // Marcar reservación como liberada
                    DB::table('inventory_reservations')
                        ->where('id', $reservation->id)
                        ->update([
                            'status'     => 'released',
                            'updated_at' => now(),
                        ]);
                }

                if ($reservations->count() > 0) {
                    Log::info('Reservaciones de inventario revertidas', [
                        'order_id' => $order->id,
                        'count'    => $reservations->count(),
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Error al revertir inventario: ' . $e->getMessage());
        }
    }
}
