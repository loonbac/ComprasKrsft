<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->date('issue_date')->nullable()->after('approved_at');
            $table->enum('payment_type', ['cash', 'loan'])->nullable()->after('issue_date');
            $table->date('payment_date')->nullable()->after('payment_type');
            $table->date('due_date')->nullable()->after('payment_date');
            $table->string('seller_name')->nullable()->after('due_date');
            $table->string('seller_document')->nullable()->after('seller_name');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn(['issue_date', 'payment_type', 'payment_date', 'due_date', 'seller_name', 'seller_document']);
        });
    }
};
