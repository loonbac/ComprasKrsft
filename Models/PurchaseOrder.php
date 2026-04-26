<?php

namespace Modulos_ERP\ComprasKrsft\Models;

use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    protected $table = 'purchase_orders';

    protected $fillable = [
        'project_id',
        'type',
        'description',
        'materials',
        'unit',
        'item_number',
        'amount',
        'amount_pen',
        'currency',
        'exchange_rate',
        'igv_enabled',
        'igv_rate',
        'igv_amount',
        'total_with_igv',
        'status',
        'source_type',
        'inventory_item_id',
        'reference_price',
        'parent_order_id',
        'batch_id',
        'seller_name',
        'seller_document',
        'payment_type',
        'payment_date',
        'issue_date',
        'due_date',
        'cdp_type',
        'cdp_serie',
        'cdp_number',
        'payment_proof',
        'payment_proof_link',
        'payment_confirmed',
        'payment_confirmed_at',
        'payment_confirmed_by',
        'delivery_confirmed',
        'delivery_confirmed_at',
        'supervisor_approved',
        'supervisor_approved_by',
        'supervisor_approved_at',
        'manager_approved',
        'manager_approved_by',
        'manager_approved_at',
        'created_by',
        'approved_by',
        'approved_at',
        'notes',
        // Cross-flow fields
        'unit_price',
        'qty_purchased',
        'warehouse_status',
        'purchased_at',
        'purchased_by',
        // Cancellation / Nota de Crédito fields
        'cancellation_status',
        'nc_type',
        'nc_serie',
        'nc_number',
        'nc_document',
        'nc_document_link',
        'cancellation_requested_by',
        'cancellation_requested_at',
        'cancelled_by',
        'cancelled_at',
        // Metadata fields (fecha requerida, prioridad, solicitante, cargo)
        'fecha_requerida',
        'prioridad',
        'solicitado_por',
        'cargo',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'amount_pen' => 'decimal:2',
        'igv_amount' => 'decimal:2',
        'total_with_igv' => 'decimal:2',
        'reference_price' => 'decimal:2',
        'unit_price' => 'decimal:4',
        'exchange_rate' => 'decimal:4',
        'igv_rate' => 'decimal:2',
        'materials' => 'array',
        'igv_enabled' => 'boolean',
        'payment_confirmed' => 'boolean',
        'delivery_confirmed' => 'boolean',
        'supervisor_approved' => 'boolean',
        'manager_approved' => 'boolean',
        'approved_at' => 'datetime',
        'payment_confirmed_at' => 'datetime',
        'delivery_confirmed_at' => 'datetime',
        'supervisor_approved_at' => 'datetime',
        'manager_approved_at' => 'datetime',
        'purchased_at' => 'datetime',
        'qty_purchased' => 'integer',
        'cancellation_requested_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'fecha_requerida' => 'date',
    ];

    public function project()
    {
        return $this->belongsTo(\Modulos_ERP\ProyectosKrsft\Models\Project::class, 'project_id');
    }

    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isApproved()
    {
        return $this->status === 'approved';
    }

    public function isCancelled()
    {
        return $this->cancellation_status === 'anulada';
    }

    public function isPendingCancellation()
    {
        return $this->cancellation_status === 'solicitando_anulacion';
    }

    public function isAwaitingCancellationApproval()
    {
        return $this->cancellation_status === 'finalizar_anulacion';
    }

    public function isService()
    {
        return $this->type === 'service';
    }

    public function isMaterial()
    {
        return $this->type === 'material';
    }

    public function isFromInventory()
    {
        return $this->source_type === 'inventory';
    }

    public function isExternal()
    {
        return $this->source_type === 'external' || !$this->source_type;
    }

    public function parentOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'parent_order_id');
    }

    public function splitChildren()
    {
        return $this->hasMany(PurchaseOrder::class, 'parent_order_id');
    }

    // ── Cross-flow helpers ───────────────────────────────────────

    public function isPurchased()
    {
        return $this->status === 'purchased';
    }

    public function isWarehouseIncoming()
    {
        return $this->warehouse_status === 'proximo_a_llegar';
    }

    public function isWarehouseReserved()
    {
        return $this->warehouse_status === 'apartado';
    }

    public function isWarehouseAvailable()
    {
        return $this->warehouse_status === 'disponible';
    }

    public function isMixedSource()
    {
        return $this->source_type === 'mixed';
    }

    /**
     * Obtener la cantidad total de materiales de la orden.
     */
    public function getTotalQuantityAttribute(): int
    {
        $materials = is_array($this->materials) ? $this->materials : [];
        if (!empty($materials)) {
            return array_sum(array_map(fn($m) => intval($m['qty'] ?? 1), $materials));
        }
        return 1;
    }

    /**
     * Precio unitario calculado.
     */
    public function getCalculatedUnitPriceAttribute(): float
    {
        $qty = $this->total_quantity;
        $amount = floatval($this->amount ?? 0);
        return $qty > 0 && $amount > 0 ? round($amount / $qty, 4) : 0;
    }

    public function reservations()
    {
        return $this->hasMany(\Modulos_ERP\ComprasKrsft\Models\InventoryReservation::class, 'purchase_order_id');
    }

    public function priceHistory()
    {
        return $this->hasMany(\Modulos_ERP\ComprasKrsft\Models\MaterialPriceHistory::class, 'purchase_order_id');
    }
}
