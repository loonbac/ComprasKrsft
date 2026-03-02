<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla de proveedores del módulo de compras.
 * Almacena automáticamente los datos del proveedor al aprobar una compra.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // Nombre o Razón Social
            $table->string('document', 20)->nullable();      // RUC / DNI
            $table->string('document_type', 10)->default('RUC'); // RUC, DNI
            $table->string('contact_phone', 30)->nullable();
            $table->string('contact_email', 100)->nullable();
            $table->text('address')->nullable();
            $table->text('notes')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique('document');
            $table->index('name');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
