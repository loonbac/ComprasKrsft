<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración consolidada del Módulo de Compras (compraskrsft)
 * Consolidó 10 archivos de migración de compraskrsft + 4 de proyectoskrsft que modificaban purchase_orders
 * Generada: 2026-02-19
 */
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Tabla: purchase_orders (órdenes de compra)
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            
            // Relación con proyecto
            $table->unsignedBigInteger('project_id');
            
            // Item number (agregado 2024-01-23)
            $table->unsignedInteger('item_number');
            
            // Tipo y descripción
            $table->enum('type', ['service', 'material'])->default('service');
            $table->string('description');
            
            // Especificaciones de material (agregado 2024-01-21 desde proyectoskrsft)
            $table->string('unit', 20)->nullable();
            $table->string('diameter', 50)->nullable();
            $table->string('series', 100)->nullable();
            $table->string('material_type', 100)->nullable();
            $table->string('manufacturing_standard', 100)->nullable();
            
            // Importación (agregado 2024-01-27 desde proyectoskrsft)
            $table->string('source_filename')->nullable();
            $table->timestamp('imported_at')->nullable();
            
            // Materiales formato JSON (legacy)
            $table->text('materials')->nullable();
            
            // Montos
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('currency', 3)->default('PEN');
            $table->decimal('exchange_rate', 10, 4)->nullable();
            $table->decimal('amount_pen', 15, 2)->nullable();
            
            // IGV (agregado 2024-01-14)
            $table->boolean('igv_enabled')->default(false);
            $table->decimal('igv_rate', 5, 2)->default(18.00);
            $table->decimal('igv_amount', 15, 2)->nullable();
            $table->decimal('total_with_igv', 15, 2)->nullable();
            
            // Estado (ENUM extendido: draft, pending, to_pay, approved, rejected)
            $table->enum('status', ['draft', 'pending', 'to_pay', 'approved', 'rejected'])
                  ->default('draft');
            
            // Aprobaciones de supervisor y manager (agregado 2026-02-02 desde proyectoskrsft)
            $table->boolean('supervisor_approved')->default(false);
            $table->unsignedBigInteger('supervisor_approved_by')->nullable();
            $table->timestamp('supervisor_approved_at')->nullable();
            $table->boolean('manager_approved')->default(false);
            $table->unsignedBigInteger('manager_approved_by')->nullable();
            $table->timestamp('manager_approved_at')->nullable();
            
            // Source type para inventario (agregado 2026-02-09)
            $table->string('source_type', 20)->default('external');
            $table->unsignedBigInteger('inventory_item_id')->nullable();
            $table->decimal('reference_price', 12, 2)->nullable();
            $table->unsignedBigInteger('parent_order_id')->nullable();
            
            // Usuario creador y aprobador
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            
            // Detalles de aprobación (agregado 2024-01-14)
            $table->date('issue_date')->nullable();
            $table->enum('payment_type', ['cash', 'loan'])->nullable();
            $table->date('payment_date')->nullable();
            $table->date('due_date')->nullable();
            $table->string('seller_name')->nullable();
            $table->string('seller_document')->nullable();
            
            // Notas
            $table->text('notes')->nullable();
            
            // Confirmación de pago (agregado 2024-01-14)
            $table->boolean('payment_confirmed')->default(false);
            $table->timestamp('payment_confirmed_at')->nullable();
            $table->unsignedBigInteger('payment_confirmed_by')->nullable();
            
            // Comprobante de pago
            $table->string('cdp_type', 10)->nullable();
            $table->string('cdp_serie', 20)->nullable();
            $table->string('cdp_number', 20)->nullable();
            $table->string('payment_proof')->nullable();
            
            // Batch ID para aprobaciones masivas (agregado 2024-01-20)
            $table->string('batch_id', 50)->nullable();
            
            // Link de comprobante de pago (agregado 2026-02-02)
            $table->string('payment_proof_link')->nullable();
            
            // Confirmación de entrega (agregado 2025-01-27)
            $table->boolean('delivery_confirmed')->default(false);
            $table->timestamp('delivery_confirmed_at')->nullable();
            $table->unsignedBigInteger('delivery_confirmed_by')->nullable();
            $table->text('delivery_notes')->nullable();
            
            $table->timestamps();
            
            // Foreign key
            $table->foreign('project_id')
                  ->references('id')
                  ->on('projects')
                  ->onDelete('cascade');
            
            // Índices (agregados 2026-02-09)
            $table->index('status');
            $table->index('batch_id');
            $table->index('payment_confirmed');
            $table->index(['project_id', 'status']);
            $table->index(['status', 'payment_confirmed']);
            
            // Unique constraint (agregado 2024-01-23)
            $table->unique(['project_id', 'item_number'], 'purchase_orders_project_item_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
