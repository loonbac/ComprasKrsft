<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ExportController extends Controller
{
    protected string $ordersTable = 'purchase_orders';
    protected string $projectsTable = 'projects';

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
                'purchase_orders.amount_pen',
            ])
            ->where('purchase_orders.status', 'approved')
            ->orderBy('purchase_orders.created_at', 'desc')
            ->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="compras_' . date('Y-m-d') . '.csv"',
        ];

        $callback = function () use ($orders) {
            $file = fopen('php://output', 'w');

            // BOM for UTF-8 Excel compatibility
            fprintf($file, chr(0xEF) . chr(0xBB) . chr(0xBF));

            fputcsv($file, [
                'ID', 'Fecha de Emisión', 'Proyecto', 'Descripción', 'Tipo',
                'Monto Original', 'Moneda', 'Tipo de Cambio', 'Monto en Soles',
            ], ';');

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
                    number_format($order->amount_pen, 2, '.', ''),
                ], ';');
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
