// Script para configurar el usuario administrador
// Este script debe ejecutarse una sola vez para crear el usuario administrador

import { 
    auth, 
    db,
    createUserWithEmailAndPassword,
    doc,
    setDoc,
    collection
} from './firebase-config.js';

// Configuración del administrador
const ADMIN_EMAIL = 'admin@driverparty.com';
const ADMIN_PASSWORD = 'AdminDriverParty2024!'; // Cambia esta contraseña por una segura

async function createAdminUser() {
    try {
        console.log('Creando usuario administrador...');
        
        // Crear usuario en Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        const user = userCredential.user;
        
        console.log('Usuario creado exitosamente:', user.uid);
        
        // Crear documento de administrador en Firestore
        const adminDoc = {
            uid: user.uid,
            email: ADMIN_EMAIL,
            name: 'Administrador',
            role: 'admin',
            createdAt: serverTimestamp(),
            isActive: true,
            permissions: ['dashboard', 'pricing', 'drivers', 'users', 'trips', 'analytics', 'settings']
        };
        
        await setDoc(doc(collection(db, 'admins'), user.uid), adminDoc);
        
        console.log('Documento de administrador creado exitosamente');
        console.log('Credenciales de acceso:');
        console.log('Email:', ADMIN_EMAIL);
        console.log('Contraseña:', ADMIN_PASSWORD);
        console.log('¡IMPORTANTE! Cambia la contraseña después del primer inicio de sesión');
        
    } catch (error) {
        console.error('Error creando usuario administrador:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            console.log('El usuario administrador ya existe');
        } else {
            console.error('Error específico:', error.message);
        }
    }
}

// Ejecutar solo si se llama directamente
if (typeof window !== 'undefined') {
    // En el navegador, agregar un botón para ejecutar
    const setupButton = document.createElement('button');
    setupButton.textContent = 'Configurar Administrador';
    setupButton.onclick = createAdminUser;
    setupButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 10000;
    `;
    document.body.appendChild(setupButton);
}

export { createAdminUser };
