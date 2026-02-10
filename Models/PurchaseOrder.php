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
        'notes'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'amount_pen' => 'decimal:2',
        'igv_amount' => 'decimal:2',
        'total_with_igv' => 'decimal:2',
        'reference_price' => 'decimal:2',
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
}
