// js/app.js
import { firebaseConfig } from './firebase/config.js';
import { initRouter } from './ui/router.js';
import { initDashboard } from './ui/dashboard.js';
import { initOfflineSupport } from './modules/offline.js';
import { initExport } from './utils/export.js';

class SBMApplication {
    constructor() {
        this.modules = {};
        this.currentUser = null;
        this.settings = {
            currency: 'USD',
            taxRate: 0.16,
            lowStockThreshold: 10
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize Firebase
            const app = window.firebaseModules.initializeApp(firebaseConfig);
            this.db = window.firebaseModules.getFirestore(app);
            this.auth = window.firebaseModules.getAuth(app);
            this.storage = window.firebaseModules.getStorage(app);
            
            // Load settings from localStorage or Firebase
            await this.loadSettings();
            
            // Initialize modules
            await this.initModules();
            
            // Initialize UI
            this.initUI();
            
            // Initialize offline support
            initOfflineSupport(this);
            
            console.log('SBM Application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError('Failed to initialize application. Please refresh the page.');
        }
    }
    
    async loadSettings() {
        const savedSettings = localStorage.getItem('sbm_settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        
        // Try to load from Firebase if authenticated
        if (this.auth.currentUser) {
            const settingsDoc = await this.db.collection('settings').doc('global').get();
            if (settingsDoc.exists) {
                this.settings = { ...this.settings, ...settingsDoc.data() };
            }
        }
    }
    
    async initModules() {
        // Import and initialize all modules
        const modulePromises = [
            import('./modules/products.js').then(m => this.modules.products = new m.default(this)),
            import('./modules/services.js').then(m => this.modules.services = new m.default(this)),
            import('./modules/finance.js').then(m => this.modules.finance = new m.default(this)),
            import('./modules/crm.js').then(m => this.modules.crm = new m.default(this)),
            import('./modules/accounting.js').then(m => this.modules.accounting = new m.default(this)),
            import('./modules/audit.js').then(m => this.modules.audit = new m.default(this))
        ];
        
        await Promise.all(modulePromises);
    }
    
    initUI() {
        // Initialize router
        initRouter(this);
        
        // Initialize dashboard
        initDashboard(this);
        
        // Initialize export functionality
        initExport(this);
        
        // Update offline status indicator
        window.addEventListener('online', () => {
            document.getElementById('offline-status').textContent = 'Online';
            document.getElementById('offline-status').className = 'text-sm px-3 py-1 rounded-full bg-green-100 text-green-800';
        });
        
        window.addEventListener('offline', () => {
            document.getElementById('offline-status').textContent = 'Offline';
            document.getElementById('offline-status').className = 'text-sm px-3 py-1 rounded-full bg-yellow-100 text-yellow-800';
        });
        
        // Mobile menu toggle
        document.getElementById('mobile-menu-button').addEventListener('click', () => {
            const menu = document.getElementById('mobile-menu');
            menu.classList.toggle('hidden');
        });
    }
    
    showError(message) {
        // Create error toast
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
    
    showSuccess(message) {
        // Create success toast
        const toast = document.createElement('div');
        toast.className = 'fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sbmApp = new SBMApplication();
});
