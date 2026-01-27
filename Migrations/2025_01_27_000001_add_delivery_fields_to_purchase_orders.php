<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds delivery tracking fields to purchase_orders table
     */
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Delivery confirmation fields
            $table->boolean('delivery_confirmed')->default(false)->after('payment_confirmed');
            $table->timestamp('delivery_confirmed_at')->nullable()->after('delivery_confirmed');
            $table->unsignedBigInteger('delivery_confirmed_by')->nullable()->after('delivery_confirmed_at');
            $table->text('delivery_notes')->nullable()->after('delivery_confirmed_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_confirmed',
                'delivery_confirmed_at',
                'delivery_confirmed_by',
                'delivery_notes'
            ]);
        });
    }
};
