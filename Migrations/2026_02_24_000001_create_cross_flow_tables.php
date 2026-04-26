<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Migración para el flujo transversal Proyectos-Compras-Almacén.
 *
 * Agrega:
 * 1. Nuevos estados a purchase_orders (purchased, delivered)
 * 2. Tabla material_price_history — historial de precios por material
 * 3. Tabla inventory_reservations — reservas de inventario para proyectos
 * 4. Columnas extra en inventario (precio_unitario, estado_flujo)
 * 5. Columnas extra en purchase_orders para trazabilidad
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── 1. Extender purchase_orders ─────────────────────────────────
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Estado extendido para flujo completo:
            //   draft -> pending -> to_pay -> purchased -> delivered -> approved
            // Ya maneja via ENUM: draft, pending, to_pay, approved, rejected
            // Se necesita cambiar ENUM → string para soportar más estados
        });

        // Cambiar columna status de ENUM a VARCHAR para soportar estados adicionales
        if (Schema::hasColumn('purchase_orders', 'status')) {
            \DB::statement("ALTER TABLE purchase_orders MODIFY COLUMN status VARCHAR(30) DEFAULT 'draft'");
        }

        Schema::table('purchase_orders', function (Blueprint $table) {
            // Precio unitario calculado (total / cantidad)
            if (!Schema::hasColumn('purchase_orders', 'unit_price')) {
                $table->decimal('unit_price', 12, 4)->nullable()->after('amount_pen');
            }
            // Cantidad comprada (para cálculo de precio unitario)
            if (!Schema::hasColumn('purchase_orders', 'qty_purchased')) {
                $table->integer('qty_purchased')->nullable()->after('unit_price');
            }
            // Tracking de flujo cross-module
            if (!Schema::hasColumn('purchase_orders', 'warehouse_status')) {
                $table->string('warehouse_status', 30)->nullable()
                    ->comment('proximo_a_llegar, apartado, disponible')
                    ->after('delivery_confirmed_by');
            }
            // Fecha en que se marcó como comprado
            if (!Schema::hasColumn('purchase_orders', 'purchased_at')) {
                $table->timestamp('purchased_at')->nullable()->after('warehouse_status');
            }
            if (!Schema::hasColumn('purchase_orders', 'purchased_by')) {
                $table->unsignedBigInteger('purchased_by')->nullable()->after('purchased_at');
            }
        });

        // ── 2. Historial de precios de materiales ───────────────────────
        Schema::create('material_price_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_order_id');
            $table->unsignedBigInteger('inventory_item_id')->nullable();
            $table->unsignedBigInteger('project_id');

            // Datos del material
            $table->string('material_name');
            $table->string('unit', 20)->default('UND');
            $table->integer('quantity');

            // Precios
            $table->decimal('total_price', 15, 2);
            $table->decimal('unit_price', 12, 4);
            $table->string('currency', 3)->default('PEN');
            $table->decimal('total_price_pen', 15, 2)->nullable();
            $table->decimal('unit_price_pen', 12, 4)->nullable();
            $table->decimal('exchange_rate', 10, 4)->nullable();

            // Proveedor
            $table->string('supplier_name')->nullable();
            $table->string('supplier_document')->nullable();

            // Origen
            $table->string('source_type', 20)->default('purchase')
                ->comment('purchase, inventory, mixed');

            $table->timestamps();

            $table->foreign('purchase_order_id')
                ->references('id')->on('purchase_orders')
                ->onDelete('cascade');
            $table->foreign('project_id')
                ->references('id')->on('projects')
                ->onDelete('cascade');

            $table->index(['material_name', 'unit']);
            $table->index('project_id');
            $table->index('inventory_item_id');
        });

        // ── 3. Reservas de inventario ───────────────────────────────────
        Schema::create('inventory_reservations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('inventory_item_id');
            $table->unsignedBigInteger('project_id');
            $table->unsignedBigInteger('purchase_order_id')->nullable();

            $table->integer('quantity_reserved');
            $table->decimal('unit_price_at_reservation', 12, 4);
            $table->decimal('total_cost', 15, 2);
            $table->string('currency', 3)->default('PEN');

            // Estado de la reserva
            $table->enum('status', ['active', 'consumed', 'released'])
                ->default('active')
                ->comment('active=apartado, consumed=usado, released=devuelto a disponible');

            $table->unsignedBigInteger('reserved_by')->nullable();
            $table->unsignedBigInteger('released_by')->nullable();
            $table->timestamp('released_at')->nullable();
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->foreign('inventory_item_id')
                ->references('id')->on('inventario_productos')
                ->onDelete('cascade');
            $table->foreign('project_id')
                ->references('id')->on('projects')
                ->onDelete('cascade');

            $table->index(['inventory_item_id', 'status']);
            $table->index(['project_id', 'status']);
        });

        // ── 4. Campos extra en inventario ───────────────────────────────
        Schema::table('inventario_productos', function (Blueprint $table) {
            if (!Schema::hasColumn('inventario_productos', 'precio_unitario')) {
                $table->decimal('precio_unitario', 12, 4)->nullable()
                    ->comment('Precio Total / Cantidad = costo unitario')
                    ->after('precio');
            }
            if (!Schema::hasColumn('inventario_productos', 'estado_flujo')) {
                $table->string('estado_flujo', 30)->default('disponible')
                    ->comment('proximo_a_llegar, apartado, disponible')
                    ->after('estado');
            }
            if (!Schema::hasColumn('inventario_productos', 'purchase_order_id')) {
                $table->unsignedBigInteger('purchase_order_id')->nullable()
                    ->comment('Orden de compra de origen')
                    ->after('project_id');
            }
            if (!Schema::hasColumn('inventario_productos', 'cantidad_reservada')) {
                $table->integer('cantidad_reservada')->default(0)
                    ->comment('Unidades apartadas para proyectos')
                    ->after('cantidad');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventory_reservations');
        Schema::dropIfExists('material_price_history');

        Schema::table('purchase_orders', function (Blueprint $table) {
            $cols = ['unit_price', 'qty_purchased', 'warehouse_status', 'purchased_at', 'purchased_by'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('purchase_orders', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('inventario_productos', function (Blueprint $table) {
            $cols = ['precio_unitario', 'estado_flujo', 'purchase_order_id', 'cantidad_reservada'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('inventario_productos', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        // Revertir status a ENUM
        if (Schema::hasColumn('purchase_orders', 'status')) {
            \DB::statement("ALTER TABLE purchase_orders MODIFY COLUMN status ENUM('draft','pending','to_pay','approved','rejected') DEFAULT 'draft'");
        }
    }
};
