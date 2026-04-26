<?php

namespace Modulos_ERP\ComprasKrsft\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    protected $table = 'suppliers';

    protected $fillable = [
        'name',
        'document',
        'document_type',
        'contact_phone',
        'contact_email',
        'address',
        'notes',
        'active',
    ];

    protected $casts = [
        'active' => 'boolean',
    ];
}
