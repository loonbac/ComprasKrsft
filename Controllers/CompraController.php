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
            'amount' => 'required|numeric|min:0.01'
        ]);

        try {
            DB::table($this->ordersTable)
                ->where('id', $id)
                ->update([
                    'amount' => floatval($request->amount),
                    'status' => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => now(),
                    'notes' => $request->input('notes'),
                    'updated_at' => now()
                ]);

            return response()->json([
                'success' => true,
                'message' => 'Orden aprobada exitosamente'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error: ' . $e->getMessage()
            ], 500);
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
}
