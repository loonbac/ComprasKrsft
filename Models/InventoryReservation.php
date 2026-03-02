<?php

namespace Modulos_ERP\ComprasKrsft\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryReservation extends Model
{
    protected $table = 'inventory_reservations';

    protected $fillable = [
        'inventory_item_id',
        'project_id',
        'purchase_order_id',
        'quantity_reserved',
        'unit_price_at_reservation',
        'total_cost',
        'currency',
        'status',
        'reserved_by',
        'released_by',
        'released_at',
        'notes',
    ];

    protected $casts = [
        'unit_price_at_reservation' => 'decimal:4',
        'total_cost'                => 'decimal:2',
        'quantity_reserved'         => 'integer',
        'released_at'               => 'datetime',
    ];

    public function inventoryItem()
    {
        return $this->belongsTo(\Modulos_ERP\InventarioKrsft\Models\Producto::class, 'inventory_item_id');
    }

    public function project()
    {
        return $this->belongsTo(\Modulos_ERP\ProyectosKrsft\Models\Project::class, 'project_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isReleased(): bool
    {
        return $this->status === 'released';
    }
}
