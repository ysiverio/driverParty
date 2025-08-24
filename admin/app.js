// Importaciones
import { 
    auth, 
    db,
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut,
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    serverTimestamp, 
    Timestamp 
} from '../firebase-config.js';
import { APP_CONFIG, PricingCalculator, ValidationUtils, FormatUtils, UIUtils } from '../config.js';

// Variables globales
let currentUser = null;
let pricingCalculator = new PricingCalculator();
let charts = {};

// Elementos DOM
const adminProfilePic = document.getElementById('adminProfilePic');
const adminName = document.getElementById('adminName');
const logoutBtn = document.getElementById('logoutBtn');

// Navegación
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');

// Dashboard
const totalDrivers = document.getElementById('totalDrivers');
const totalUsers = document.getElementById('totalUsers');
const totalTrips = document.getElementById('totalTrips');
const totalRevenue = document.getElementById('totalRevenue');

// Configuración de precios
const driverRatePerKm = document.getElementById('driverRatePerKm');
const userRatePerKm = document.getElementById('userRatePerKm');
const minimumFare = document.getElementById('minimumFare');
const baseFare = document.getElementById('baseFare');
const surgeMultiplier = document.getElementById('surgeMultiplier');
const nightRateMultiplier = document.getElementById('nightRateMultiplier');
const waitingFeePerMinute = document.getElementById('waitingFeePerMinute');
const cancellationFee = document.getElementById('cancellationFee');
const pricingPreviewBody = document.getElementById('pricingPreviewBody');
const savePricingBtn = document.getElementById('savePricingBtn');
const resetPricingBtn = document.getElementById('resetPricingBtn');

// Gestión de conductores
const driverStatusFilter = document.getElementById('driverStatusFilter');
const driverRatingFilter = document.getElementById('driverRatingFilter');
const refreshDriversBtn = document.getElementById('refreshDriversBtn');
const driversTableBody = document.getElementById('driversTableBody');

// Gestión de usuarios
const usersTableBody = document.getElementById('usersTableBody');

// Historial de viajes
const tripStatusFilter = document.getElementById('tripStatusFilter');
const tripDateFilter = document.getElementById('tripDateFilter');
const exportTripsBtn = document.getElementById('exportTripsBtn');
const tripsTableBody = document.getElementById('tripsTableBody');

// Configuración general
const appName = document.getElementById('appName');
const supportEmail = document.getElementById('supportEmail');
const supportPhone = document.getElementById('supportPhone');
const defaultZoom = document.getElementById('defaultZoom');
const updateInterval = document.getElementById('updateInterval');
const soundEnabled = document.getElementById('soundEnabled');
const vibrationEnabled = document.getElementById('vibrationEnabled');
const toastDuration = document.getElementById('toastDuration');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const resetSettingsBtn = document.getElementById('resetSettingsBtn');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
    setupEventListeners();
});

// Autenticación
function initializeAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            setupUIForLoggedInUser(user);
            loadDashboardData();
        } else {
            // Redirigir a login si no está autenticado
            window.location.href = 'login.html';
        }
    });
}

function setupUIForLoggedInUser(user) {
    adminProfilePic.src = user.photoURL || '../default-avatar.svg';
    adminName.textContent = user.displayName || 'Administrador';
}

// Event Listeners
function setupEventListeners() {
    // Navegación
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });

    // Logout
    logoutBtn.addEventListener('click', handleLogout);

    // Configuración de precios
    [driverRatePerKm, userRatePerKm, minimumFare, baseFare, surgeMultiplier, nightRateMultiplier, waitingFeePerMinute, cancellationFee].forEach(input => {
        input.addEventListener('input', updatePricingPreview);
    });

    savePricingBtn.addEventListener('click', savePricingConfiguration);
    resetPricingBtn.addEventListener('click', resetPricingConfiguration);

    // Gestión de conductores
    driverStatusFilter.addEventListener('change', filterDrivers);
    driverRatingFilter.addEventListener('change', filterDrivers);
    refreshDriversBtn.addEventListener('click', loadDriversData);

    // Historial de viajes
    tripStatusFilter.addEventListener('change', filterTrips);
    tripDateFilter.addEventListener('change', filterTrips);
    exportTripsBtn.addEventListener('click', exportTripsData);

    // Configuración general
    saveSettingsBtn.addEventListener('click', saveGeneralSettings);
    resetSettingsBtn.addEventListener('click', resetGeneralSettings);
}

// Navegación
function switchSection(sectionName) {
    // Actualizar navegación
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Mostrar sección correspondiente
    contentSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === sectionName) {
            section.classList.add('active');
        }
    });

    // Cargar datos específicos de la sección
    switch (sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'pricing':
            loadPricingConfiguration();
            break;
        case 'drivers':
            loadDriversData();
            loadPendingDriverRequests();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'trips':
            loadTripsData();
            break;
        case 'analytics':
            loadAnalyticsData();
            break;
        case 'settings':
            loadGeneralSettings();
            break;
    }
}

// Dashboard
async function loadDashboardData() {
    try {
        const loading = UIUtils.showLoading('Cargando dashboard...');
        
        // Cargar estadísticas
        await Promise.all([
            loadDriversStats(),
            loadUsersStats(),
            loadTripsStats(),
            loadRevenueStats()
        ]);

        // Cargar gráficos
        loadDashboardCharts();
        
        UIUtils.hideLoading(loading);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        UIUtils.showToast('Error al cargar datos del dashboard', 'error');
    }
}

async function loadDriversStats() {
    try {
        const driversQuery = query(collection(db, "drivers"));
        const snapshot = await getDocs(driversQuery);
        const onlineDrivers = snapshot.docs.filter(doc => doc.data().status === 'online').length;
        
        totalDrivers.textContent = onlineDrivers;
    } catch (error) {
        console.error('Error loading drivers stats:', error);
        totalDrivers.textContent = '0';
    }
}

async function loadUsersStats() {
    try {
        const usersQuery = query(collection(db, "users"));
        const snapshot = await getDocs(usersQuery);
        
        totalUsers.textContent = snapshot.size;
    } catch (error) {
        console.error('Error loading users stats:', error);
        totalUsers.textContent = '0';
    }
}

async function loadTripsStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Query simple sin índices compuestos
        const tripsQuery = query(collection(db, "trips"));
        const snapshot = await getDocs(tripsQuery);
        
        let tripsToday = 0;
        snapshot.forEach(doc => {
            const trip = doc.data();
            const tripDate = trip.createdAt ? trip.createdAt.toDate() : new Date();
            
            // Filtrar por fecha en el cliente
            if (tripDate >= today) {
                tripsToday++;
            }
        });
        
        totalTrips.textContent = tripsToday;
    } catch (error) {
        console.error('Error loading trips stats:', error);
        totalTrips.textContent = '0';
    }
}

async function loadRevenueStats() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Query simple sin índices compuestos para evitar errores
        const tripsQuery = query(collection(db, "trips"));
        const snapshot = await getDocs(tripsQuery);
        
        let totalRevenueAmount = 0;
        let completedTripsToday = 0;
        
        snapshot.forEach(doc => {
            const trip = doc.data();
            const tripDate = trip.createdAt ? trip.createdAt.toDate() : new Date();
            
            // Filtrar por fecha y estado en el cliente
            if (tripDate >= today && trip.status === "completed" && trip.userFare) {
                totalRevenueAmount += trip.userFare;
                completedTripsToday++;
            }
        });
        
        totalRevenue.textContent = FormatUtils.formatCurrency(totalRevenueAmount);
    } catch (error) {
        console.error('Error loading revenue stats:', error);
        totalRevenue.textContent = '$0';
    }
}

function loadDashboardCharts() {
    // Gráfico de viajes por hora
    const tripsCtx = document.getElementById('tripsChart').getContext('2d');
    if (charts.tripsChart) {
        charts.tripsChart.destroy();
    }
    
    charts.tripsChart = new Chart(tripsCtx, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Viajes',
                data: [12, 8, 25, 45, 38, 22],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Gráfico de ingresos por día
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    if (charts.revenueChart) {
        charts.revenueChart.destroy();
    }
    
    charts.revenueChart = new Chart(revenueCtx, {
        type: 'bar',
        data: {
            labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
            datasets: [{
                label: 'Ingresos',
                data: [1200, 1400, 1100, 1600, 1800, 2000, 1500],
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Configuración de Precios
async function loadPricingConfiguration() {
    try {
        const configRef = doc(db, "configuration", "pricing");
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
            const config = configDoc.data();
            driverRatePerKm.value = config.DEFAULT_DRIVER_RATE_PER_KM || 2.50;
            userRatePerKm.value = config.DEFAULT_USER_RATE_PER_KM || 3.50;
            minimumFare.value = config.MINIMUM_FARE || 5.00;
            baseFare.value = config.BASE_FARE || 2.00;
            surgeMultiplier.value = config.SURGE_MULTIPLIER || 1.5;
            nightRateMultiplier.value = config.NIGHT_RATE_MULTIPLIER || 1.2;
            waitingFeePerMinute.value = config.WAITING_FEE_PER_MINUTE || 0.50;
            cancellationFee.value = config.CANCELLATION_FEE || 3.00;
        }
        
        updatePricingPreview();
    } catch (error) {
        console.error('Error loading pricing configuration:', error);
        UIUtils.showToast('Error al cargar configuración de precios', 'error');
    }
}

function updatePricingPreview() {
    const config = {
        DEFAULT_DRIVER_RATE_PER_KM: parseFloat(driverRatePerKm.value),
        DEFAULT_USER_RATE_PER_KM: parseFloat(userRatePerKm.value),
        MINIMUM_FARE: parseFloat(minimumFare.value),
        BASE_FARE: parseFloat(baseFare.value),
        SURGE_MULTIPLIER: parseFloat(surgeMultiplier.value),
        NIGHT_RATE_MULTIPLIER: parseFloat(nightRateMultiplier.value),
        WAITING_FEE_PER_MINUTE: parseFloat(waitingFeePerMinute.value),
        CANCELLATION_FEE: parseFloat(cancellationFee.value)
    };
    
    pricingCalculator = new PricingCalculator(config);
    
    const distances = [1, 2, 5, 10, 15, 20];
    let previewHTML = '';
    
    distances.forEach(distance => {
        const userFare = pricingCalculator.calculateUserFare(distance);
        const driverEarnings = pricingCalculator.calculateDriverEarnings(distance);
        const platformCommission = pricingCalculator.calculatePlatformCommission(userFare, driverEarnings);
        
        previewHTML += `
            <tr>
                <td>${distance} km</td>
                <td>${FormatUtils.formatCurrency(userFare)}</td>
                <td>${FormatUtils.formatCurrency(driverEarnings)}</td>
                <td>${FormatUtils.formatCurrency(platformCommission)}</td>
            </tr>
        `;
    });
    
    pricingPreviewBody.innerHTML = previewHTML;
}

async function savePricingConfiguration() {
    try {
        const loading = UIUtils.showLoading('Guardando configuración...');
        
        const config = {
            DEFAULT_DRIVER_RATE_PER_KM: parseFloat(driverRatePerKm.value),
            DEFAULT_USER_RATE_PER_KM: parseFloat(userRatePerKm.value),
            MINIMUM_FARE: parseFloat(minimumFare.value),
            BASE_FARE: parseFloat(baseFare.value),
            SURGE_MULTIPLIER: parseFloat(surgeMultiplier.value),
            NIGHT_RATE_MULTIPLIER: parseFloat(nightRateMultiplier.value),
            WAITING_FEE_PER_MINUTE: parseFloat(waitingFeePerMinute.value),
            CANCELLATION_FEE: parseFloat(cancellationFee.value),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        };
        
        const configRef = doc(db, "configuration", "pricing");
        await updateDoc(configRef, config);
        
        UIUtils.hideLoading(loading);
        UIUtils.showToast('Configuración guardada exitosamente', 'success');
    } catch (error) {
        console.error('Error saving pricing configuration:', error);
        UIUtils.showToast('Error al guardar configuración', 'error');
    }
}

function resetPricingConfiguration() {
    driverRatePerKm.value = 2.50;
    userRatePerKm.value = 3.50;
    minimumFare.value = 5.00;
    baseFare.value = 2.00;
    surgeMultiplier.value = 1.5;
    nightRateMultiplier.value = 1.2;
    waitingFeePerMinute.value = 0.50;
    cancellationFee.value = 3.00;
    
    updatePricingPreview();
    UIUtils.showToast('Configuración restaurada', 'info');
}

// Gestión de Conductores
async function loadDriversData() {
    try {
        const loading = UIUtils.showLoading('Cargando conductores...');
        
        const driversQuery = query(collection(db, "drivers"));
        const snapshot = await getDocs(driversQuery);
        
        let driversHTML = '';
        snapshot.forEach(doc => {
            const driver = doc.data();
            const statusClass = getStatusClass(driver.status);
            const rating = driver.avgRating || 0;
            const trips = driver.numTrips || 0;
            const lastActivity = driver.lastActivity ? FormatUtils.formatDateTime(driver.lastActivity.toDate()) : 'Nunca';
            
            driversHTML += `
                <tr>
                    <td>
                                                 <div style="display: flex; align-items: center; gap: 10px;">
                             <img src="${driver.photoURL || '../default-avatar.svg'}" alt="${driver.name}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <div style="font-weight: 600;">${driver.name}</div>
                                <div style="font-size: 12px; color: #666;">${driver.email}</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="${statusClass}">${getStatusText(driver.status)}</span></td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span>${rating.toFixed(1)}</span>
                            <div style="color: #ffc107;">
                                ${generateStarsHTML(rating)}
                            </div>
                        </div>
                    </td>
                    <td>${trips}</td>
                    <td>${lastActivity}</td>
                    <td>
                        <button class="action-btn view" onclick="viewDriver('${doc.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="editDriver('${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="deleteDriver('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        driversTableBody.innerHTML = driversHTML;
        UIUtils.hideLoading(loading);
        
        // Cargar solicitudes pendientes
        await loadPendingDriverRequests();
        
    } catch (error) {
        console.error('Error loading drivers data:', error);
        UIUtils.showToast('Error al cargar conductores', 'error');
    }
}

// Cargar solicitudes de drivers pendientes
async function loadPendingDriverRequests() {
    try {
        const pendingDriversQuery = query(
            collection(db, "drivers"), 
            where("status", "==", "pending")
        );
        const querySnapshot = await getDocs(pendingDriversQuery);
        
        // Crear sección de solicitudes pendientes si no existe
        let pendingSection = document.getElementById('pending-drivers-section');
        if (!pendingSection) {
            pendingSection = document.createElement('div');
            pendingSection.id = 'pending-drivers-section';
            pendingSection.className = 'pending-drivers-section';
            pendingSection.innerHTML = `
                <h3>Solicitudes Pendientes (${querySnapshot.size})</h3>
                <div class="pending-drivers-list"></div>
            `;
            
            // Insertar después del título de la sección de drivers
            const driversSection = document.getElementById('drivers');
            if (driversSection) {
                const driversTitle = driversSection.querySelector('h2');
                if (driversTitle && driversTitle.nextSibling) {
                    driversSection.insertBefore(pendingSection, driversTitle.nextSibling);
                } else {
                    // Si no hay título o siguiente elemento, agregar al final
                    driversSection.appendChild(pendingSection);
                }
            }
        }
        
        const pendingList = pendingSection.querySelector('.pending-drivers-list');
        pendingList.innerHTML = '';
        
        if (querySnapshot.empty) {
            pendingList.innerHTML = '<p class="no-pending">No hay solicitudes pendientes</p>';
            // Mostrar la sección aunque esté vacía
            pendingSection.style.display = 'block';
            return;
        }
        
        // Mostrar la sección cuando hay solicitudes
        pendingSection.style.display = 'block';
        
        querySnapshot.forEach(doc => {
            const driver = doc.data();
            const card = createPendingDriverCard(doc.id, driver);
            pendingList.appendChild(card);
        });
        
    } catch (error) {
        console.error('Error loading pending driver requests:', error);
    }
}

// Crear tarjeta de driver pendiente
function createPendingDriverCard(driverId, driver) {
    const card = document.createElement('div');
    card.className = 'pending-driver-card';
    card.innerHTML = `
        <div class="driver-info">
            <img src="${driver.photoURL || '../default-avatar.svg'}" alt="Driver" class="driver-photo">
            <div class="driver-details">
                <h4>${driver.name}</h4>
                <p><strong>Email:</strong> ${driver.email}</p>
                <p><strong>Teléfono:</strong> ${driver.phone}</p>
                <p><strong>Licencia:</strong> ${driver.license}</p>
                <p><strong>Vehículo:</strong> ${driver.vehicle.make} ${driver.vehicle.model} (${driver.vehicle.plate})</p>
                <p><strong>Fecha de solicitud:</strong> ${(() => {
                    if (!driver.createdAt) return 'N/A';
                    try {
                        if (driver.createdAt.toDate && typeof driver.createdAt.toDate === 'function') {
                            return new Date(driver.createdAt.toDate()).toLocaleDateString('es-ES');
                        } else if (driver.createdAt instanceof Date) {
                            return driver.createdAt.toLocaleDateString('es-ES');
                        } else if (typeof driver.createdAt === 'string') {
                            return new Date(driver.createdAt).toLocaleDateString('es-ES');
                        } else if (driver.createdAt.seconds) {
                            return new Date(driver.createdAt.seconds * 1000).toLocaleDateString('es-ES');
                        }
                    } catch (error) {
                        console.error('Error parsing createdAt:', error);
                    }
                    return 'N/A';
                })()}</p>
            </div>
        </div>
        <div class="driver-actions">
            <button class="btn-approve" onclick="approveDriver('${driverId}')">
                <i class="fas fa-check"></i> Aprobar
            </button>
            <button class="btn-reject" onclick="rejectDriver('${driverId}')">
                <i class="fas fa-times"></i> Rechazar
            </button>
        </div>
    `;
    return card;
}

// Aprobar driver
async function approveDriver(driverId) {
    try {
        await updateDoc(doc(db, "drivers", driverId), {
            status: 'approved',
            approvedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Recargar datos
        loadDriversData();
        
        console.log('Driver approved:', driverId);
        
    } catch (error) {
        console.error('Error approving driver:', error);
        alert('Error al aprobar el conductor');
    }
}

// Rechazar driver
async function rejectDriver(driverId) {
    const reason = prompt('Motivo del rechazo:');
    if (!reason) return;
    
    try {
        await updateDoc(doc(db, "drivers", driverId), {
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Recargar datos
        loadDriversData();
        
        console.log('Driver rejected:', driverId);
        
    } catch (error) {
        console.error('Error rejecting driver:', error);
        alert('Error al rechazar el conductor');
    }
}

function getStatusClass(status) {
    switch (status) {
        case 'online': return 'status-online';
        case 'offline': return 'status-offline';
        case 'busy': return 'status-busy';
        default: return 'status-offline';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'online': return 'En línea';
        case 'offline': return 'Desconectado';
        case 'busy': return 'Ocupado';
        default: return 'Desconectado';
    }
}

function generateStarsHTML(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let starsHTML = '';
    for (let i = 0; i < fullStars; i++) {
        starsHTML += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        starsHTML += '<i class="fas fa-star-half-alt"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<i class="far fa-star"></i>';
    }
    
    return starsHTML;
}

function filterDrivers() {
    // Implementar filtros de conductores
    loadDriversData();
}

// Gestión de Usuarios
async function loadUsersData() {
    try {
        const loading = UIUtils.showLoading('Cargando usuarios...');
        
        const usersQuery = query(collection(db, "users"));
        const snapshot = await getDocs(usersQuery);
        
        let usersHTML = '';
        snapshot.forEach(doc => {
            const user = doc.data();
            const trips = user.numTrips || 0;
            const lastTrip = user.lastTrip ? FormatUtils.formatDateTime(user.lastTrip.toDate()) : 'Nunca';
            
            usersHTML += `
                <tr>
                    <td>
                                                 <div style="display: flex; align-items: center; gap: 10px;">
                             <img src="${user.photoURL || '../default-avatar.svg'}" alt="${user.name}" style="width: 40px; height: 40px; border-radius: 50%;">
                            <div>
                                <div style="font-weight: 600;">${user.name}</div>
                                <div style="font-size: 12px; color: #666;">${user.email}</div>
                            </div>
                        </div>
                    </td>
                    <td>${user.email}</td>
                    <td>${trips}</td>
                    <td>${lastTrip}</td>
                    <td><span class="status-online">Activo</span></td>
                    <td>
                        <button class="action-btn view" onclick="viewUser('${doc.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn edit" onclick="editUser('${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        usersTableBody.innerHTML = usersHTML;
        UIUtils.hideLoading(loading);
    } catch (error) {
        console.error('Error loading users data:', error);
        UIUtils.showToast('Error al cargar usuarios', 'error');
    }
}

// Historial de Viajes
async function loadTripsData() {
    try {
        const loading = UIUtils.showLoading('Cargando viajes...');
        
        // Query simple sin orderBy para evitar índices compuestos
        const tripsQuery = query(collection(db, "trips"));
        const snapshot = await getDocs(tripsQuery);
        
        let tripsHTML = '';
        const trips = [];
        
        // Convertir a array y ordenar en el cliente
        snapshot.forEach(doc => {
            const trip = doc.data();
            trips.push({
                id: doc.id,
                ...trip
            });
        });
        
        // Ordenar por fecha de creación (más reciente primero)
        trips.sort((a, b) => {
            const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
            const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
            return dateB - dateA;
        });
        
        trips.forEach(trip => {
            const statusClass = getTripStatusClass(trip.status);
            const createdAt = trip.createdAt ? trip.createdAt.toDate() : new Date();
            
            tripsHTML += `
                <tr>
                    <td>${trip.id.substring(0, 8)}...</td>
                    <td>${trip.userName || 'N/A'}</td>
                    <td>${trip.driverName || 'N/A'}</td>
                    <td>${trip.origin} → ${trip.destination}</td>
                    <td>${FormatUtils.formatCurrency(trip.userFare || 0)}</td>
                    <td><span class="${statusClass}">${getTripStatusText(trip.status)}</span></td>
                    <td>${FormatUtils.formatDateTime(createdAt)}</td>
                    <td>
                        <button class="action-btn view" onclick="viewTrip('${trip.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tripsTableBody.innerHTML = tripsHTML;
        UIUtils.hideLoading(loading);
    } catch (error) {
        console.error('Error loading trips data:', error);
        UIUtils.showToast('Error al cargar viajes', 'error');
    }
}

function getTripStatusClass(status) {
    switch (status) {
        case 'completed': return 'status-online';
        case 'cancelled': return 'status-offline';
        case 'in_progress': return 'status-busy';
        default: return 'status-offline';
    }
}

function getTripStatusText(status) {
    switch (status) {
        case 'completed': return 'Completado';
        case 'cancelled': return 'Cancelado';
        case 'in_progress': return 'En Progreso';
        default: return 'Pendiente';
    }
}

function filterTrips() {
    // Implementar filtros de viajes
    loadTripsData();
}

function exportTripsData() {
    // Implementar exportación de datos
    UIUtils.showToast('Funcionalidad de exportación en desarrollo', 'info');
}

// Analíticas
function loadAnalyticsData() {
    // Implementar gráficos de analíticas
    loadAnalyticsCharts();
}

function loadAnalyticsCharts() {
    // Gráfico de ingresos mensuales
    const monthlyRevenueCtx = document.getElementById('monthlyRevenueChart').getContext('2d');
    if (charts.monthlyRevenueChart) {
        charts.monthlyRevenueChart.destroy();
    }
    
    charts.monthlyRevenueChart = new Chart(monthlyRevenueCtx, {
        type: 'line',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datasets: [{
                label: 'Ingresos',
                data: [15000, 18000, 16000, 22000, 25000, 28000],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });

    // Otros gráficos...
}

// Configuración General
async function loadGeneralSettings() {
    try {
        const configRef = doc(db, "configuration", "general");
        const configDoc = await getDoc(configRef);
        
        if (configDoc.exists()) {
            const config = configDoc.data();
            appName.value = config.APP_NAME || 'DriverParty';
            supportEmail.value = config.SUPPORT_EMAIL || 'support@driverparty.com';
            supportPhone.value = config.SUPPORT_PHONE || '+1-800-DRIVER';
            defaultZoom.value = config.DEFAULT_ZOOM || 15;
            updateInterval.value = config.UPDATE_INTERVAL || 5000;
            soundEnabled.checked = config.SOUND_ENABLED !== false;
            vibrationEnabled.checked = config.VIBRATION_ENABLED !== false;
            toastDuration.value = config.TOAST_DURATION || 3000;
        }
    } catch (error) {
        console.error('Error loading general settings:', error);
        UIUtils.showToast('Error al cargar configuración general', 'error');
    }
}

async function saveGeneralSettings() {
    try {
        const loading = UIUtils.showLoading('Guardando configuración...');
        
        const config = {
            APP_NAME: appName.value,
            SUPPORT_EMAIL: supportEmail.value,
            SUPPORT_PHONE: supportPhone.value,
            DEFAULT_ZOOM: parseInt(defaultZoom.value),
            UPDATE_INTERVAL: parseInt(updateInterval.value),
            SOUND_ENABLED: soundEnabled.checked,
            VIBRATION_ENABLED: vibrationEnabled.checked,
            TOAST_DURATION: parseInt(toastDuration.value),
            updatedAt: serverTimestamp(),
            updatedBy: currentUser.uid
        };
        
        const configRef = doc(db, "configuration", "general");
        await updateDoc(configRef, config);
        
        UIUtils.hideLoading(loading);
        UIUtils.showToast('Configuración guardada exitosamente', 'success');
    } catch (error) {
        console.error('Error saving general settings:', error);
        UIUtils.showToast('Error al guardar configuración', 'error');
    }
}

function resetGeneralSettings() {
    appName.value = 'DriverParty';
    supportEmail.value = 'support@driverparty.com';
    supportPhone.value = '+1-800-DRIVER';
    defaultZoom.value = 15;
    updateInterval.value = 5000;
    soundEnabled.checked = true;
    vibrationEnabled.checked = true;
    toastDuration.value = 3000;
    
    UIUtils.showToast('Configuración restaurada', 'info');
}

// Funciones de utilidad
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = '../driver/index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        UIUtils.showToast('Error al cerrar sesión', 'error');
    }
}

// Funciones globales para botones de acción
window.viewDriver = function(driverId) {
    UIUtils.showToast(`Ver conductor: ${driverId}`, 'info');
};

window.editDriver = function(driverId) {
    UIUtils.showToast(`Editar conductor: ${driverId}`, 'info');
};

window.deleteDriver = function(driverId) {
    UIUtils.confirmDialog(
        '¿Estás seguro de que quieres eliminar este conductor?',
        async () => {
            try {
                await deleteDoc(doc(db, "drivers", driverId));
                UIUtils.showToast('Conductor eliminado exitosamente', 'success');
                loadDriversData();
            } catch (error) {
                console.error('Error deleting driver:', error);
                UIUtils.showToast('Error al eliminar conductor', 'error');
            }
        }
    );
};

window.viewUser = function(userId) {
    UIUtils.showToast(`Ver usuario: ${userId}`, 'info');
};

window.editUser = function(userId) {
    UIUtils.showToast(`Editar usuario: ${userId}`, 'info');
};

window.viewTrip = function(tripId) {
    UIUtils.showToast(`Ver viaje: ${tripId}`, 'info');
};

// Funciones para aprobar/rechazar drivers
window.approveDriver = function(driverId) {
    approveDriver(driverId);
};

window.rejectDriver = function(driverId) {
    rejectDriver(driverId);
};
