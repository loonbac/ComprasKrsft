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
        'amount',
        'status',
        'source_type',
        'inventory_item_id',
        'reference_price',
        'parent_order_id',
        'created_by',
        'approved_by',
        'approved_at',
        'notes'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'reference_price' => 'decimal:2',
        'materials' => 'array',
        'approved_at' => 'datetime'
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
