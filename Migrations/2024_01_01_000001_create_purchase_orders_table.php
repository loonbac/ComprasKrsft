<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->enum('type', ['service', 'material'])->default('service');
            $table->string('description');
            $table->text('materials')->nullable(); // JSON para lista de materiales
            $table->decimal('amount', 15, 2)->nullable(); // Monto original
            $table->enum('currency', ['PEN', 'USD'])->default('PEN');
            $table->decimal('exchange_rate', 10, 4)->nullable(); // Tipo de cambio si es USD
            $table->decimal('amount_pen', 15, 2)->nullable(); // Monto convertido a soles
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
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
