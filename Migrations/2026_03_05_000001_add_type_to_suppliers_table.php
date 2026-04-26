<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('type', 20)->default('normal')->after('name');
        });

        // Proveedores de servicios
        $serviceSuppliers = [
            'INGSERGEL SAC',
            'SAFE SAFFOLDING ENGINEERING SAC',
            'LUCIANA MAQ. SAC',
            'CRISOSTOMO LINEREZ GAUDENCIO ALEJANDO',
            'TAME VILCA EMER',
            'BOTICAS IP SAC',
            'MEDICENTRO LOS OLIVOS SAC',
            'GRUPO BEA SAC',
            'GALVEZ RISSO ZEGARRA',
            'ESTRUCTURAS METALICAS ATLAS SAC',
            'NIBIRU SERVICIOS GENERALES SAC',
            'TECNO FAST SAC',
            'OPERADOR LOGISTICO TALMAQ PERU SAC',
            'CERTIFICACIONES Y CALIBRACIONES SAC',
            'INSPECTORATE SERVICES PERU SAC',
            'JLAM SRL',
            'PLOTTER TECH SAC',
            'PREVENTIVA PERU',
            'TERRAVIAS EIRL',
            'TEST Y CONTROL',
            'RA PERU',
        ];

        DB::table('suppliers')
            ->whereIn('name', $serviceSuppliers)
            ->update(['type' => 'servicios']);
            
        // Los demas se quedan en normal por defecto.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropColumn('type');
        });
    }
};
