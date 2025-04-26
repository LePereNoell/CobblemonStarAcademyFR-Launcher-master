"use strict";

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const log = require("electron-log"); // <-- logging

let dev = process.env.DEV_TOOL === 'open';
let updateWindow;

/**
 * Récupère la fenêtre de mise à jour
 */
function getWindow() {
  return updateWindow;
}

/**
 * Ferme et détruit la fenêtre de mise à jour
 */
function destroyWindow() {
  if (!updateWindow) return;
  updateWindow.close();
  updateWindow = undefined;
}

/**
 * Crée et affiche la fenêtre de mise à jour
 */
function createWindow() {
  destroyWindow();

  updateWindow = new BrowserWindow({
    title: "Mise à jour",
    width: 400,
    height: 500,
    resizable: false,
    icon: path.join(app.getAppPath(), "assets/images/icon." + (os.platform() === "win32" ? "ico" : "png")),
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true
    }
  });

  // On retire la barre de menu
  Menu.setApplicationMenu(null);
  updateWindow.setMenuBarVisibility(false);

  // Ouvre les DevTools systématiquement pour débogage
  updateWindow.webContents.openDevTools({ mode: 'detach' });

  // Événement si le chargement du HTML échoue
  updateWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    log.error(`UpdateWindow did-fail-load: code=${errorCode} desc="${errorDescription}" url=${validatedURL}`);
  });

  // Événement quand le chargement se termine
  updateWindow.webContents.on('did-finish-load', () => {
    log.info('UpdateWindow: did-finish-load');
  });

  // Récupère les console.log du renderer
  updateWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    log.info(`UpdateWindow console [level ${level}] ${sourceId}:${line} → ${message}`);
  });

  // Construire le chemin absolu vers index.html dans l'ASAR/package
  const htmlPath = path.join(`${app.getAppPath()}/src/index.html`);
  log.info("Chargement de l’UpdateWindow avec :", htmlPath);

  // Charge le HTML
  updateWindow.loadFile(htmlPath)
    .catch(err => log.error("Erreur loadFile UpdateWindow :", err));

  // Affiche la fenêtre une fois prête
  updateWindow.once('ready-to-show', () => {
    if (updateWindow) {
      if (dev) {
        updateWindow.webContents.openDevTools({ mode: 'detach' });
      }
      updateWindow.show();
    }
  });
}

module.exports = {
  getWindow,
  createWindow,
  destroyWindow,
};
