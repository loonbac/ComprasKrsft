<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Modulos_ERP\ComprasKrsft\Services\CrossFlowService;

/**
 * Controlador para el flujo transversal Proyectos-Compras-Almacén.
 *
 * Endpoints:
 * - POST   /mark-purchased/{id}      → Marcar como comprado + calcular precio unitario
 * - POST   /confirm-receipt/{id}     → Confirmar recepción en almacén (→ Apartado)
 * - POST   /finalize-project/{id}    → Finalizar proyecto (→ liberar materiales)
 * - GET    /available-stock           → Buscar stock disponible para reutilización
 * - POST   /preview-mixed            → Vista previa de división stock + compra
 * - POST   /process-mixed            → Procesar selección mixta
 * - GET    /incoming-materials        → Materiales "próximos a llegar"
 * - GET    /price-history             → Historial de precios de un material
 */
class CrossFlowController extends Controller
{
    public function __construct(
        protected CrossFlowService $crossFlowService
    ) {}

    /**
     * Marcar orden como "Comprado" y calcular precio unitario.
     * POST /api/compraskrsft/cross-flow/mark-purchased/{id}
     */
    public function markPurchased(Request $request, int $id)
    {
        $request->validate([
            'total_price' => 'required|numeric|min:0',
        ]);

        try {
            $result = $this->crossFlowService->markAsPurchased(
                $id,
                floatval($request->input('total_price')),
                auth()->id()
            );

            $status = $result['success'] ? 200 : 400;
            return response()->json($result, $status);
        } catch (\Exception $e) {
            Log::error('Error en markPurchased', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno al procesar la compra'], 500);
        }
    }

    /**
     * Confirmar recepción de materiales en almacén → "Apartado".
     * POST /api/compraskrsft/cross-flow/confirm-receipt/{id}
     */
    public function confirmReceipt(Request $request, int $id)
    {
        try {
            $result = $this->crossFlowService->confirmWarehouseReceipt($id, auth()->id());
            $status = $result['success'] ? 200 : 400;
            return response()->json($result, $status);
        } catch (\Exception $e) {
            Log::error('Error en confirmReceipt', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno al confirmar recepción'], 500);
        }
    }

    /**
     * Finalizar proyecto y liberar materiales "Apartado" → "Disponible".
     * POST /api/compraskrsft/cross-flow/finalize-project/{id}
     */
    public function finalizeProject(Request $request, int $id)
    {
        try {
            $result = $this->crossFlowService->releaseProjectMaterials($id, auth()->id());
            $status = $result['success'] ? 200 : 400;
            return response()->json($result, $status);
        } catch (\Exception $e) {
            Log::error('Error en finalizeProject', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno al finalizar proyecto'], 500);
        }
    }

    /**
     * Buscar stock disponible para reutilización.
     * GET /api/compraskrsft/cross-flow/available-stock?search=tubo&project_id=5
     */
    public function availableStock(Request $request)
    {
        $request->validate([
            'search' => 'required|string|min:2',
            'project_id' => 'nullable|integer',
        ]);

        try {
            $result = $this->crossFlowService->getAvailableStock(
                $request->input('search'),
                $request->input('project_id')
            );

            return response()->json([
                'success' => $result['available'],
                'items'   => $result['items'],
                'total'   => is_countable($result['items']) ? count($result['items']) : 0,
            ]);
        } catch (\Exception $e) {
            Log::error('Error en availableStock', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'items' => [], 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Vista previa de la división stock + compra nueva (sin persistir).
     * POST /api/compraskrsft/cross-flow/preview-mixed
     */
    public function previewMixed(Request $request)
    {
        $request->validate([
            'order_id'          => 'required|integer',
            'inventory_item_id' => 'required|integer',
            'qty_from_stock'    => 'required|integer|min:1',
        ]);

        try {
            $result = $this->crossFlowService->previewMixedSource(
                $request->input('order_id'),
                $request->input('inventory_item_id'),
                $request->input('qty_from_stock')
            );

            $status = $result['success'] ? 200 : 400;
            return response()->json($result, $status);
        } catch (\Exception $e) {
            Log::error('Error en previewMixed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Procesar selección mixta (inventario + compra nueva).
     * POST /api/compraskrsft/cross-flow/process-mixed
     */
    public function processMixed(Request $request)
    {
        $request->validate([
            'order_id'            => 'required|integer',
            'inventory_item_id'   => 'required|integer',
            'qty_from_stock'      => 'required|integer|min:1',
            'new_purchase_price'  => 'required|numeric|min:0',
            'project_id'          => 'required|integer',
        ]);

        try {
            $result = $this->crossFlowService->processMixedSource(
                $request->input('order_id'),
                $request->input('inventory_item_id'),
                $request->input('qty_from_stock'),
                floatval($request->input('new_purchase_price')),
                $request->input('project_id')
            );

            $status = $result['success'] ? 200 : 400;
            return response()->json($result, $status);
        } catch (\Exception $e) {
            Log::error('Error en processMixed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno al procesar selección mixta'], 500);
        }
    }

    /**
     * Materiales "Próximos a llegar" al almacén.
     * GET /api/compraskrsft/cross-flow/incoming-materials
     */
    public function incomingMaterials(Request $request)
    {
        try {
            $result = $this->crossFlowService->getIncomingMaterials(
                $request->input('project_id')
            );

            return response()->json($result);
        } catch (\Exception $e) {
            Log::error('Error en incomingMaterials', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'orders' => [], 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Historial de precios de un material.
     * GET /api/compraskrsft/cross-flow/price-history?material=tubo&unit=UND
     */
    public function priceHistory(Request $request)
    {
        $request->validate([
            'material' => 'required|string|min:2',
            'unit'     => 'nullable|string',
        ]);

        try {
            $history = $this->crossFlowService->getMaterialPriceHistory(
                $request->input('material'),
                $request->input('unit')
            );

            return response()->json(['success' => true, 'history' => $history]);
        } catch (\Exception $e) {
            Log::error('Error en priceHistory', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'history' => []], 500);
        }
    }
}
