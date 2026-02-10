<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Tipo de origen: 'external' (compra normal) o 'inventory' (del almacén)
            $table->string('source_type', 20)->default('external')->after('status');
            // FK al item de inventario cuando source_type = 'inventory'
            $table->unsignedBigInteger('inventory_item_id')->nullable()->after('source_type');
            // Precio de referencia para imputar al proyecto (items de inventario)
            $table->decimal('reference_price', 12, 2)->nullable()->after('inventory_item_id');
            // ID de la orden original antes del split (para trazabilidad)
            $table->unsignedBigInteger('parent_order_id')->nullable()->after('reference_price');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['source_type', 'inventory_item_id', 'reference_price', 'parent_order_id']);
        });
    }
};
