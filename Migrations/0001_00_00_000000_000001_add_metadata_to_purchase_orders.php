<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega campos de metadata a purchase_orders para identificar
 * fecha requerida, prioridad, solicitante y cargo.
 * Referencia: compraskrsft/Migrations/0001_00_00_000000_create_compras_tables.php
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Fecha en que se necesita el material/servicio
            $table->date('fecha_requerida')->nullable()->after('delivery_notes');

            // Prioridad de la orden de compra
            $table->enum('prioridad', ['alta', 'media', 'baja'])->nullable()->after('fecha_requerida');

            // Nombre de quien solicita
            $table->string('solicitado_por', 150)->nullable()->after('prioridad');

            // Cargo/Departamento de quien solicita
            $table->string('cargo', 100)->nullable()->after('solicitado_por');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['fecha_requerida', 'prioridad', 'solicitado_por', 'cargo']);
        });
    }
};