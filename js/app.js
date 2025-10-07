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

// Cargar productos desde JSON
async function cargarProductosIniciales() {
    try {
        const response = await fetch('productos.json');
        if (!response.ok) {
            throw new Error('No se pudo cargar el archivo productos.json');
        }
        const productos = await response.json();
        return productos;
    } catch (error) { 
        Swal.fire({
            icon: 'error',
            title: 'Error al cargar productos',
            text: 'No se pudieron cargar los productos iniciales. Se iniciará con productos vacíos.',
            confirmButtonText: 'Aceptar'
        });
        
        return [];
    }
}

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
async function init() {
    // Mostrar loading mientras carga
    Swal.fire({
        title: 'Cargando productos...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    // Intentar cargar desde localStorage primero
    const productosGuardados = readFromLocal(LS_KEYS.PRODUCTOS, null);
    
    if (productosGuardados && productosGuardados.length > 0) {
        state.productos = productosGuardados;
    } else {
        // Si no hay productos guardados, cargar desde JSON
        state.productos = await cargarProductosIniciales();
        // Guardar en localStorage
        if (state.productos.length > 0) {
            saveToLocal(LS_KEYS.PRODUCTOS, state.productos);
        }
    }

    state.carrito = readFromLocal(LS_KEYS.CARRITO, []);

    // Limpiar carrito de productos que ya no existen
    state.carrito = state.carrito.filter(item =>
        state.productos.some(p => p.id === item.id)
    );

    // Validar integridad de datos
    state.productos = state.productos.filter(p =>
        p.id && p.nombre && typeof p.precio === 'number' && typeof p.stock === 'number'
    );

    // Cerrar loading
    Swal.close();

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
        Swal.fire({
            icon: 'error',
            title: 'Producto no encontrado',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
        return;
    }

    if (producto.stock < cantidad) {
        Swal.fire({
            icon: 'warning',
            title: 'Stock insuficiente',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });
        return;
    }

    const item = state.carrito.find(ci => ci.id === productId);
    if (item) {
        if (producto.stock < item.cantidad + cantidad) {
            Swal.fire({
                icon: 'warning',
                title: 'Stock insuficiente',
                text: 'No hay suficiente stock para agregar más unidades',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
            return;
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
    
    Swal.fire({
        icon: 'success',
        title: `${producto.nombre} agregado`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
}

function cambiarCantidadCarrito(productId, nuevaCantidad) {
    const item = state.carrito.find(ci => ci.id === productId);
    const producto = state.productos.find(p => p.id === productId);

    if (!item || !producto) return;

    const diferencia = nuevaCantidad - item.cantidad;

    if (diferencia > 0 && producto.stock < diferencia) {
        Swal.fire({
            icon: 'warning',
            title: 'Stock insuficiente',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        return;
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
    
    Swal.fire({
        icon: 'info',
        title: 'Producto removido',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
}

function vaciarCarrito() {
    if (state.carrito.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'El carrito ya está vacío',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true
        });
        return;
    }

    Swal.fire({
        title: '¿Vaciar carrito?',
        text: 'Se devolverán todos los productos al stock. Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, vaciar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
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
            
            Swal.fire({
                icon: 'success',
                title: 'Carrito vaciado',
                text: 'Todos los productos han sido devueltos al stock',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        }
    });
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

// Resetear datos a los valores del JSON
async function resetearDatos() {
    Swal.fire({
        title: '¿Quieres borrar todos los datos?',
        html: `
            <p>Esta acción:</p>
            <ul style="text-align: left; padding-left: 20px;">
                <li>Cargará todos los productos del archivo JSON</li>
                <li>Vaciará el carrito completamente</li>
                <li>Eliminará todos los productos agregados desde la pagina</li>
            </ul>
            <p><strong>Esta acción no se puede deshacer.</strong></p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Mostrar loading
            Swal.fire({
                title: 'Borrando los datos...',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // Cargar productos desde JSON
            const productosOriginales = await cargarProductosIniciales();
            
            if (productosOriginales.length > 0) {
                // Resetear estado
                state.productos = productosOriginales;
                state.carrito = [];
                state.filtrosActivos = false;

                // Guardar en localStorage
                saveToLocal(LS_KEYS.PRODUCTOS, state.productos);
                saveToLocal(LS_KEYS.CARRITO, state.carrito);

                // Limpiar filtros visuales
                document.getElementById('filtro-nombre').value = '';
                document.getElementById('filtro-precio').value = '';
                document.getElementById('buscar-nombre').value = '';
                limpiarMensaje('#buscar-msg');
                limpiarMensaje('#filtro-msg');

                // Re-renderizar
                renderProductos();
                renderCarrito();

                Swal.fire({
                    icon: 'success',
                    title: 'Datos borrados',
                    text: 'Se han borrado los datos correctamente',
                    timer: 3000,
                    timerProgressBar: true
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudieron borrar los datos',
                    confirmButtonText: 'Aceptar'
                });
            }
        }
    });
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
        mostrarMsg('#buscar-msg', 'Debes escribir un nombre para buscar', 'error');
        return;
    }

    const nombreBuscado = sanitizarTexto(nombre).toLowerCase();
    const encontrado = state.productos.find(p =>
        p.nombre.toLowerCase() === nombreBuscado
    );

    if (encontrado) {
        Swal.fire({
            icon: 'success',
            title: 'Producto encontrado',
            html: `
                <div style="text-align: left; padding: 10px;">
                    <p><strong>Nombre:</strong> ${encontrado.nombre}</p>
                    <p><strong>Precio:</strong> $${encontrado.precio.toFixed(2)}</p>
                    <p><strong>Stock:</strong> ${encontrado.stock} unidades</p>
                </div>
            `,
            confirmButtonText: 'Aceptar'
        });

        // Resaltar el producto encontrado
        resaltarProducto(encontrado.id);
    } else {
        Swal.fire({
            icon: 'error',
            title: 'No encontrado',
            text: 'No se encontró el producto con ese nombre exacto',
            confirmButtonText: 'Aceptar'
        });
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
        criteriosAplicados.push(`precio ≤ $${precioMax}`);
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
            Swal.fire({
                icon: 'error',
                title: 'Error de validación',
                text: errores[0],
                confirmButtonText: 'Aceptar'
            });
            return;
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
            document.getElementById('input-stock').value = 5;
            
            Swal.fire({
                icon: 'success',
                title: 'Producto agregado',
                text: `${nombre} se ha agregado al catálogo correctamente`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo guardar el producto',
                confirmButtonText: 'Aceptar'
            });
        }
    });

    // Limpiar mensajes al escribir en inputs
    form.addEventListener('input', () => limpiarMensaje('#form-msg'));

    // Botones carrito
    document.getElementById('btn-clear-cart').addEventListener('click', vaciarCarrito);

    document.getElementById('btn-save-local').addEventListener('click', function () {
        if (persistState()) {
            Swal.fire({
                icon: 'success',
                title: 'Guardado',
                text: 'Datos guardados correctamente',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron guardar los datos',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 2000,
                timerProgressBar: true
            });
        }
    });

    // Botón resetear datos
    document.getElementById('btn-reset-data').addEventListener('click', resetearDatos);

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
        if (e.code === 'Escape') {
            limpiarFiltros();
            document.getElementById('buscar-nombre').value = '';
            limpiarMensaje('#buscar-msg');
        }
    });
}

// Arranque de la aplicación
document.addEventListener('DOMContentLoaded', async function () {
    try {
        await init();
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error crítico',
            text: 'No se pudo cargar la aplicación. Por favor, recarga la página.',
            confirmButtonText: 'Recargar',
            allowOutsideClick: false
        }).then(() => {
            window.location.reload();
        });
    }
});

// Guardar automáticamente cada 30 segundos
setInterval(() => {
    if (state.productos.length > 0 || state.carrito.length > 0) {
        persistState();
    }
}, 30000);