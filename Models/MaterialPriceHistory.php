<?php

namespace Modulos_ERP\ComprasKrsft\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialPriceHistory extends Model
{
    protected $table = 'material_price_history';

    protected $fillable = [
        'purchase_order_id',
        'inventory_item_id',
        'project_id',
        'material_name',
        'unit',
        'quantity',
        'total_price',
        'unit_price',
        'currency',
        'total_price_pen',
        'unit_price_pen',
        'exchange_rate',
        'supplier_name',
        'supplier_document',
        'source_type',
    ];

    protected $casts = [
        'total_price'     => 'decimal:2',
        'unit_price'      => 'decimal:4',
        'total_price_pen' => 'decimal:2',
        'unit_price_pen'  => 'decimal:4',
        'exchange_rate'   => 'decimal:4',
        'quantity'        => 'integer',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function project()
    {
        return $this->belongsTo(\Modulos_ERP\ProyectosKrsft\Models\Project::class, 'project_id');
    }
}
