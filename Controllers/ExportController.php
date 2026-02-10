<?php

namespace Modulos_ERP\ComprasKrsft\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;

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
     * Exportar órdenes pagadas a Excel (formato XLSX)
     * Formato compatible con registros de compras SUNAT
     */
    public function exportPaidExcel(Request $request)
    {
        $orders = $this->getPaidOrdersForExport($request);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Registro de Compras');

        $this->setExcelHeaders($sheet);
        $this->setExcelColumnWidths($sheet);
        $this->fillExcelData($sheet, $orders);

        $filename = 'registro_compras_' . date('Y-m-d') . '.xlsx';
        $tempFile = tempnam(sys_get_temp_dir(), 'excel_');

        $writer = new Xlsx($spreadsheet);
        $writer->save($tempFile);

        return response()->download($tempFile, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend(true);
    }

    // ====================================================================
    // MÉTODOS PRIVADOS
    // ====================================================================

    private function getPaidOrdersForExport(Request $request)
    {
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $query = DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select(['purchase_orders.*', 'projects.name as project_name'])
            ->where('purchase_orders.status', 'approved')
            ->where('purchase_orders.payment_confirmed', true);

        if ($startDate) {
            $query->whereDate('purchase_orders.payment_confirmed_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('purchase_orders.payment_confirmed_at', '<=', $endDate);
        }

        return $query->orderBy('purchase_orders.issue_date', 'asc')
            ->orderBy('purchase_orders.payment_confirmed_at', 'asc')
            ->get();
    }

    private function setExcelHeaders($sheet): void
    {
        $headers = [
            'FECHA DE EMISIÓN', 'FECHA VCTO/PAGO', 'TIPO CP/DOC', 'SERIE DEL CDP',
            'NRO CP O DOC', 'TIPO DOC IDENTIDAD', 'NRO DOC IDENTIDAD',
            'APELLIDOS NOMBRES/ RAZÓN SOCIAL', 'BI GRAVADO DG', 'IGV / IPM DG',
            'VALOR ADQ. NO. GRA', 'IGV', 'TOTAL CP', 'MONEDA', 'TIPO CAMBIO',
            'FECHA EMISIÓN DOC MOD', 'TIPO CP MOD', 'NRO CP MOD',
            'COD. DAM O DSI', 'NRO. DAM O DSI',
        ];

        $col = 'A';
        foreach ($headers as $header) {
            $sheet->setCellValue($col . '1', $header);
            $col++;
        }

        // Estilo del encabezado
        $sheet->getStyle('A1:T1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 10],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '10B981']],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
            'borders' => [
                'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '000000']],
            ],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(30);
    }

    private function setExcelColumnWidths($sheet): void
    {
        $widths = [
            'A' => 15, 'B' => 15, 'C' => 12, 'D' => 12, 'E' => 15,
            'F' => 10, 'G' => 15, 'H' => 35, 'I' => 14, 'J' => 12,
            'K' => 14, 'L' => 12, 'M' => 14, 'N' => 10, 'O' => 12,
            'P' => 15, 'Q' => 12, 'R' => 15, 'S' => 12, 'T' => 12,
        ];

        foreach ($widths as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
    }

    private function fillExcelData($sheet, $orders): void
    {
        $row = 2;
        foreach ($orders as $order) {
            $docType = '';
            $sellerDoc = $order->seller_document ?? '';
            if (strlen($sellerDoc) === 11) {
                $docType = '6'; // RUC
            } elseif (strlen($sellerDoc) === 8) {
                $docType = '1'; // DNI
            }

            $issueDate = $order->issue_date ? date('d/m/Y', strtotime($order->issue_date)) : '';
            $dueDate = $order->due_date ?? $order->payment_date ?? '';
            if ($dueDate) {
                $dueDate = date('d/m/Y', strtotime($dueDate));
            }

            $baseAmount = floatval($order->amount_pen ?? $order->amount ?? 0);
            $igvAmount = floatval($order->igv_amount ?? 0);
            $totalAmount = floatval($order->total_with_igv ?? $baseAmount);

            // Si IGV habilitado pero igv_amount es 0, recalcular
            if ($order->igv_enabled && $igvAmount == 0 && $baseAmount > 0) {
                $igvRate = floatval($order->igv_rate ?? 18);
                $igvAmount = $baseAmount * ($igvRate / 100);
                $totalAmount = $baseAmount + $igvAmount;
            }

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

        // Formateo de columnas numéricas
        $lastRow = $row - 1;
        if ($lastRow >= 2) {
            $sheet->getStyle('I2:M' . $lastRow)->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle('O2:O' . $lastRow)->getNumberFormat()->setFormatCode('#,##0.000');

            $sheet->getStyle('A2:T' . $lastRow)->applyFromArray([
                'borders' => [
                    'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CCCCCC']],
                ],
            ]);
        }
    }
}
