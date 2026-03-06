<?php

use Illuminate\Support\Facades\Route;

$moduleName = basename(dirname(__DIR__));
$ns = "Modulos_ERP\\{$moduleName}\\Controllers";

$compra    = "{$ns}\\CompraController";
$approval  = "{$ns}\\ApprovalController";
$payment   = "{$ns}\\PaymentController";
$export    = "{$ns}\\ExportController";
$supplier  = "{$ns}\\SupplierController";
$crossFlow = "{$ns}\\CrossFlowController";

// ── Consultas generales (CompraController) ──────────────────────────
Route::get('/list', "{$compra}@list");
Route::get('/pending', "{$compra}@pending");
Route::get('/to-pay', "{$compra}@toPayOrders");
Route::get('/stats', "{$compra}@stats");
Route::get('/projects', "{$compra}@projects");
Route::get('/sellers', "{$compra}@getSellers");
Route::get('/exchange-rate', "{$compra}@exchangeRate");
Route::get('/search-inventory', "{$compra}@searchInventory");
Route::get('/{id}', "{$compra}@show")->where('id', '[0-9]+');

// ── Aprobación (ApprovalController) ─────────────────────────────────
Route::put('/{id}/approve', "{$approval}@approve")->where('id', '[0-9]+');
Route::put('/{id}/reject', "{$approval}@reject")->where('id', '[0-9]+');
Route::put('/{id}/mark-to-pay', "{$approval}@markToPay")->where('id', '[0-9]+');
Route::post('/mark-to-pay-bulk', "{$approval}@markToPayBulk");
Route::post('/approve-bulk', "{$approval}@approveBulk");

// ── Pagos (PaymentController) ───────────────────────────────────────
Route::post('/pay-bulk', "{$payment}@payBulk");
Route::post('/pay-batch', "{$payment}@payBatch");
Route::post('/update-comprobante', "{$payment}@updateComprobante");
Route::post('/quick-pay', "{$payment}@quickPay");
Route::put('/extend-credit', "{$payment}@extendCredit");
Route::get('/approved-unpaid', "{$payment}@approvedUnpaid");
Route::get('/paid-orders', "{$payment}@paidOrders");
Route::get('/delivered-orders', "{$payment}@deliveredOrders");
Route::post('/{id}/confirm-payment', "{$payment}@confirmPayment")->where('id', '[0-9]+');

// ── Exportaciones (ExportController) ────────────────────────────────
Route::get('/export', "{$export}@exportExcel");
Route::get('/export-paid', "{$export}@exportPaidExcel");

// ── Proveedores (SupplierController) ────────────────────────────────
Route::get('/suppliers', "{$supplier}@index");
Route::post('/suppliers', "{$supplier}@store");
Route::get('/suppliers/search', "{$supplier}@search");
Route::get('/suppliers/with-spending', "{$supplier}@indexWithSpending");
Route::get('/suppliers/{id}', "{$supplier}@show")->where('id', '[0-9]+');
Route::put('/suppliers/{id}', "{$supplier}@update")->where('id', '[0-9]+');
Route::delete('/suppliers/{id}', "{$supplier}@destroy")->where('id', '[0-9]+');

// ── Flujo Transversal Proyectos-Compras-Almacén (CrossFlowController) ───
Route::post('/cross-flow/mark-purchased/{id}', "{$crossFlow}@markPurchased")->where('id', '[0-9]+');
Route::post('/cross-flow/confirm-receipt/{id}', "{$crossFlow}@confirmReceipt")->where('id', '[0-9]+');
Route::post('/cross-flow/finalize-project/{id}', "{$crossFlow}@finalizeProject")->where('id', '[0-9]+');
Route::get('/cross-flow/available-stock', "{$crossFlow}@availableStock");
Route::post('/cross-flow/preview-mixed', "{$crossFlow}@previewMixed");
Route::post('/cross-flow/process-mixed', "{$crossFlow}@processMixed");
Route::get('/cross-flow/incoming-materials', "{$crossFlow}@incomingMaterials");
Route::get('/cross-flow/price-history', "{$crossFlow}@priceHistory");
