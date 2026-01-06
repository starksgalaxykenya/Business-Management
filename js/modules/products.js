// js/modules/products.js
export default class ProductManager {
    constructor(app) {
        this.app = app;
        this.products = [];
        this.lowStockProducts = [];
        this.init();
    }
    
    async init() {
        // Load products from Firebase
        await this.loadProducts();
        
        // Set up real-time listener for stock changes
        this.setupStockListener();
    }
    
    async loadProducts() {
        try {
            const snapshot = await this.app.db.collection('products').get();
            this.products = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.checkLowStock();
            
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }
    
    setupStockListener() {
        this.app.db.collection('products')
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const product = { id: change.doc.id, ...change.doc.data() };
                    
                    if (change.type === 'modified') {
                        const index = this.products.findIndex(p => p.id === product.id);
                        if (index !== -1) {
                            this.products[index] = product;
                        }
                    } else if (change.type === 'added') {
                        this.products.push(product);
                    } else if (change.type === 'removed') {
                        this.products = this.products.filter(p => p.id !== product.id);
                    }
                });
                
                this.checkLowStock();
                this.updateDashboard();
            });
    }
    
    checkLowStock() {
        this.lowStockProducts = this.products.filter(product => 
            product.stock <= this.app.settings.lowStockThreshold
        );
        
        // Show notification if low stock
        if (this.lowStockProducts.length > 0) {
            this.showLowStockNotification();
        }
    }
    
    async createProduct(productData) {
        try {
            // Validate product data
            if (!this.validateProduct(productData)) {
                throw new Error('Invalid product data');
            }
            
            // Generate SKU if not provided
            if (!productData.sku) {
                productData.sku = this.generateSKU(productData.name);
            }
            
            // Add audit trail
            productData.createdAt = new Date().toISOString();
            productData.createdBy = this.app.auth.currentUser?.uid || 'system';
            
            // Add to Firebase
            const docRef = await this.app.db.collection('products').add(productData);
            
            // Log audit trail
            await this.app.modules.audit.log({
                action: 'PRODUCT_CREATED',
                entity: 'product',
                entityId: docRef.id,
                details: productData,
                timestamp: new Date().toISOString(),
                user: this.app.auth.currentUser?.email || 'system'
            });
            
            this.app.showSuccess('Product created successfully');
            return docRef.id;
            
        } catch (error) {
            console.error('Error creating product:', error);
            this.app.showError('Failed to create product');
            throw error;
        }
    }
    
    async updateProduct(productId, updates) {
        try {
            // Prevent stock manipulation without audit
            if ('stock' in updates) {
                await this.updateStockWithAudit(productId, updates.stock);
                delete updates.stock;
            }
            
            if (Object.keys(updates).length > 0) {
                updates.updatedAt = new Date().toISOString();
                await this.app.db.collection('products').doc(productId).update(updates);
                
                await this.app.modules.audit.log({
                    action: 'PRODUCT_UPDATED',
                    entity: 'product',
                    entityId: productId,
                    details: updates,
                    timestamp: new Date().toISOString(),
                    user: this.app.auth.currentUser?.email || 'system'
                });
            }
            
            this.app.showSuccess('Product updated successfully');
            
        } catch (error) {
            console.error('Error updating product:', error);
            this.app.showError('Failed to update product');
            throw error;
        }
    }
    
    async updateStockWithAudit(productId, newStock) {
        const productRef = this.app.db.collection('products').doc(productId);
        const productDoc = await productRef.get();
        const oldStock = productDoc.data().stock;
        
        // Update stock
        await productRef.update({ stock: newStock });
        
        // Log stock change
        await this.app.modules.audit.log({
            action: 'STOCK_ADJUSTED',
            entity: 'product',
            entityId: productId,
            details: {
                oldStock,
                newStock,
                difference: newStock - oldStock
            },
            timestamp: new Date().toISOString(),
            user: this.app.auth.currentUser?.email || 'system'
        });
    }
    
    async sellProduct(productId, quantity, saleId) {
        try {
            const productRef = this.app.db.collection('products').doc(productId);
            
            // Use transaction to ensure atomic update
            await this.app.db.runTransaction(async (transaction) => {
                const productDoc = await transaction.get(productRef);
                
                if (!productDoc.exists) {
                    throw new Error('Product not found');
                }
                
                const product = productDoc.data();
                
                if (product.stock < quantity) {
                    throw new Error('Insufficient stock');
                }
                
                // Update stock
                const newStock = product.stock - quantity;
                transaction.update(productRef, { stock: newStock });
                
                // Log the sale in audit trail
                return this.app.modules.audit.log({
                    action: 'STOCK_SOLD',
                    entity: 'product',
                    entityId: productId,
                    details: {
                        saleId,
                        quantity,
                        price: product.price,
                        oldStock: product.stock,
                        newStock
                    },
                    timestamp: new Date().toISOString(),
                    user: this.app.auth.currentUser?.email || 'system'
                });
            });
            
        } catch (error) {
            console.error('Error selling product:', error);
            throw error;
        }
    }
    
    validateProduct(product) {
        const requiredFields = ['name', 'cost', 'price'];
        return requiredFields.every(field => product[field] !== undefined && product[field] !== '');
    }
    
    generateSKU(name) {
        const prefix = name.substring(0, 3).toUpperCase();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const timestamp = Date.now().toString().slice(-4);
        return `${prefix}-${random}-${timestamp}`;
    }
    
    showLowStockNotification() {
        if (Notification.permission === 'granted' && this.lowStockProducts.length > 0) {
            new Notification('Low Stock Alert', {
                body: `${this.lowStockProducts.length} products are below reorder level`,
                icon: '/assets/icons/alert.png'
            });
        }
    }
    
    updateDashboard() {
        // Update stock value on dashboard
        const stockValue = this.products.reduce((total, product) => {
            return total + (product.stock * product.cost);
        }, 0);
        
        const event = new CustomEvent('dashboardUpdate', {
            detail: { stockValue }
        });
        document.dispatchEvent(event);
    }
    
    // Method to render products table (for UI)
    renderProductsTable(container) {
        const html = `
            <div class="bg-white rounded-lg shadow overflow-hidden">
                <div class="px-6 py-4 border-b flex justify-between items-center">
                    <h2 class="text-lg font-semibold text-gray-800">Product Inventory</h2>
                    <button id="add-product" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
                        Add Product
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                            ${this.products.map(product => `
                                <tr class="hover:bg-gray-50">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="font-medium text-gray-900">${product.name}</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.sku}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${this.app.utils.formatCurrency(product.cost)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${this.app.utils.formatCurrency(product.price)}</td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${product.stock <= this.app.settings.lowStockThreshold ? 'bg-red-100 text-red-800' : 
                                              product.stock <= this.app.settings.lowStockThreshold * 2 ? 'bg-yellow-100 text-yellow-800' : 
                                              'bg-green-100 text-green-800'}">
                                            ${product.stock}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                                        ${product.stock <= this.app.settings.lowStockThreshold ? 
                                            '<span class="text-red-600">Reorder</span>' : 
                                            '<span class="text-green-600">OK</span>'}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button class="text-indigo-600 hover:text-indigo-900 edit-product mr-3" data-id="${product.id}">Edit</button>
                                        <button class="text-red-600 hover:text-red-900 delete-product" data-id="${product.id}">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        this.attachProductTableEvents(container);
    }
    
    attachProductTableEvents(container) {
        // Add product button
        container.querySelector('#add-product')?.addEventListener('click', () => {
            this.showProductModal();
        });
        
        // Edit product buttons
        container.querySelectorAll('.edit-product').forEach(button => {
            button.addEventListener('click', (e) => {
                const productId = e.target.dataset.id;
                this.showProductModal(productId);
            });
        });
        
        // Delete product buttons
        container.querySelectorAll('.delete-product').forEach(button => {
            button.addEventListener('click', async (e) => {
                const productId = e.target.dataset.id;
                if (confirm('Are you sure you want to delete this product?')) {
                    try {
                        await this.app.db.collection('products').doc(productId).delete();
                        this.app.showSuccess('Product deleted successfully');
                    } catch (error) {
                        this.app.showError('Failed to delete product');
                    }
                }
            });
        });
    }
    
    showProductModal(productId = null) {
        // Create and show product modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                <div class="px-6 py-4 border-b">
                    <h3 class="text-lg font-semibold">${productId ? 'Edit Product' : 'Add New Product'}</h3>
                </div>
                <div class="p-6">
                    <form id="product-form">
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                                <input type="text" name="name" required 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                                <input type="text" name="sku" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Cost Price *</label>
                                    <input type="number" name="cost" step="0.01" required 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                                    <input type="number" name="price" step="0.01" required 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                                <input type="number" name="stock" step="1" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                                <input type="number" name="reorderLevel" step="1" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end space-x-3">
                            <button type="button" class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 cancel-modal">Cancel</button>
                            <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                                ${productId ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Fill form if editing
        if (productId) {
            const product = this.products.find(p => p.id === productId);
            if (product) {
                const form = modal.querySelector('#product-form');
                Object.keys(product).forEach(key => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) input.value = product[key];
                });
            }
        }
        
        // Handle form submission
        modal.querySelector('#product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const productData = Object.fromEntries(formData);
            
            // Convert numeric fields
            ['cost', 'price', 'stock', 'reorderLevel'].forEach(field => {
                if (productData[field]) productData[field] = parseFloat(productData[field]);
            });
            
            try {
                if (productId) {
                    await this.updateProduct(productId, productData);
                } else {
                    await this.createProduct(productData);
                }
                modal.remove();
            } catch (error) {
                console.error('Error saving product:', error);
            }
        });
        
        // Handle cancel
        modal.querySelector('.cancel-modal').addEventListener('click', () => {
            modal.remove();
        });
        
        // Close modal on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}
