<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Add item_number column if it doesn't exist
        if (!Schema::hasColumn('purchase_orders', 'item_number')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->unsignedInteger('item_number')->nullable()->after('project_id');
            });
        }

        // Populate item_number for existing records (by project, ordered by created_at)
        $projects = DB::table('purchase_orders')
            ->select('project_id')
            ->distinct()
            ->pluck('project_id');

        foreach ($projects as $projectId) {
            $orders = DB::table('purchase_orders')
                ->where('project_id', $projectId)
                ->orderBy('created_at', 'asc')
                ->orderBy('id', 'asc')
                ->get(['id']);

            $itemNumber = 1;
            foreach ($orders as $order) {
                DB::table('purchase_orders')
                    ->where('id', $order->id)
                    ->update(['item_number' => $itemNumber]);
                $itemNumber++;
            }
        }

        // Make item_number NOT NULL and add unique constraint per project
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->unsignedInteger('item_number')->nullable(false)->change();
        });

        // Add unique index for project_id + item_number combination
        // This ensures no duplicate item numbers within the same project
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->unique(['project_id', 'item_number'], 'purchase_orders_project_item_unique');
        });
    }

    public function down(): void
    {
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropUnique('purchase_orders_project_item_unique');
            $table->dropColumn('item_number');
        });
    }
};
