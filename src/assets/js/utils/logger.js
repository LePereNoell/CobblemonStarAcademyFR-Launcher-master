/**
 * logger.js
 * Logger centralisé pour l'application Cobblemon Star Academy FR Launcher
 */

const log = require('electron-log');
const path = require('path');
const pkg = require(path.join(__dirname, '../package.json'));

// Configuration des transports
log.transports.file.level = 'debug';    // Fichier : tous les niveaux
log.transports.console.level = 'info';  // Console : info+

// Préfixe global pour distinguer les logs
const PREFIX = `[${pkg.name}]`;

// Enveloppe des méthodes de log avec préfixe
function info(...args) {
    log.info(PREFIX, ...args);
}

function debug(...args) {
    log.debug(PREFIX, ...args);
}

function error(...args) {
    log.error(PREFIX, ...args);
}

/**
 * logDownloadProgress
 * Affiche la vitesse et le temps restant d'un téléchargement.
 *
 * @param {number} transferred - octets déjà transférés
 * @param {number} total - octets totaux à transférer
 * @param {number} deltaTime - temps écoulé (ms) depuis le dernier update
 */
function logDownloadProgress(transferred, total, deltaTime) {
    // Conversion octets->Mb/s : (bytes / ms) * (1000 / 1024 / 1024)
    const rawSpeed = (transferred > 0 && deltaTime > 0)
        ? (transferred / deltaTime) * (1000 / 1024 / 1024)
        : 0;
    const speed = (isFinite(rawSpeed) && rawSpeed > 0) ? rawSpeed : 0;
    info(`Vitesse : ${speed.toFixed(2)} Mb/s`);

    if (speed > 0 && total > transferred) {
        const remainingBytes = total - transferred;
        // temps restant (secondes) en considérant 8 bits par octet
        const timeLeftSec = remainingBytes / (speed * 1024 * 1024 / 8);
        const hours   = Math.floor(timeLeftSec / 3600);
        const minutes = Math.floor((timeLeftSec % 3600) / 60);
        const seconds = Math.floor(timeLeftSec % 60);
        info(`Temps restant estimé : ${hours}h ${minutes}m ${seconds}s`);
    } else if (total > transferred) {
        info('Temps restant estimé : calcul en cours...');
    } else {
        info('Téléchargement terminé');
    }
}

// Export des fonctions de logging
module.exports = {
    info,
    debug,
    error,
    logDownloadProgress
};
