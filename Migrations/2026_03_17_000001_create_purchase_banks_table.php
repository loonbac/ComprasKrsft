<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Crea catálogo de bancos para pagos de compras.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchase_banks', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 150)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::table('purchase_banks')->insert([
            ['id' => 1, 'code' => '1011', 'name' => '1011 - CAJA MN', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'code' => '10112', 'name' => '10112 - CAJA CHICA MN - ADMINISTRACION', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'code' => '104103', 'name' => '104103 - BANCO DE CREDITO M.N. 191-2617376-0-40', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'code' => '104104', 'name' => '104104 - BANCO DE CREDITO M.E. 191-2480078-1-01', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'code' => '104105', 'name' => '104105 - BANCO CONTINENTAL M.N. 0201128681', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 6, 'code' => '104106', 'name' => '104106 - BANCO CONTINENTAL M.N. 0100035070', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 7, 'code' => '104107', 'name' => '104107 - BANCO CONTINENTAL M.N. 0201046030', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 8, 'code' => '104108', 'name' => '104108 - BANCO CONTINENTAL M.E. 0100035321', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 9, 'code' => '104109', 'name' => '104109 - BANCO SCOTIABANK M.N. 000-6320600', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 10, 'code' => '104110', 'name' => '104110 - BANCO INTERBANK M.N. 200-3004605533', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 11, 'code' => '104111', 'name' => '104111 - BANCO INTERBANK M.E. 200-3004605540', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 12, 'code' => '104112', 'name' => '104112 - BANCO DE LA NACION 072-050428', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 13, 'code' => '104113', 'name' => '104113 - BANCO INTERAMERICANO DE FINANZAS MN 0070', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_banks');
    }
};
