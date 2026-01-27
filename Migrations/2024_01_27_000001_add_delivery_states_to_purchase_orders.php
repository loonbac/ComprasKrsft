<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add delivery and storage tracking columns for new order states
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Delivery tracking
            $table->timestamp('delivered_at')->nullable()->after('payment_confirmed_at');
            $table->unsignedBigInteger('delivered_by')->nullable()->after('delivered_at');
            
            // Storage tracking
            $table->timestamp('stored_at')->nullable()->after('delivered_by');
            $table->unsignedBigInteger('stored_by')->nullable()->after('stored_at');
            
            // Delivery notes
            $table->text('delivery_notes')->nullable()->after('stored_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'delivered_at',
                'delivered_by',
                'stored_at',
                'stored_by',
                'delivery_notes'
            ]);
        });
    }
};
