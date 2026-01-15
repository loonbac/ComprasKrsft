<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // IGV fields
            $table->boolean('igv_enabled')->default(false)->after('amount_pen');
            $table->decimal('igv_rate', 5, 2)->default(18.00)->after('igv_enabled');
            $table->decimal('igv_amount', 15, 2)->nullable()->after('igv_rate');
            $table->decimal('total_with_igv', 15, 2)->nullable()->after('igv_amount');
            
            // Payment confirmation fields
            $table->boolean('payment_confirmed')->default(false)->after('notes');
            $table->timestamp('payment_confirmed_at')->nullable()->after('payment_confirmed');
            $table->unsignedBigInteger('payment_confirmed_by')->nullable()->after('payment_confirmed_at');
            $table->string('cdp_type', 10)->nullable()->after('payment_confirmed_by');
            $table->string('cdp_serie', 20)->nullable()->after('cdp_type');
            $table->string('cdp_number', 20)->nullable()->after('cdp_serie');
            $table->string('payment_proof')->nullable()->after('cdp_number');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn([
                'igv_enabled', 'igv_rate', 'igv_amount', 'total_with_igv',
                'payment_confirmed', 'payment_confirmed_at', 'payment_confirmed_by',
                'cdp_type', 'cdp_serie', 'cdp_number', 'payment_proof'
            ]);
        });
    }
};
