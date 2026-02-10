<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Modulos_ERP\ComprasKrsft\Services\ExchangeRateService;
use Modulos_ERP\ComprasKrsft\Services\InventoryService;

class CompraController extends Controller
{
    protected string $ordersTable = 'purchase_orders';
    protected string $projectsTable = 'projects';

    public function __construct(
        protected ExchangeRateService $exchangeRateService,
        protected InventoryService $inventoryService
    ) {}

    /**
     * Vista principal del módulo de compras
     */
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
        $status = $request->input('status');

        $query = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select(['purchase_orders.*', 'projects.name as project_name'])
            ->orderBy('purchase_orders.item_number', 'asc')
            ->orderBy('purchase_orders.created_at', 'desc');

        if ($status && $status !== 'all') {
            $query->where('purchase_orders.status', $status);
        }

        $orders = $query->get()->map(function ($order) {
            $order->materials = $order->materials ? json_decode($order->materials, true) : [];
            if (is_array($order->materials)) {
                usort($order->materials, fn($a, $b) => ($a['item_number'] ?? 0) <=> ($b['item_number'] ?? 0));
            }
            return $order;
        });

        return response()->json(['success' => true, 'orders' => $orders, 'total' => $orders->count()]);
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
                'approver.name as approved_by_name',
            ])
            ->where('purchase_orders.status', 'pending')
            ->where('purchase_orders.type', 'material')
            ->orderBy('purchase_orders.created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json(['success' => true, 'orders' => $orders, 'total' => $orders->count()]);
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
                'approver.name as approved_by_name',
            ])
            ->where('purchase_orders.status', 'to_pay')
            ->orderBy('purchase_orders.created_at', 'asc')
            ->get()
            ->map(function ($order) {
                $order->materials = $order->materials ? json_decode($order->materials, true) : [];
                return $order;
            });

        return response()->json(['success' => true, 'orders' => $orders, 'total' => $orders->count()]);
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
                'projects.available_amount as project_available',
            ])
            ->where('purchase_orders.id', $id)
            ->first();

        if (!$order) {
            return response()->json(['success' => false, 'message' => 'Orden no encontrada'], 404);
        }

        $order->materials = $order->materials ? json_decode($order->materials, true) : [];

        return response()->json(['success' => true, 'order' => $order]);
    }

    /**
     * Vendedores únicos de órdenes aprobadas (autocompletado)
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

        return response()->json(['success' => true, 'sellers' => $sellers]);
    }

    /**
     * Lista de proyectos para selector de Quick Pay
     */
    public function projects(Request $request)
    {
        try {
            $projects = DB::table($this->projectsTable)
                ->select('id', 'name', 'currency', 'available_amount', 'status')
                ->orderBy('name', 'asc')
                ->get();

            return response()->json(['success' => true, 'projects' => $projects]);
        } catch (\Exception $e) {
            Log::error('Error en projects', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno al obtener proyectos'], 500);
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
            'stats' => compact('pending', 'approved', 'rejected') + ['total_approved_amount' => $totalApproved],
        ]);
    }

    /**
     * Endpoint público para obtener tipo de cambio actual
     */
    public function exchangeRate()
    {
        $rate = $this->exchangeRateService->getRate();

        if ($rate) {
            return response()->json(['success' => true, 'rate' => $rate, 'date' => now()->format('Y-m-d')]);
        }

        return response()->json(['success' => false, 'message' => 'No se pudo obtener el tipo de cambio'], 500);
    }

    /**
     * Buscar coincidencias en inventario
     */
    public function searchInventory(Request $request)
    {
        $request->validate([
            'search' => 'required|string|min:2',
            'project_id' => 'nullable|integer',
        ]);

        $result = $this->inventoryService->search(
            $request->input('search'),
            $request->input('project_id')
        );

        if (!$result['available']) {
            return response()->json([
                'success' => false,
                'message' => 'Módulo de inventario no disponible',
                'items' => [],
            ]);
        }

        return response()->json([
            'success' => true,
            'items' => $result['items'],
            'total' => $result['items']->count(),
        ]);
    }
}
