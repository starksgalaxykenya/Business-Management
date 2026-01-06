// js/ui/dashboard.js
import { initCharts } from './charts.js';

export async function initDashboard(app) {
    const content = document.getElementById('content');
    
    // Render dashboard
    content.innerHTML = `
        <div class="space-y-6">
            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-sm font-medium text-gray-500">Today's Revenue</h3>
                            <p id="today-revenue" class="text-2xl font-semibold text-gray-900">Loading...</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                                <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-sm font-medium text-gray-500">Total Debt</h3>
                            <p id="total-debt" class="text-2xl font-semibold text-gray-900">Loading...</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-sm font-medium text-gray-500">Stock Value</h3>
                            <p id="stock-value" class="text-2xl font-semibold text-gray-900">Loading...</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex items-center">
                        <div class="flex-shrink-0">
                            <div class="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                                <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="ml-4">
                            <h3 class="text-sm font-medium text-gray-500">Pending Orders</h3>
                            <p id="pending-orders" class="text-2xl font-semibold text-gray-900">0</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Charts Section -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Profit & Loss (Last 30 Days)</h3>
                    <canvas id="pl-chart" height="250"></canvas>
                </div>
                <div class="bg-white rounded-lg shadow p-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Sales Trends</h3>
                    <canvas id="sales-chart" height="250"></canvas>
                </div>
            </div>
            
            <!-- Low Stock Alerts -->
            <div class="bg-white rounded-lg shadow">
                <div class="px-6 py-4 border-b">
                    <h3 class="text-lg font-semibold text-gray-800">Low Stock Alerts</h3>
                </div>
                <div id="low-stock-list" class="p-6">
                    <div class="text-center text-gray-500">Loading alerts...</div>
                </div>
            </div>
        </div>
    `;
    
    // Load dashboard data
    await loadDashboardData(app);
    
    // Initialize charts
    initCharts(app);
    
    // Listen for updates
    document.addEventListener('dashboardUpdate', (e) => {
        if (e.detail.stockValue !== undefined) {
            document.getElementById('stock-value').textContent = 
                app.utils.formatCurrency(e.detail.stockValue);
        }
    });
}

async function loadDashboardData(app) {
    try {
        // Load today's revenue
        const today = new Date().toISOString().split('T')[0];
        const salesSnapshot = await app.db.collection('sales')
            .where('date', '>=', today)
            .get();
        
        const todayRevenue = salesSnapshot.docs.reduce((total, doc) => {
            return total + (doc.data().total || 0);
        }, 0);
        
        document.getElementById('today-revenue').textContent = 
            app.utils.formatCurrency(todayRevenue);
        
        // Load total debt
        const debtorsSnapshot = await app.db.collection('debtors').get();
        const totalDebt = debtorsSnapshot.docs.reduce((total, doc) => {
            return total + (doc.data().balance || 0);
        }, 0);
        
        document.getElementById('total-debt').textContent = 
            app.utils.formatCurrency(totalDebt);
        
        // Load low stock products
        const lowStockProducts = app.modules.products?.lowStockProducts || [];
        const lowStockList = document.getElementById('low-stock-list');
        
        if (lowStockProducts.length > 0) {
            lowStockList.innerHTML = `
                <div class="space-y-4">
                    ${lowStockProducts.map(product => `
                        <div class="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                            <div>
                                <h4 class="font-medium text-gray-900">${product.name}</h4>
                                <p class="text-sm text-gray-600">SKU: ${product.sku}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-sm text-red-600 font-medium">Stock: ${product.stock}</p>
                                <p class="text-xs text-gray-500">Reorder level: ${product.reorderLevel || app.settings.lowStockThreshold}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            lowStockList.innerHTML = `
                <div class="text-center text-green-600 py-8">
                    <svg class="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p>All products are sufficiently stocked</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        
        // Show error states
        document.getElementById('today-revenue').textContent = 'Error';
        document.getElementById('total-debt').textContent = 'Error';
        document.getElementById('stock-value').textContent = 'Error';
    }
}
