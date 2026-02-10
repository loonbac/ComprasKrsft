<?php

use Illuminate\Support\Facades\Route;

$moduleName = basename(dirname(__DIR__));
$ns = "Modulos_ERP\\{$moduleName}\\Controllers";

$compra   = "{$ns}\\CompraController";
$approval = "{$ns}\\ApprovalController";
$payment  = "{$ns}\\PaymentController";
$export   = "{$ns}\\ExportController";

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
Route::get('/approved-unpaid', "{$payment}@approvedUnpaid");
Route::get('/paid-orders', "{$payment}@paidOrders");
Route::get('/delivered-orders', "{$payment}@deliveredOrders");
Route::post('/{id}/confirm-payment', "{$payment}@confirmPayment")->where('id', '[0-9]+');

// ── Exportaciones (ExportController) ────────────────────────────────
Route::get('/export', "{$export}@exportExcel");
Route::get('/export-paid', "{$export}@exportPaidExcel");
