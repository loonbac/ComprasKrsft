<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega campos de edición y verificación contable a purchase_orders
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Tracking de edición de comprobante
            $table->unsignedBigInteger('edited_by')->nullable()->after('payment_proof_link');
            $table->timestamp('edited_at')->nullable()->after('edited_by');

            // Verificación contable (Contasis)
            $table->boolean('contasis_verified')->default(false)->after('edited_at');
            $table->timestamp('contasis_verified_at')->nullable()->after('contasis_verified');
            $table->unsignedBigInteger('contasis_verified_by')->nullable()->after('contasis_verified_at');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'edited_by',
                'edited_at',
                'contasis_verified',
                'contasis_verified_at',
                'contasis_verified_by',
            ]);
        });
    }
};
