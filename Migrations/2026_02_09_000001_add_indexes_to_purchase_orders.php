<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            // Performance indexes for most-queried columns
            if (!$this->hasIndex('purchase_orders', 'purchase_orders_status_index')) {
                $table->index('status');
            }
            if (!$this->hasIndex('purchase_orders', 'purchase_orders_batch_id_index')) {
                $table->index('batch_id');
            }
            if (!$this->hasIndex('purchase_orders', 'purchase_orders_payment_confirmed_index')) {
                $table->index('payment_confirmed');
            }
            if (!$this->hasIndex('purchase_orders', 'purchase_orders_project_id_status_index')) {
                $table->index(['project_id', 'status']);
            }
            if (!$this->hasIndex('purchase_orders', 'purchase_orders_status_payment_index')) {
                $table->index(['status', 'payment_confirmed']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropIndex(['batch_id']);
            $table->dropIndex(['payment_confirmed']);
            $table->dropIndex(['project_id', 'status']);
            $table->dropIndex(['status', 'payment_confirmed']);
        });
    }

    /**
     * Check if an index exists on a table
     */
    private function hasIndex(string $table, string $indexName): bool
    {
        $indexes = Schema::getIndexes($table);
        foreach ($indexes as $index) {
            if ($index['name'] === $indexName) {
                return true;
            }
        }
        return false;
    }
};
