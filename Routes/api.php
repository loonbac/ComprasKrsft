<?php

use Illuminate\Support\Facades\Route;

$moduleName = basename(dirname(__DIR__));
$ctrl = "Modulos_ERP\\{$moduleName}\\Controllers\\CompraController";

// Órdenes de compra
Route::get('/list', "{$ctrl}@list");
Route::get('/pending', "{$ctrl}@pending");
Route::get('/stats', "{$ctrl}@stats");
Route::get('/projects', "{$ctrl}@projects");
Route::get('/sellers', "{$ctrl}@getSellers");
Route::get('/exchange-rate', "{$ctrl}@exchangeRate");
Route::get('/export', "{$ctrl}@exportExcel");
Route::get('/export-paid', "{$ctrl}@exportPaidExcel");
Route::get('/{id}', "{$ctrl}@show")->where('id', '[0-9]+');

// Acciones
Route::put('/{id}/approve', "{$ctrl}@approve")->where('id', '[0-9]+');
Route::put('/{id}/reject', "{$ctrl}@reject")->where('id', '[0-9]+');
Route::post('/approve-bulk', "{$ctrl}@approveBulk");

// Payment confirmation
Route::get('/approved-unpaid', "{$ctrl}@approvedUnpaid");
Route::get('/paid-orders', "{$ctrl}@paidOrders");
Route::post('/{id}/confirm-payment', "{$ctrl}@confirmPayment")->where('id', '[0-9]+');

// New delivery states
Route::get('/in-progress', "{$ctrl}@inProgressOrders");
Route::get('/delivered', "{$ctrl}@deliveredOrders");
Route::post('/{id}/mark-delivered', "{$ctrl}@markDelivered")->where('id', '[0-9]+');

