// js/utils/logger.js

import log from 'electron-log';
import path from 'path';
import pkg from '../../package.json';

// Configuration des transports
log.transports.file.level    = 'debug';  // Fichier : tous les niveaux
log.transports.console.level = 'info';   // Console : info+
// Transport IPC (anciennes versions)
if (log.transports.ipc) {
  log.transports.ipc.level = 'debug';
}

// Préfixe global pour distinguer les logs
const PREFIX = `[${pkg.name}]`;

/**
 * info  - log info avec préfixe
 */
export function info(...args) {
  log.info(PREFIX, ...args);
}

/**
 * debug - log debug avec préfixe
 */
export function debug(...args) {
  log.debug(PREFIX, ...args);
}

/**
 * error - log error avec préfixe
 */
export function error(...args) {
  log.error(PREFIX, ...args);
}

/**
 * logDownloadProgress - affiche vitesse et temps restant pour un download
 * @param {number} transferred - octets transférés
 * @param {number} total      - octets totaux
 * @param {number} deltaTime  - temps écoulé depuis dernière update (ms)
 */
export function logDownloadProgress(transferred, total, deltaTime) {
  const rawSpeed = (transferred > 0 && deltaTime > 0)
    ? (transferred / deltaTime) * (1000 / 1024 / 1024)
    : 0;
  const speed = (isFinite(rawSpeed) && rawSpeed > 0) ? rawSpeed : 0;
  info(`Vitesse : ${speed.toFixed(2)} Mb/s`);

  if (speed > 0 && total > transferred) {
    const remainingBytes = total - transferred;
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

// Export default pour compatibilité import logger from ...
export default {
  info,
  debug,
  error,
  logDownloadProgress
};
