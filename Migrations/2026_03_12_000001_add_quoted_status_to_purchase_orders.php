<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Modify ENUM to include 'quoted' between 'pending' and 'to_pay'
        DB::statement("ALTER TABLE purchase_orders MODIFY COLUMN status ENUM('draft','pending','quoted','to_pay','approved','rejected') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        // Revert ENUM — move any 'quoted' orders back to 'pending' first
        DB::table('purchase_orders')->where('status', 'quoted')->update(['status' => 'pending']);
        DB::statement("ALTER TABLE purchase_orders MODIFY COLUMN status ENUM('draft','pending','to_pay','approved','rejected') NOT NULL DEFAULT 'pending'");
    }
};
