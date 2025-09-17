// Datos iniciales
const productosIniciales = [
    { id: 'p1', nombre: 'Auriculares Gamer RGB', precio: 29.99, stock: 10, categoria: 'audio' },
    { id: 'p2', nombre: 'Mouse Óptico 1600 DPI', precio: 19.50, stock: 8, categoria: 'input' },
    { id: 'p3', nombre: 'Teclado Mecánico RGB', precio: 59.00, stock: 5, categoria: 'input' },
    { id: 'p4', nombre: 'Webcam HD 1080p', precio: 45.00, stock: 3, categoria: 'video' },
    { id: 'p5', nombre: 'Monitor LED 24"', precio: 199.99, stock: 2, categoria: 'display' }
];

// Estado de la aplicación
const state = {
    productos: [],
    carrito: [],
    filtrosActivos: false
};

// Local Storage helpers
const LS_KEYS = {
    PRODUCTOS: 'sim_prod_v2',
    CARRITO: 'sim_cart_v2'
};

function saveToLocal(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        return false;
    }
}

function readFromLocal(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
        return fallback;
    }
}

// Sistema de modal
const Modal = {
    element: null,
    titleEl: null,
    messageEl: null,
    confirmCallback: null,

    init() {
        this.element = document.getElementById('confirm-modal');
        this.titleEl = document.getElementById('modal-title');
        this.messageEl = document.getElementById('modal-message');
        
        // Eventos del modal
        document.getElementById('modal-cancel').addEventListener('click', () => this.close());
        document.getElementById('modal-confirm').addEventListener('click', () => this.confirm());
        
        // Cerrar con ESC o click fuera
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        this.element.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });
    },

    show(title, message, callback) {
        this.titleEl.textContent = title;
        this.messageEl.textContent = message;
        this.confirmCallback = callback;
        
        this.element.classList.add('show');
        document.body.style.overflow = 'hidden';
    },

    close() {
        this.element.classList.remove('show');
        document.body.style.overflow = '';
        this.confirmCallback = null;
    },

    confirm() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
        this.close();
    },

    isOpen() {
        return this.element.classList.contains('show');
    }
};

// Validaciones
function validarProducto(nombre, precio, stock) {
    const errors = [];

    if (!nombre || nombre.trim().length < 2) {
        errors.push('El nombre debe tener al menos 2 caracteres');
    }

    if (isNaN(precio) || precio <= 0) {
        errors.push('El precio debe ser mayor a 0');
    }

    if (isNaN(stock) || stock < 0) {
        errors.push('El stock no puede ser negativo');
    }

    // Verificar duplicados
    const nombreNormalizado = nombre.trim().toLowerCase();
    const existe = state.productos.some(p => p.nombre.toLowerCase() === nombreNormalizado);
    if (existe) {
        errors.push('Ya existe un producto con ese nombre');
    }

    return errors;
}

function sanitizarTexto(texto) {
    return texto.trim().replace(/\s+/g, ' ');
}

// Inicialización
function init() {
    // Cargar datos desde localStorage
    state.productos = readFromLocal(LS_KEYS.PRODUCTOS, productosIniciales);
    state.carrito = readFromLocal(LS_KEYS.CARRITO, []);

    // Limpiar carrito de productos que ya no existen
    state.carrito = state.carrito.filter(item =>
        state.productos.some(p => p.id === item.id)
    );

    // Validar integridad de datos
    state.productos = state.productos.filter(p =>
        p.id && p.nombre && typeof p.precio === 'number' && typeof p.stock === 'number'
    );

    // Inicializar modal
    Modal.init();

    renderProductos();
    renderCarrito();
    bindUI();
}

// Renderizado de productos
const productosListEl = document.getElementById('productos-list');

function crearCardProducto(producto) {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-product-id', producto.id);

    const name = document.createElement('div');
    name.className = 'product-name';
    name.textContent = producto.nombre;

    const price = document.createElement('div');
    price.className = 'product-price';
    price.textContent = `$${Number(producto.precio).toFixed(2)}`;

    const stock = document.createElement('div');
    stock.className = 'product-stock';

    if (producto.stock === 0) {
        stock.textContent = 'Sin stock';
        stock.classList.add('stock-empty');
    } else if (producto.stock <= 3) {
        stock.textContent = `¡Últimas ${producto.stock} unidades!`;
        stock.classList.add('stock-low');
    } else {
        stock.textContent = `Stock: ${producto.stock}`;
    }

    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = producto.stock > 0 ? 'Añadir al carrito' : 'Sin stock';
    btn.disabled = producto.stock === 0;
    btn.dataset.productId = producto.id;

    card.append(name, price, stock, btn);
    return card;
}

function renderProductos(lista = null) {
    const productosAMostrar = lista || state.productos;
    productosListEl.innerHTML = '';

    if (productosAMostrar.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">📦</div>
            <p>${state.filtrosActivos ? 'No hay productos que coincidan con los filtros' : 'No hay productos disponibles'}</p>
        `;
        productosListEl.appendChild(emptyState);
        return;
    }

    productosAMostrar.forEach(p => {
        productosListEl.appendChild(crearCardProducto(p));
    });
}

// Funciones del carrito
function agregarAlCarrito(productId, cantidad = 1) {
    const producto = state.productos.find(p => p.id === productId);
    if (!producto) {
        return mostrarMsg('#cart-msg', 'Producto no encontrado', 'error');
    }

    if (producto.stock < cantidad) {
        return mostrarMsg('#cart-msg', 'Stock insuficiente', 'error');
    }

    const item = state.carrito.find(ci => ci.id === productId);
    if (item) {
        if (producto.stock < item.cantidad + cantidad) {
            return mostrarMsg('#cart-msg', 'No hay suficiente stock para agregar más unidades', 'error');
        }
        item.cantidad += cantidad;
    } else {
        state.carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            precio: producto.precio,
            cantidad: cantidad
        });
    }

    producto.stock -= cantidad;
    persistState();
    renderProductos();
    renderCarrito();
    mostrarMsg('#cart-msg', `${producto.nombre} agregado al carrito`, 'success');
}

function cambiarCantidadCarrito(productId, nuevaCantidad) {
    const item = state.carrito.find(ci => ci.id === productId);
    const producto = state.productos.find(p => p.id === productId);

    if (!item || !producto) return;

    const diferencia = nuevaCantidad - item.cantidad;

    if (diferencia > 0 && producto.stock < diferencia) {
        return mostrarMsg('#cart-msg', 'Stock insuficiente', 'error');
    }

    if (nuevaCantidad <= 0) {
        return removerDelCarrito(productId);
    }

    producto.stock -= diferencia;
    item.cantidad = nuevaCantidad;

    persistState();
    renderProductos();
    renderCarrito();
}

function removerDelCarrito(productId) {
    const idx = state.carrito.findIndex(ci => ci.id === productId);
    if (idx === -1) return;

    const item = state.carrito[idx];
    const producto = state.productos.find(p => p.id === productId);

    if (producto) {
        producto.stock += item.cantidad;
    }

    state.carrito.splice(idx, 1);
    persistState();
    renderProductos();
    renderCarrito();
    mostrarMsg('#cart-msg', 'Producto removido del carrito', 'success');
}

function vaciarCarrito() {
    if (state.carrito.length === 0) {
        return mostrarMsg('#cart-msg', 'El carrito ya está vacío', 'error');
    }

    Modal.show(
        'Vaciar Carrito',
        '¿Estás seguro de que quieres vaciar el carrito? Esta acción no se puede deshacer.',
        () => {
            state.carrito.forEach(item => {
                const producto = state.productos.find(p => p.id === item.id);
                if (producto) {
                    producto.stock += item.cantidad;
                }
            });

            state.carrito = [];
            persistState();
            renderProductos();
            renderCarrito();
            mostrarMsg('#cart-msg', 'Carrito vaciado correctamente', 'success');
        }
    );
}

function totalCarrito() {
    return state.carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
}

function contadorCarrito() {
    return state.carrito.reduce((acc, item) => acc + item.cantidad, 0);
}

// Renderizado del carrito
const carritoListEl = document.getElementById('carrito-list');
const cartCountEl = document.getElementById('cart-count');
const cartTotalEl = document.getElementById('cart-total');

function renderCarrito() {
    carritoListEl.innerHTML = '';

    if (state.carrito.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-state-icon">🛍️</div>
            <p>Tu carrito está vacío</p>
        `;
        carritoListEl.appendChild(emptyState);
    } else {
        state.carrito.forEach(item => {
            const row = document.createElement('div');
            row.className = 'cart-item';
            row.setAttribute('data-cart-item', item.id);

            const meta = document.createElement('div');
            meta.className = 'meta';

            const productName = document.createElement('div');
            productName.className = 'product-name';
            productName.textContent = item.nombre;

            const productDetails = document.createElement('div');
            productDetails.className = 'product-details';
            productDetails.textContent = `${Number(item.precio).toFixed(2)} × ${item.cantidad} = ${(item.precio * item.cantidad).toFixed(2)}`;

            const quantityControls = document.createElement('div');
            quantityControls.className = 'quantity-controls';
            quantityControls.innerHTML = `
                <button class="quantity-btn" data-action="decrease" data-product-id="${item.id}">-</button>
                <span class="quantity-display">${item.cantidad}</span>
                <button class="quantity-btn" data-action="increase" data-product-id="${item.id}">+</button>
            `;

            meta.append(productName, productDetails, quantityControls);

            const actions = document.createElement('div');
            const btnRem = document.createElement('button');
            btnRem.className = 'btn small danger';
            btnRem.textContent = '🗑️';
            btnRem.dataset.cartId = item.id;
            btnRem.title = 'Eliminar producto';

            actions.appendChild(btnRem);
            row.append(meta, actions);
            carritoListEl.appendChild(row);
        });
    }

    cartCountEl.textContent = contadorCarrito();
    cartTotalEl.textContent = totalCarrito().toFixed(2);
}

// Sistema de mensajes
function mostrarMsg(selector, texto, tipo = 'error') {
    const el = document.querySelector(selector);
    if (!el) return;

    el.textContent = texto;
    el.className = `msg ${tipo}`;
    el.classList.add('show');

    // Auto-ocultar después de 4 segundos
    setTimeout(() => {
        el.classList.remove('show');
    }, 4000);
}

function limpiarMensaje(selector) {
    const el = document.querySelector(selector);
    if (el) {
        el.classList.remove('show');
        el.textContent = '';
    }
}

// Persistencia
function persistState() {
    const guardadoProductos = saveToLocal(LS_KEYS.PRODUCTOS, state.productos);
    const guardadoCarrito = saveToLocal(LS_KEYS.CARRITO, state.carrito);

    return guardadoProductos && guardadoCarrito;
}

// Funciones de búsqueda y filtrado
function buscarProducto(nombre) {
    if (!nombre || nombre.trim().length === 0) {
        return mostrarMsg('#buscar-msg', 'Debes escribir un nombre para buscar', 'error');
    }

    const nombreBuscado = sanitizarTexto(nombre).toLowerCase();
    const encontrado = state.productos.find(p =>
        p.nombre.toLowerCase() === nombreBuscado
    );

    if (encontrado) {
        mostrarMsg('#buscar-msg',
            `✅ Encontrado: ${encontrado.nombre} - ${encontrado.precio.toFixed(2)} (Stock: ${encontrado.stock})`,
            'success'
        );

        // Resaltar el producto encontrado
        resaltarProducto(encontrado.id);
    } else {
        mostrarMsg('#buscar-msg', '❌ No se encontró el producto con ese nombre exacto', 'error');
    }
}

function filtrarProductos(nombre, precioMax) {
    let filtrados = [...state.productos];
    let criteriosAplicados = [];

    // Filtrar por nombre parcial
    if (nombre && nombre.trim().length > 0) {
        const palabraClave = sanitizarTexto(nombre).toLowerCase();
        filtrados = filtrados.filter(p =>
            p.nombre.toLowerCase().includes(palabraClave)
        );
        criteriosAplicados.push(`nombre contiene "${nombre}"`);
    }

    // Filtrar por precio máximo
    if (!isNaN(precioMax) && precioMax > 0) {
        filtrados = filtrados.filter(p => p.precio <= precioMax);
        criteriosAplicados.push(`precio ≤ ${precioMax}`);
    }

    state.filtrosActivos = criteriosAplicados.length > 0;

    if (state.filtrosActivos) {
        if (filtrados.length === 0) {
            mostrarMsg('#filtro-msg',
                `❌ No hay productos que cumplan: ${criteriosAplicados.join(' y ')}`,
                'error'
            );
        } else {
            mostrarMsg('#filtro-msg',
                `✅ ${filtrados.length} producto(s) encontrado(s): ${criteriosAplicados.join(' y ')}`,
                'success'
            );
        }
    }

    renderProductos(filtrados);
}

function limpiarFiltros() {
    state.filtrosActivos = false;
    document.getElementById('filtro-nombre').value = '';
    document.getElementById('filtro-precio').value = '';
    renderProductos();
    mostrarMsg('#filtro-msg', '🔄 Filtros limpiados', 'success');
}

function resaltarProducto(productId) {
    // Remover resaltado previo
    document.querySelectorAll('.card.highlight').forEach(card => {
        card.classList.remove('highlight');
    });

    // Resaltar producto encontrado
    const productCard = document.querySelector(`[data-product-id="${productId}"]`);
    if (productCard) {
        productCard.classList.add('highlight');
        productCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
            productCard.classList.remove('highlight');
        }, 3000);
    }
}

// Event bindings
function bindUI() {
    // Añadir al carrito
    productosListEl.addEventListener('click', function (e) {
        const btn = e.target.closest('button[data-product-id]');
        if (!btn || btn.disabled) return;

        btn.disabled = true;
        agregarAlCarrito(btn.dataset.productId, 1);

        setTimeout(() => {
            btn.disabled = false;
        }, 500);
    });

    // Controles de cantidad en carrito
    carritoListEl.addEventListener('click', function (e) {
        const quantityBtn = e.target.closest('.quantity-btn');
        const removeBtn = e.target.closest('button[data-cart-id]');

        if (quantityBtn) {
            const productId = quantityBtn.dataset.productId;
            const action = quantityBtn.dataset.action;
            const currentItem = state.carrito.find(item => item.id === productId);

            if (currentItem) {
                const newQuantity = action === 'increase'
                    ? currentItem.cantidad + 1
                    : currentItem.cantidad - 1;

                cambiarCantidadCarrito(productId, newQuantity);
            }
        }

        if (removeBtn) {
            removerDelCarrito(removeBtn.dataset.cartId);
        }
    });

    // Formulario nuevo producto
    const form = document.getElementById('producto-form');
    form.addEventListener('submit', function (ev) {
        ev.preventDefault();

        const nombre = sanitizarTexto(document.getElementById('input-nombre').value);
        const precio = parseFloat(document.getElementById('input-precio').value);
        const stock = parseInt(document.getElementById('input-stock').value, 10);

        // Validar datos
        const errores = validarProducto(nombre, precio, stock);
        if (errores.length > 0) {
            return mostrarMsg('#form-msg', errores[0], 'error');
        }

        // Crear nuevo producto
        const newProd = {
            id: 'p' + Date.now() + Math.random().toString(36).substr(2, 5),
            nombre,
            precio,
            stock
        };

        state.productos.push(newProd);

        if (persistState()) {
            renderProductos();
            form.reset();
            document.getElementById('input-stock').value = 5; // Resetear a valor por defecto
            mostrarMsg('#form-msg', `✅ ${nombre} agregado al catálogo`, 'success');
        } else {
            mostrarMsg('#form-msg', 'Error al guardar el producto', 'error');
        }
    });

    // Limpiar mensajes al escribir en inputs
    form.addEventListener('input', () => limpiarMensaje('#form-msg'));

    // Botones carrito
    document.getElementById('btn-clear-cart').addEventListener('click', vaciarCarrito);

    document.getElementById('btn-save-local').addEventListener('click', function () {
        if (persistState()) {
            mostrarMsg('#cart-msg', '💾 Datos guardados correctamente', 'success');
        } else {
            mostrarMsg('#cart-msg', 'Error al guardar los datos', 'error');
        }
    });

    // Búsqueda
    document.getElementById('btn-buscar').addEventListener('click', function () {
        const nombre = document.getElementById('buscar-nombre').value;
        buscarProducto(nombre);
    });

    // Enter en campo de búsqueda
    document.getElementById('buscar-nombre').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            buscarProducto(this.value);
        }
    });

    // Limpiar mensaje de búsqueda al escribir
    document.getElementById('buscar-nombre').addEventListener('input', () => {
        limpiarMensaje('#buscar-msg');
    });

    // Filtros
    document.getElementById('btn-filtrar').addEventListener('click', function () {
        const nombre = document.getElementById('filtro-nombre').value;
        const precio = parseFloat(document.getElementById('filtro-precio').value);
        filtrarProductos(nombre, precio);
    });

    document.getElementById('btn-reset-filtro').addEventListener('click', limpiarFiltros);

    // Limpiar mensajes de filtro al escribir
    document.getElementById('filtro-nombre').addEventListener('input', () => {
        limpiarMensaje('#filtro-msg');
    });

    document.getElementById('filtro-precio').addEventListener('input', () => {
        limpiarMensaje('#filtro-msg');
    });

    // Aplicar filtros con Enter
    document.getElementById('filtro-nombre').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            document.getElementById('btn-filtrar').click();
        }
    });

    document.getElementById('filtro-precio').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            document.getElementById('btn-filtrar').click();
        }
    });

    // Atajos de teclado
    window.addEventListener('keydown', (e) => {
        // Ctrl+Shift+V: vaciar carrito
        if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
            e.preventDefault();
            vaciarCarrito();
        }

        // Ctrl+S: guardar
        if (e.ctrlKey && e.code === 'KeyS') {
            e.preventDefault();
            document.getElementById('btn-save-local').click();
        }

        // Escape: limpiar filtros
        if (e.code === 'Escape' && !Modal.isOpen()) {
            limpiarFiltros();
            document.getElementById('buscar-nombre').value = '';
            limpiarMensaje('#buscar-msg');
        }
    });
}

// Arranque de la aplicación
document.addEventListener('DOMContentLoaded', function () {
    try {
        init();
    } catch (error) {
        // Mostrar error en la interfaz en lugar de alert
        mostrarMsg('#cart-msg', 'Error al cargar la aplicación. Por favor, recarga la página.', 'error');
    }
});

// Guardar automáticamente cada 30 segundos
setInterval(() => {
    if (state.productos.length > 0 || state.carrito.length > 0) {
        persistState();
    }
}, 30000);