<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

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

    /**
     * Exportar una lista importada en formato oficial de requerimiento EJE.
     * Los ítems que ya fueron cotizados/comprados se exportan subrayados.
     */
    public function exportMaterialList(Request $request)
    {
        $validated = $request->validate([
            'project_id' => 'required|integer',
            'source_filename' => 'required|string|max:255',
        ]);

        $projectId = (int) $validated['project_id'];
        $sourceFilename = trim($validated['source_filename']);

        $project = DB::table($this->projectsTable)->where('id', $projectId)->first();
        if (!$project) {
            return response()->json(['success' => false, 'message' => 'Proyecto no encontrado'], 404);
        }

        $orders = DB::table($this->ordersTable)
            ->where('project_id', $projectId)
            ->where('source_filename', $sourceFilename)
            ->where(function ($q) {
                $q->whereNull('cancellation_status')
                  ->orWhere('cancellation_status', '!=', 'anulada');
            })
            ->where(function ($q) {
                $q->whereNull('type')
                  ->orWhere('type', '!=', 'service');
            })
            ->orderByRaw('CAST(item_number AS UNSIGNED) ASC')
            ->orderBy('item_number', 'asc')
            ->orderBy('id', 'asc')
            ->get();

        if ($orders->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'No se encontraron ítems para esta lista'], 404);
        }

        $moduleRoot = dirname(__DIR__, 2);
        $templatePath = $moduleRoot . '/proyectoskrsft/Assets/Templates/FORMATO DE REQUERIMIENTOS MATERIALES O EQUIPOS - EXCEL.xlsx';

        if (file_exists($templatePath)) {
            $spreadsheet = IOFactory::load($templatePath);
        } else {
            // Fallback mínimo si no existe la plantilla física
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('REQUERIMIENTO');
            $sheet->fromArray(['ITEM', 'CANTIDAD', 'TIPO DE MATERIAL', 'ESPECIFICACION TECNICA', 'MEDIDA', 'TIPO DE CONEXIÓN', 'OBSERVACIONES'], null, 'A9');
            $sheet->getStyle('A9:G9')->getFont()->setBold(true);
            $sheet->getStyle('A9:G9')->getFill()->setFillType(Fill::FILL_SOLID)->getStartColor()->setARGB('FFF3F4F6');
        }

        $sheet = $spreadsheet->getSheet(0);
        $first = $orders->first();

        // Cabecera del requerimiento (coordenadas del formato oficial)
        $sheet->setCellValue('C4', $first->area_solicitante ?? '-');
        $sheet->setCellValue('E4', ($first->proyecto_obra ?? null) ?: ($project->name ?? '-'));
        $sheet->setCellValue('C5', $first->numero_solicitud ?? '-');
        $sheet->setCellValue('E5', !empty($first->fecha_solicitud) ? $this->toDisplayDate($first->fecha_solicitud) : '-');
        $sheet->setCellValue('C6', !empty($first->fecha_requerida) ? $this->toDisplayDate($first->fecha_requerida) : '-');
        $sheet->setCellValue('E6', !empty($first->prioridad) ? strtoupper((string) $first->prioridad) : '-');
        $sheet->setCellValue('C7', $first->solicitado_por ?? '-');
        $sheet->setCellValue('E7', $first->cargo ?? '-');

        // Limpia una ventana razonable antes de rellenar
        for ($r = 10; $r <= 250; $r++) {
            $sheet->setCellValue("A{$r}", null);
            $sheet->setCellValue("B{$r}", null);
            $sheet->setCellValue("C{$r}", null);
            $sheet->setCellValue("D{$r}", null);
            $sheet->setCellValue("E{$r}", null);
            $sheet->setCellValue("F{$r}", null);
            $sheet->setCellValue("G{$r}", null);
        }

        $row = 10;
        foreach ($orders as $order) {
            $qty = $this->extractOrderQty($order);

            $sheet->setCellValue("A{$row}", $order->item_number ?: ($row - 9));
            $sheet->setCellValue("B{$row}", $qty);
            $sheet->setCellValue("C{$row}", $order->material_type ?: '');
            $sheet->setCellValue("D{$row}", $order->description ?: '');
            $sheet->setCellValue("E{$row}", $order->diameter ?: '');
            $sheet->setCellValue("F{$row}", $order->series ?: '');
            $sheet->setCellValue("G{$row}", $order->notes ?: '');

            if ($this->isQuotedOrPurchased($order)) {
                $sheet->getStyle("A{$row}:G{$row}")->getFill()
                    ->setFillType(Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFFFFF00'); // Fondo Amarillo para cotizados
            }

            $sheet->getStyle("A{$row}:G{$row}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
            $row++;
        }

        $safeBase = preg_replace('/[^A-Za-z0-9._\- ]/', '_', pathinfo($sourceFilename, PATHINFO_FILENAME)) ?: 'lista';
        $downloadName = $safeBase . '_compras_' . date('Ymd_His') . '.xlsx';

        $tmp = tempnam(sys_get_temp_dir(), 'req_');
        (new Xlsx($spreadsheet))->save($tmp);

        return response()->download($tmp, $downloadName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    private function extractOrderQty(object $order): float|int
    {
        if (!empty($order->requested_qty)) {
            return (float) $order->requested_qty;
        }

        $materials = json_decode((string) ($order->materials ?? '[]'), true);
        if (is_array($materials) && !empty($materials[0]['qty'])) {
            return (float) $materials[0]['qty'];
        }

        return 1;
    }

    private function isQuotedOrPurchased(object $order): bool
    {
        $status = strtolower((string) ($order->status ?? ''));
        if (in_array($status, ['quoted', 'to_pay', 'approved', 'purchased', 'paid'], true)) {
            return true;
        }

        if (!empty($order->payment_confirmed)) {
            return true;
        }

        return (float) ($order->amount ?? 0) > 0;
    }

    private function toDisplayDate($value): string
    {
        if (empty($value)) {
            return '';
        }

        try {
            return \Carbon\Carbon::parse($value)->format('d/m/Y');
        } catch (\Exception $e) {
            return (string) $value;
        }
    }
}
