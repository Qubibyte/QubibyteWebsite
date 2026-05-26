/* Blocking boot — default off; HMI enables per session via postMessage (not stored in repo) */
(function () {
    var on = window.QUBIBYTE_SOFTWARE_MODE === true || window.QUBIBYTE_SOFTWARE_MODE === '1';
    try {
        if (!on) {
            on = sessionStorage.getItem('qubibyte-software-mode') === '1' ||
                sessionStorage.getItem('qubibyte-pi-mode') === '1';
        }
    } catch (e) {}
    window.QUBIBYTE_SOFTWARE_MODE = on;
})();
