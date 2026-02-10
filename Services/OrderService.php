<?php

namespace Modulos_ERP\ComprasKrsft\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OrderService
{
    protected string $ordersTable = 'purchase_orders';
    protected string $projectsTable = 'projects';

    /**
     * Generar batch ID con prefijo
     */
    public function generateBatchId(string $prefix = 'BATCH'): string
    {
        return $prefix . '-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6));
    }

    /**
     * Construir datos compartidos para operaciones bulk
     */
    public function buildSharedData(Request $request, ?float $exchangeRate, string $batchId, array $extraFields = []): array
    {
        $data = [
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'batch_id' => $batchId,
            'currency' => $request->input('currency'),
            'exchange_rate' => $exchangeRate,
            'seller_name' => $request->input('seller_name'),
            'seller_document' => $request->input('seller_document'),
            'payment_type' => $request->input('payment_type', 'cash'),
            'issue_date' => $request->input('issue_date'),
            'due_date' => $request->input('due_date'),
            'igv_enabled' => $request->boolean('igv_enabled', false),
            'igv_rate' => floatval($request->input('igv_rate', 18.00)),
            'updated_at' => now(),
        ];

        // Manejo condicional de fechas según tipo de pago
        if ($request->has('payment_type')) {
            $data['payment_date'] = $request->input('payment_type') === 'cash'
                ? $request->input('payment_date')
                : null;
            $data['due_date'] = $request->input('payment_type') === 'loan'
                ? $request->input('due_date')
                : null;
        }

        if ($request->has('notes')) {
            $data['notes'] = $request->input('notes');
        }

        return array_merge($data, $extraFields);
    }

    /**
     * Calcular montos para una orden individual en operación bulk
     */
    public function calculateAmounts(
        float $amount,
        string $currency,
        ?float $exchangeRate,
        bool $igvEnabled,
        float $igvRate
    ): array {
        $amountPen = ($currency === 'USD' && $exchangeRate)
            ? $amount * $exchangeRate
            : $amount;

        $igvAmount = $igvEnabled ? $amountPen * ($igvRate / 100) : 0;
        $totalWithIgv = $amountPen + $igvAmount;

        return [
            'amount_pen' => $amountPen,
            'igv_amount' => $igvAmount,
            'total_with_igv' => $totalWithIgv,
        ];
    }

    /**
     * Verificar que todas las órdenes tengan un estado específico
     */
    public function verifyOrdersStatus(array $orderIds, string $expectedStatus): bool
    {
        $count = DB::table($this->ordersTable)
            ->whereIn('id', $orderIds)
            ->where('status', $expectedStatus)
            ->count();

        return $count === count($orderIds);
    }

    /**
     * Obtener orden con nombre del proyecto
     */
    public function getOrderWithProject(int $orderId): ?object
    {
        return DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select('purchase_orders.*', 'projects.name as project_name')
            ->where('purchase_orders.id', $orderId)
            ->first();
    }

    /**
     * Obtener múltiples órdenes con nombre del proyecto
     */
    public function getOrdersWithProject(array $orderIds): \Illuminate\Support\Collection
    {
        return DB::table($this->ordersTable)
            ->join($this->projectsTable, 'purchase_orders.project_id', '=', 'projects.id')
            ->select('purchase_orders.*', 'projects.name as project_name')
            ->whereIn('purchase_orders.id', $orderIds)
            ->get();
    }

    /**
     * Decodificar materials JSON y mapear colección de órdenes
     */
    public function mapOrderMaterials(\Illuminate\Support\Collection $orders): \Illuminate\Support\Collection
    {
        return $orders->map(function ($order) {
            $order->materials = $order->materials ? json_decode($order->materials, true) : [];
            return $order;
        });
    }

    /**
     * Manejar subida de comprobante de pago
     */
    public function handlePaymentProof(Request $request, string $identifier): ?string
    {
        if ($request->hasFile('payment_proof')) {
            $file = $request->file('payment_proof');
            $filename = 'proof_' . $identifier . '_' . time() . '.' . $file->getClientOriginalExtension();
            return $file->storeAs('payment_proofs', $filename, 'public');
        }
        return null;
    }
}
