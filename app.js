// Datos predefinidos para la Gift Card (extraídos de la imagen)
const gcOptions = [
    { rec: 1.1, cost: 1.31 }, { rec: 3.1, cost: 3.70 }, { rec: 5.1, cost: 6.10 },
    { rec: 7.1, cost: 8.48 }, { rec: 10.1, cost: 12.06 }, { rec: 15.1, cost: 18.03 },
    { rec: 20.1, cost: 24.00 }, { rec: 25.1, cost: 29.97 }, { rec: 30.1, cost: 35.94 },
    { rec: 35.1, cost: 41.91 }, { rec: 40.1, cost: 47.87 }, { rec: 45.1, cost: 53.84 },
    { rec: 50.1, cost: 59.82 }, { rec: 55.1, cost: 65.79 }, { rec: 60.1, cost: 71.76 },
    { rec: 65.1, cost: 77.73 }, { rec: 70.1, cost: 83.70 }, { rec: 75.1, cost: 89.67 },
    { rec: 80.1, cost: 95.63 }, { rec: 85.1, cost: 101.60 }, { rec: 90.1, cost: 107.58 },
    { rec: 95.1, cost: 113.55 }, { rec: 100.1, cost: 114.32 }, { rec: 110.1, cost: 125.74 },
    { rec: 120.1, cost: 137.16 }, { rec: 130.1, cost: 148.58 }, { rec: 140.1, cost: 160.00 },
    { rec: 150.1, cost: 171.42 }, { rec: 160.1, cost: 182.84 }, { rec: 170.1, cost: 194.27 },
    { rec: 180.1, cost: 205.69 }, { rec: 190.1, cost: 217.11 }, { rec: 200.1, cost: 228.53 }
];

// Estado global de la aplicación
const state = {
    bdvUsedLimit: 0,
    bdvMaxLimit: 2000,
    unusedBalanceBs: 0,
    unusedBalanceUsd: 0,
    totalProfit: 0,
    history: []
};

// Variables calculadas en memoria actual
let calcState = {
    realReceivedBs: 0,
    totalAvailableBs: 0,
    bdvUsdToBuy: 0,
    bdvCostBs: 0,
    newUnusedBalanceBs: 0,
    zinli: { deposit: 0, costBdv: 0, profit: 0, finalUsdt: 0, newUnusedUsd: 0 },
    gc: { selected: null, costBdv: 0, profit: 0, finalUsdt: 0, newUnusedUsd: 0 }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateHeaderUI();
    bindEvents();
    renderHistory();
    calculateFlow(); // Initial calculate
});

// Cargar estado desde LocalStorage
function loadState() {
    const saved = localStorage.getItem('arbitrajjeState');
    if (saved) {
        Object.assign(state, JSON.parse(saved));
    }
}

// Guardar estado
function saveState() {
    localStorage.setItem('arbitrajjeState', JSON.stringify(state));
    updateHeaderUI();
}

// Bind Events
function bindEvents() {
    const inputs = document.querySelectorAll('input:not(.no-calc), select');
    inputs.forEach(el => el.addEventListener('input', calculateFlow));

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            e.target.classList.add('active');
            document.getElementById('tab-' + e.target.dataset.tab).classList.remove('hidden');
        });
    });

    // Buttons
    document.getElementById('btnResetOp').addEventListener('click', resetOperacion);
    document.getElementById('btnResetDay').addEventListener('click', resetDia);
    document.getElementById('btnGuardarOp').addEventListener('click', guardarOperacion);
}

const formatBs = (num) => new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0) + ' Bs';
const formatUsd = (num) => '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

function updateHeaderUI() {
    document.getElementById('valBdvLimit').textContent = `$${state.bdvUsedLimit} / $${state.bdvMaxLimit}`;
    document.getElementById('valUnusedBs').textContent = formatBs(state.unusedBalanceBs);
    document.getElementById('valUnusedUsd').textContent = formatUsd(state.unusedBalanceUsd);
    
    const profitEl = document.getElementById('valTotalProfit');
    profitEl.textContent = formatUsd(state.totalProfit);
    profitEl.style.color = state.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)';
}

// Flujo Principal de Cálculo
function calculateFlow() {
    // 1. Lectura de inputs Binance
    const usdtVenta = parseFloat(document.getElementById('inUsdtVenta').value) || 0;
    const tasaVenta = parseFloat(document.getElementById('inTasaVenta').value) || 0;
    const binanceFee = parseFloat(document.getElementById('inBinanceFee').value) || 0;

    // Calculo Binance
    // "(Monto - 0.02) * Tasa"
    calcState.realReceivedBs = Math.max(0, (usdtVenta - binanceFee)) * tasaVenta;
    document.getElementById('resBsRecibidos').textContent = formatBs(calcState.realReceivedBs);

    // 2. Lectura inputs BDV
    const tasaBdv = parseFloat(document.getElementById('inTasaBdv').value) || 0;
    const bdvFee = parseFloat(document.getElementById('inBdvFee').value) || 0;

    calcState.totalAvailableBs = calcState.realReceivedBs + state.unusedBalanceBs;
    document.getElementById('resBsTotales').textContent = formatBs(calcState.totalAvailableBs);

    // Calculo de divisas a comprar (Enteros)
    let suggestUsd = 0;
    let bdvLimitExceeded = false;
    let bdvLimitSuggestion = "";
    
    if (calcState.totalAvailableBs > 0 && tasaBdv > 0) {
        // Encontrar maximo N tal que (N + bdvFee)*tasaBdv <= totalAvailableBs
        suggestUsd = Math.floor((calcState.totalAvailableBs / tasaBdv) - bdvFee);
        if (suggestUsd < 0) suggestUsd = 0;
        
        // Verificar limite diario
        const availableLimit = state.bdvMaxLimit - state.bdvUsedLimit;
        if (suggestUsd > availableLimit) {
            suggestUsd = availableLimit;
            bdvLimitExceeded = true;
            
            if (tasaVenta > 0) {
                const targetBs = (availableLimit + bdvFee) * tasaBdv;
                const neededBs = targetBs - state.unusedBalanceBs;
                if (neededBs > 0) {
                    const targetUsdt = (neededBs / tasaVenta) + binanceFee;
                    bdvLimitSuggestion = `Para limitarte justo a ese monto, te sugerimos vender máximo <strong>${targetUsdt.toFixed(2)} USDT</strong> en Binance.`;
                } else {
                    bdvLimitSuggestion = `(Tu saldo sobrante en Bs ya cubre tu límite restante de $ sin necesitar vender USDT).`;
                }
            } else {
                bdvLimitSuggestion = "Ingresa la tasa de Binance para sugerirte el monto en USDT a vender.";
            }
        }
    }

    // Toggle Alerta
    const alertEl = document.getElementById('limitExceededAlert');
    alertEl.classList.toggle('hidden', !bdvLimitExceeded);
    if (bdvLimitExceeded) {
        document.getElementById('limitSuggestion').innerHTML = bdvLimitSuggestion;
    }

    calcState.bdvUsdToBuy = suggestUsd;
    calcState.bdvCostBs = (suggestUsd > 0) ? (suggestUsd + bdvFee) * tasaBdv : 0;
    calcState.newUnusedBalanceBs = calcState.totalAvailableBs - calcState.bdvCostBs;

    document.getElementById('resUsdComprar').textContent = '$' + suggestUsd;
    document.getElementById('resBsCostoOperacion').textContent = formatBs(calcState.bdvCostBs);
    document.getElementById('resBsProxima').textContent = formatBs(calcState.newUnusedBalanceBs);

    const totalUsdAvailable = suggestUsd + state.unusedBalanceUsd;

    // Actualiza variables compartidas para las Pestañas
    document.getElementById('zinliBdvDisponible').textContent = formatUsd(totalUsdAvailable);
    document.getElementById('gcBdvDisponible').textContent = formatUsd(totalUsdAvailable);

    calculateZinli(usdtVenta, totalUsdAvailable);
    calculateGiftCard(usdtVenta, totalUsdAvailable);
}

// Calculo pestaña Zinli
function calculateZinli(initialUsdt, maxUsdAvailable) {
    const zinliFeePerc = parseFloat(document.getElementById('inZinliFee').value) / 100 || 0;
    const bankFeePerc = parseFloat(document.getElementById('inZinliBankFee').value) / 100 || 0;
    const binanceRetFeePerc = parseFloat(document.getElementById('inBinanceReturnFee').value) / 100 || 0;

    let inZinliInput = document.getElementById('inZinliDeposit');
    let deposit = parseFloat(inZinliInput.value);

    // Si el usuario no ha puesto nada, sugerir lo máximo posible
    let maxDeposit = maxUsdAvailable / ((1 + zinliFeePerc) * (1 + bankFeePerc));
    maxDeposit = Math.floor(maxDeposit * 100) / 100; // Round down to 2 decimals
    
    // Auto-fill si está vacio
    if (!inZinliInput.value && maxDeposit > 0) {
        deposit = maxDeposit;
        inZinliInput.placeholder = `Sugerido: ${maxDeposit}`;
    } else {
        deposit = deposit || 0;
    }

    // Costo para bdV: Si quiero $X en Zinli. 
    // La plataforma me cobra X + (X * zinliFee). Es decir X * (1 + zinliFee)
    // El banco le suma 2.5% a eso.
    const platformCharge = deposit * (1 + zinliFeePerc);
    const totalBdvCost = platformCharge * (1 + bankFeePerc);

    const zinliLlega = deposit; // Asumiendo que recargas X y recibes X entero.
    const finalUsdt = zinliLlega * (1 - binanceRetFeePerc);

    const newUnusedUsd = maxUsdAvailable - totalBdvCost;

    calcState.zinli.deposit = deposit;
    calcState.zinli.costBdv = totalBdvCost;
    calcState.zinli.finalUsdt = finalUsdt;
    // La ganancia individual es el retorno final más la diferencia de saldo USD sobrante
    calcState.zinli.profit = finalUsdt + (newUnusedUsd - state.unusedBalanceUsd) - initialUsdt;
    calcState.zinli.newUnusedUsd = newUnusedUsd;

    document.getElementById('zinliCostoBdv').textContent = formatUsd(totalBdvCost);
    if (totalBdvCost > maxUsdAvailable && deposit > 0) {
        document.getElementById('zinliCostoBdv').classList.add('txt-danger');
    } else {
        document.getElementById('zinliCostoBdv').classList.remove('txt-danger');
    }

    document.getElementById('zinliLlega').textContent = formatUsd(zinliLlega);
    document.getElementById('zinliFinalUsdt').textContent = formatUsd(finalUsdt);
    
    const profitEl = document.getElementById('zinliProfit');
    profitEl.textContent = formatUsd(calcState.zinli.profit);
    profitEl.className = calcState.zinli.profit >= 0 ? 'txt-success' : 'txt-danger';
}

function calculateGiftCard(initialUsdt, maxUsdAvailable) {
    const gcBankFeePerc = parseFloat(document.getElementById('inGcBankFee').value) / 100 || 0;
    const select = document.getElementById('inGcSelect');
    
    // Guardar selección actual
    const currentVal = select.value;
    
    // Filtrar y popular opciones según el disponible
    select.innerHTML = '';
    let hasValidOptions = false;
    
    gcOptions.forEach((opt, index) => {
        const costBdv = opt.cost * (1 + gcBankFeePerc);
        if (costBdv <= maxUsdAvailable) {
            hasValidOptions = true;
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${opt.rec} USD --> ${opt.cost} USD (Costo)`;
            select.appendChild(option);
        }
    });
    
    if (!hasValidOptions) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "Saldo insuficiente para Gift Cards";
        select.appendChild(option);
        
        calcState.gc.selected = null;
        calcState.gc.costBdv = 0;
        calcState.gc.finalUsdt = 0;
        calcState.gc.profit = 0;
        document.getElementById('gcCostoBdv').textContent = formatUsd(0);
        document.getElementById('gcFinalUsdt').textContent = formatUsd(0);
        document.getElementById('gcProfit').textContent = formatUsd(0);
        return;
    }

    // Restaurar selección o seleccionar la más alta posible (la última insertada)
    if (currentVal && Array.from(select.options).some(o => o.value === currentVal)) {
        select.value = currentVal;
    } else {
        select.selectedIndex = select.options.length - 1; 
    }

    const selectedOpt = gcOptions[select.value];
    if (!selectedOpt) return;

    const totalBdvCost = selectedOpt.cost * (1 + gcBankFeePerc);
    const finalUsdt = selectedOpt.rec; // Monto de gift card

    const newUnusedUsd = maxUsdAvailable - totalBdvCost;

    calcState.gc.selected = selectedOpt;
    calcState.gc.costBdv = totalBdvCost;
    calcState.gc.finalUsdt = finalUsdt;
    // La ganancia individual es el retorno final más la diferencia de saldo USD sobrante
    calcState.gc.profit = finalUsdt + (newUnusedUsd - state.unusedBalanceUsd) - initialUsdt;
    calcState.gc.newUnusedUsd = newUnusedUsd;

    document.getElementById('gcCostoBdv').textContent = formatUsd(totalBdvCost);
    if (totalBdvCost > maxUsdAvailable) {
        document.getElementById('gcCostoBdv').classList.add('txt-danger');
    } else {
        document.getElementById('gcCostoBdv').classList.remove('txt-danger');
    }

    document.getElementById('gcFinalUsdt').textContent = formatUsd(finalUsdt);

    const profitEl = document.getElementById('gcProfit');
    profitEl.textContent = formatUsd(calcState.gc.profit);
    profitEl.className = calcState.gc.profit >= 0 ? 'txt-success' : 'txt-danger';
}

function guardarOperacion() {
    const usdtVenta = parseFloat(document.getElementById('inUsdtVenta').value) || 0;
    const tasaVenta = parseFloat(document.getElementById('inTasaVenta').value) || 0;

    if (calcState.bdvUsdToBuy === 0 && state.unusedBalanceUsd === 0) {
        alert("No tienes divisas ni compraste nuevas en esta operación.");
        return;
    }

    // Determinar qué tab está activa para guardar historial y verificar errores
    const zinliActive = document.querySelector('.tab-btn[data-tab="zinli"]').classList.contains('active');
    
    let pathName = "";
    let finalReceived = 0;
    let profit = 0;
    let newUnusedUsd = 0;

    const totalUsdAvailable = calcState.bdvUsdToBuy + state.unusedBalanceUsd;

    if (zinliActive) {
        if (calcState.zinli.costBdv > totalUsdAvailable) {
            alert("Error: El costo del depósito en Zinli supera tus Divisas totales disponibles.");
            return;
        }
        pathName = "Zinli";
        finalReceived = calcState.zinli.finalUsdt;
        profit = calcState.zinli.profit;
        newUnusedUsd = calcState.zinli.newUnusedUsd;
    } else {
        if (calcState.gc.costBdv > totalUsdAvailable) {
            alert("Error: El costo de la Gift Card supera tus Divisas totales disponibles.");
            return;
        }
        pathName = "Gift Card";
        finalReceived = calcState.gc.finalUsdt;
        profit = calcState.gc.profit;
        newUnusedUsd = calcState.gc.newUnusedUsd;
    }

    // Actualizar Estado Global
    state.bdvUsedLimit += calcState.bdvUsdToBuy;
    state.unusedBalanceBs = calcState.newUnusedBalanceBs;
    state.unusedBalanceUsd = newUnusedUsd;
    state.totalProfit += profit;

    const record = {
        date: new Date().toLocaleString('es-VE'),
        usdtVenta: usdtVenta,
        tasaVenta: tasaVenta,
        bdvBought: calcState.bdvUsdToBuy,
        path: pathName,
        finalReceived: finalReceived,
        profit: profit
    };

    state.history.unshift(record); // Prepend
    saveState();
    renderHistory();
    
    alert("Operación guardada con éxito. Los Límites y Saldos han sido actualizados.");
    resetOperacion();
}

function renderHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    
    state.history.forEach((h) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${h.date}</td>
            <td>$${h.usdtVenta}</td>
            <td>${h.tasaVenta} Bs</td>
            <td>$${h.bdvBought}</td>
            <td>${h.path}</td>
            <td>$${h.finalReceived.toFixed(2)}</td>
            <td class="${h.profit >= 0 ? 'txt-success' : 'txt-danger'}"><strong>$${h.profit.toFixed(2)}</strong></td>
        `;
        tbody.appendChild(tr);
    });
}

function resetOperacion() {
    document.getElementById('inUsdtVenta').value = '';
    document.getElementById('inTasaVenta').value = '';
    document.getElementById('inTasaBdv').value = '';
    document.getElementById('inZinliDeposit').value = '';
    
    calculateFlow();
}

function resetDia() {
    if(confirm("¿Estás seguro de que quieres borrar el límite diario, los saldos sobrantes y el historial general?")) {
        state.bdvUsedLimit = 0;
        state.unusedBalanceBs = 0;
        state.unusedBalanceUsd = 0;
        state.totalProfit = 0;
        state.history = [];
        saveState();
        renderHistory();
        calculateFlow();
    }
}
