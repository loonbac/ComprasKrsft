<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega columnas de extensión de crédito a purchase_orders.
 * Permite registrar quién y cuándo extendió el plazo de vencimiento de un crédito.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Fecha original de vencimiento (antes de la extensión)
            $table->date('original_due_date')->nullable()->after('due_date');
            // Usuario que extendió el crédito
            $table->unsignedBigInteger('credit_extended_by')->nullable()->after('original_due_date');
            // Timestamp de la extensión
            $table->timestamp('credit_extended_at')->nullable()->after('credit_extended_by');
            // Nombre del usuario que extendió (desnormalizado para consultas rápidas)
            $table->string('credit_extended_by_name')->nullable()->after('credit_extended_at');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'original_due_date',
                'credit_extended_by',
                'credit_extended_at',
                'credit_extended_by_name',
            ]);
        });
    }
};
