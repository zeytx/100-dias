// 1. IMPORTACIONES
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

// 2. TU CONFIGURACIÓN (NO CAMBIA)
const firebaseConfig = {
    apiKey: "AIzaSyAiwK_1-uHdLnCkLyygpL_9YdwcSHmMkDk",
    authDomain: "dias-juntos-32496.firebaseapp.com",
    projectId: "dias-juntos-32496",
    storageBucket: "dias-juntos-32496.firebasestorage.app",
    messagingSenderId: "251764366203",
    appId: "1:251764366203:web:1666fb01569716044f3bde"
};

// 3. INICIALIZAR
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- VARIABLES ---
const grid = document.getElementById('grid');
const loginModal = document.getElementById('login-modal');
const letterModal = document.getElementById('letter-modal');
const passInput = document.getElementById('pass-input');
const unlockBtn = document.getElementById('unlock-btn');
const errorMsg = document.getElementById('error-msg');
const closeModal = document.querySelector('.close-btn');
const dayNumberDisplay = document.getElementById('day-number-display');

// Elements Nofiticaciones
const notifModal = document.getElementById('notification-modal');
const notifMessage = document.getElementById('notif-message');
const notifOkBtn = document.getElementById('notif-ok-btn');

let currentDaySelected = null;
const START_DATE_KEY = 'startDate_100days';

// --- SYNC INICIAL (Nube -> Local) ---
async function syncStartDate() {
    try {
        const docRef = doc(db, "config", "estado");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const cloudDate = docSnap.data().fechaInicio;
            const localDate = localStorage.getItem(START_DATE_KEY);

            if (cloudDate && cloudDate !== localDate) {
                console.log("Sincronizando fecha desde la nube...", cloudDate);
                localStorage.setItem(START_DATE_KEY, cloudDate);
                // Si la fecha la traemos de la nube, recargamos para actualizar el grid
                location.reload();
            }
        }
    } catch (e) {
        console.warn("No se pudo sincronizar con Firebase (posiblemente offline o sin permisos aún):", e);
    }
}
syncStartDate();

// --- GENERAR GRID ---
function getDaysUnlocked() {
    const startStr = localStorage.getItem(START_DATE_KEY);
    if (!startStr) return 0; // No ha empezado

    const start = new Date(startStr);
    const now = new Date();
    const diffTime = now - start;

    // Días pasados desde el inicio (mínimo 1 si ya empezó)
    // Usamos floor para contar días completos de 24h, +1 para el día actual
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

const maxDayAllowed = getDaysUnlocked();

for (let i = 1; i <= 100; i++) {
    const box = document.createElement('div');
    box.classList.add('day-box');
    box.textContent = i;

    // Verificar si ya está desbloqueado localmente (por contraseña)
    const isUnlocked = localStorage.getItem(`day-${i}-unlocked`) === 'true';

    // Lógica de TIEMPO:
    // Si NO hay fecha de inicio, SOLO el día 1 está habilitado para intentar abrir.
    // Si HAY fecha de inicio, se permiten días <= maxDayAllowed.
    // EXCEPCIÓN: Si ya está desbloqueado (isUnlocked), lo mostramos abierto (aunque fuera de fecha, raro pero posible si se cambia hora)

    let isTimeLocked = false;

    if (maxDayAllowed === 0) {
        // Aún no empieza
        if (i > 1) isTimeLocked = true;
    } else {
        // Ya empezó
        if (i > maxDayAllowed) isTimeLocked = true;
    }

    if (isUnlocked) {
        box.classList.add('unlocked');
        box.innerHTML = `${i} ❤️`;
    } else if (isTimeLocked) {
        box.classList.add('time-locked'); // Nuevo estilo
        box.classList.add('locked'); // Mantiene look cerrado
    } else {
        box.classList.add('locked');
    }

    // Evento Click
    box.addEventListener('click', () => {
        if (isTimeLocked) {
            showNotification(`Aún no es el momento... este día estará disponible el día ${i} de tu viaje. ⏳`);
            return;
        }

        if (localStorage.getItem(`day-${i}-unlocked`) === 'true') {
            // Si ya está abierto, cargamos la carta directo (sin pedir clave)
            loadLetterContent(i);
        } else {
            // Si está bloqueado, pedimos la clave
            openLoginModal(i);
        }
    });

    grid.appendChild(box);
}

function openLoginModal(day) {
    currentDaySelected = day;
    dayNumberDisplay.textContent = day;
    passInput.value = "";
    errorMsg.textContent = "";
    loginModal.classList.add('active');
}

// --- VERIFICACIÓN CON CLAVE MAESTRA ---
unlockBtn.addEventListener('click', async () => {
    const enteredPass = passInput.value.trim();
    if (!enteredPass) return;

    unlockBtn.textContent = "Verificando...";
    errorMsg.textContent = "";

    try {
        // 1. Consultamos la CLAVE MAESTRA en Firebase
        // Colección: config, Documento: seguridad
        const configRef = doc(db, "config", "seguridad");
        const configSnap = await getDoc(configRef);

        if (configSnap.exists()) {
            const realPassword = configSnap.data().maestra; // Campo 'maestra'

            // 2. Comparamos
            if (enteredPass.toLowerCase() === realPassword.toLowerCase()) {
                // ¡Correcto!
                localStorage.setItem(`day-${currentDaySelected}-unlocked`, 'true');

                // --- INICIO DEL CONTEO ---
                // Si es la primera vez que desbloquea algo (o específicamente el día 1, 
                // pero asumiremos que el primer desbloqueo inicia el conteo pase lo que pase)
                // --- INICIO DEL CONTEO ---
                // Si es la primera vez que desbloquea algo, guardamos la fecha
                if (!localStorage.getItem(START_DATE_KEY)) {
                    const nowISO = new Date().toISOString();
                    localStorage.setItem(START_DATE_KEY, nowISO);

                    // PERSISTENCIA EN NUBE
                    try {
                        await setDoc(doc(db, "config", "estado"), { fechaInicio: nowISO });
                        console.log("Fecha de inicio guardada en nube");
                    } catch (e) {
                        console.error("Error guardando en nube:", e);
                        // No bloqueamos el flujo si falla, ya está en local
                    }

                    showNotification("¡Ha comenzado tu viaje de 100 días! 📅✨");

                    // Recargamos para actualizar los candados de tiempo
                    setTimeout(() => location.reload(), 2000);
                }

                updateGridVisual(currentDaySelected);

                updateGridVisual(currentDaySelected);
                loginModal.classList.remove('active');

                // 3. Ahora descargamos la carta de ese día
                loadLetterContent(currentDaySelected);
            } else {
                errorMsg.textContent = "Clave incorrecta 💔";
                shakeInput();
            }
        } else {
            errorMsg.textContent = "Error: No se encontró configuración de seguridad.";
        }

    } catch (error) {
        console.error(error);
        errorMsg.textContent = "Error de conexión.";
    } finally {
        unlockBtn.textContent = "Abrir";
    }
});

// --- DESCARGAR CARTA ---
async function loadLetterContent(day) {
    try {
        // Colección: dias, Documento: numero del día
        const docRef = doc(db, "dias", day.toString());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            showLetter(data.titulo, data.carta);
        } else {
            showNotification("Aún no he escrito la carta de hoy... ¡vuelve más tarde!");
        }
    } catch (error) {
        console.error("Error cargando carta:", error);
        showNotification("No pude cargar la carta, revisa tu internet.");
    }
}

// --- UI HELPERS ---
function showLetter(title, body) {
    const envelope = document.getElementById('envelope');
    const sliderContainer = document.querySelector('.slider-container');
    const slider = document.getElementById('open-slider');

    // Resetear estado
    envelope.classList.remove('open');
    sliderContainer.style.display = 'block'; // Mostrar slider
    slider.value = 0; // Resetear slider

    // Llenar contenido
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').textContent = body;

    // Mostrar modal
    letterModal.classList.add('active');

    // Listener del Slider
    // Removemos listener previo clonando (quick fix)
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);

    newSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val == 100) {
            // Abrir sobre
            envelope.classList.add('open');
            // Ocultar slider suavemente
            sliderContainer.style.display = 'none';
        }
    });
}

function updateGridVisual(day) {
    const boxes = document.querySelectorAll('.day-box');
    if (boxes[day - 1]) {
        const box = boxes[day - 1];
        box.classList.remove('locked');
        box.classList.add('unlocked');
        box.innerHTML = `${day} ❤️`;
    }
}

function shakeInput() {
    passInput.classList.add('shake');
    setTimeout(() => passInput.classList.remove('shake'), 500);
}

// --- NOTIFICACIONES CUSTOM ---
function showNotification(msg) {
    notifMessage.textContent = msg;
    notifModal.classList.add('active');
}

if (notifOkBtn) notifOkBtn.addEventListener('click', () => notifModal.classList.remove('active'));

// Cerrar modales
if (closeModal) closeModal.addEventListener('click', () => letterModal.classList.remove('active'));
window.onclick = (event) => {
    if (event.target == loginModal) loginModal.classList.remove('active');
    if (event.target == letterModal) letterModal.classList.remove('active');
    if (event.target == notifModal) notifModal.classList.remove('active');
}

// --- UTILIDAD PARA EL CREADOR (TÚ) ---
// Ejecuta resetJourney() en la consola del navegador antes de enviar el link
// para borrar tus pruebas y que el contador empiece de cero para ella.
window.resetJourney = async () => {
    const p = prompt("Escribe 'BORRAR' para reiniciar el contador de 100 días en la nube:");
    if (p === 'BORRAR') {
        try {
            localStorage.clear();
            await deleteDoc(doc(db, "config", "estado"));
            alert("✅ ¡Historial borrado! El viaje está listo para empezar de nuevo.");
            location.reload();
        } catch (e) {
            console.error(e);
            alert("Error borrando (¿Permisos de Firebase?): " + e.message);
        }
    }
};