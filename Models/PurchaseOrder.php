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
        'created_by',
        'approved_by',
        'approved_at',
        'notes'
    ];

    protected $casts = [
        'amount' => 'decimal:2',
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
}
