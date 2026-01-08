<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('purchase_orders')) {
            Schema::create('purchase_orders', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('project_id');
                $table->enum('type', ['service', 'material'])->default('service');
                $table->string('description');
                $table->text('materials')->nullable();
                $table->decimal('amount', 15, 2)->nullable();
                $table->string('currency', 3)->default('PEN');
                $table->decimal('exchange_rate', 10, 4)->nullable();
                $table->decimal('amount_pen', 15, 2)->nullable();
                $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
                $table->unsignedBigInteger('created_by')->nullable();
                $table->unsignedBigInteger('approved_by')->nullable();
                $table->timestamp('approved_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                
                $table->foreign('project_id')
                      ->references('id')
                      ->on('projects')
                      ->onDelete('cascade');
            });
        } else {
            // Add missing columns if table exists
            Schema::table('purchase_orders', function (Blueprint $table) {
                if (!Schema::hasColumn('purchase_orders', 'currency')) {
                    $table->string('currency', 3)->default('PEN')->after('amount');
                }
                if (!Schema::hasColumn('purchase_orders', 'exchange_rate')) {
                    $table->decimal('exchange_rate', 10, 4)->nullable()->after('currency');
                }
                if (!Schema::hasColumn('purchase_orders', 'amount_pen')) {
                    $table->decimal('amount_pen', 15, 2)->nullable()->after('exchange_rate');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
