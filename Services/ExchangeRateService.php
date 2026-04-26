<?php

namespace Modulos_ERP\ComprasKrsft\Services;

use Illuminate\Support\Facades\Log;

class ExchangeRateService
{
    /**
     * Obtener tipo de cambio USD -> PEN desde SUNAT (API decolecta)
     */
    public function getRate(?string $date = null): ?float
    {
        try {
            $envPath = dirname(__DIR__) . '/.env';
            $envContent = file_exists($envPath) ? parse_ini_file($envPath) : [];
            $apiKey = $envContent['DECOLECTA_API_KEY'] ?? '';

            if (empty($apiKey)) {
                Log::warning('DECOLECTA_API_KEY no configurada en ' . $envPath);
                return null;
            }

            $url = 'https://api.decolecta.com/v1/tipo-cambio/sunat';
            if ($date) {
                $url .= '?date=' . $date;
            }

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $apiKey,
            ]);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($httpCode === 200 && $response) {
                $data = json_decode($response, true);
                return floatval($data['sell_price'] ?? 0);
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Error getting exchange rate: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Obtener tipo de cambio o lanzar error JSON si falla (para uso en controllers)
     */
    public function getRequiredRate(): float
    {
        $rate = $this->getRate();
        if (!$rate) {
            abort(400, 'No se pudo obtener el tipo de cambio');
        }
        return $rate;
    }

    /**
     * Convertir monto a PEN
     */
    public function convertToPen(float $amount, string $currency, ?float $exchangeRate = null): float
    {
        if ($currency === 'USD' && $exchangeRate) {
            return $amount * $exchangeRate;
        }
        return $amount;
    }

    /**
     * Calcular IGV
     */
    public function calculateIgv(float $basePen, bool $igvEnabled, float $igvRate = 18.0): array
    {
        $igvAmount = $igvEnabled ? $basePen * ($igvRate / 100) : 0;
        $totalWithIgv = $igvEnabled ? ($basePen + $igvAmount) : $basePen;

        return [
            'igv_amount' => $igvAmount,
            'total_with_igv' => $totalWithIgv,
        ];
    }
}
