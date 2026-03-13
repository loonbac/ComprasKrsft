<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega campos para la funcionalidad de anulación de facturas
 * con Nota de Crédito en el módulo de Compras.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Estado de anulación: solicitando_anulacion, finalizar_anulacion, anulada
            $table->string('cancellation_status', 30)->nullable()->after('status');

            // Datos de la Nota de Crédito
            $table->string('nc_type', 10)->nullable()->after('cancellation_status');
            $table->string('nc_serie', 20)->nullable()->after('nc_type');
            $table->string('nc_number', 20)->nullable()->after('nc_serie');
            $table->string('nc_document', 500)->nullable()->after('nc_number');
            $table->string('nc_document_link', 2048)->nullable()->after('nc_document');

            // Auditoría de anulación
            $table->unsignedBigInteger('cancellation_requested_by')->nullable()->after('nc_document_link');
            $table->timestamp('cancellation_requested_at')->nullable()->after('cancellation_requested_by');
            $table->unsignedBigInteger('cancelled_by')->nullable()->after('cancellation_requested_at');
            $table->timestamp('cancelled_at')->nullable()->after('cancelled_by');

            // Índice para consultas por estado de anulación
            $table->index('cancellation_status');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['cancellation_status']);
            $table->dropColumn([
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
            ]);
        });
    }
};
