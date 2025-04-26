// index.js (renderer pour la splash)

const { ipcRenderer, shell } = require('electron');
const os                      = require('os');
const pkg                     = require('../package.json');
const logger                  = require('./utils/logger.js');
const { config, database }    = require('./utils.js');

// Événements globaux pour capturer erreurs non gérées
window.addEventListener('error', e => {
  logger.error('Erreur JS non capturée (renderer) :', e.error || e.message);
});
window.addEventListener('unhandledrejection', e => {
  logger.error('Rejet non géré (renderer) :', e.reason);
});

class Splash {
  constructor() {
    this.splash        = document.querySelector('.splash');
    this.splashMessage = document.querySelector('.splash-message');
    this.splashAuthor  = document.querySelector('.splash-author');
    this.message       = document.querySelector('.message');
    this.progress      = document.querySelector('.progress');

    document.addEventListener('DOMContentLoaded', async () => {
      try {
        const dbLauncher   = new database();
        const configClient = await dbLauncher.readData('configClient');
        const theme        = configClient?.launcher_config?.theme || 'auto';
        const isDarkTheme  = await ipcRenderer.invoke('is-dark-theme', theme);
        document.body.className = isDarkTheme ? 'dark global' : 'light global';
        if (process.platform === 'win32') {
          ipcRenderer.send('update-window-progress-load');
        }
        this.startAnimation();
      } catch (err) {
        logger.error('Splash DOMContentLoaded erreur :', err);
        this.shutdown('Une erreur est survenue.');
      }
    });
  }

  async startAnimation() {
    const splashes = [
      { message: "Je... vie...",                          author: "Luuxis" },
      { message: "Salut je suis du code.",                author: "Luuxis" },
      { message: "Linux n'est pas un OS, mais un kernel.", author: "Luuxis" }
    ];
    const splash = splashes[Math.floor(Math.random() * splashes.length)];

    this.splashMessage.textContent          = splash.message;
    this.splashAuthor.children[0].textContent = `@${splash.author}`;

    await sleep(100);
    document.querySelector('#splash').style.display = 'block';
    await sleep(500);
    this.splash.classList.add('opacity');
    await sleep(500);
    this.splash.classList.add('translate');
    this.splashMessage.classList.add('opacity');
    this.splashAuthor.classList.add('opacity');
    this.message.classList.add('opacity');
    await sleep(1000);

    this.checkUpdate();
  }

  async checkUpdate() {
    this.setStatus('Recherche de mise à jour...');

    ipcRenderer.invoke('update-app')
      .catch(err => this.shutdown(`Erreur de mise à jour :<br>${err.message}`));

    ipcRenderer.on('updateAvailable', () => {
      this.setStatus('Mise à jour disponible !');
      if (os.platform() === 'win32') {
        this.toggleProgress();
        ipcRenderer.send('start-update');
      } else {
        this.downloadUpdate();
      }
    });

    ipcRenderer.on('error', (_e, err) => {
      if (err) this.shutdown(err.message);
    });

    ipcRenderer.on('download-progress', (_e, progress) => {
      ipcRenderer.send('update-window-progress', {
        progress: progress.transferred,
        size:     progress.total
      });
      // Logging et affichage progress
      logger.logDownloadProgress(progress.transferred, progress.total, progress.deltaTime || 0);
      this.setProgress(progress.transferred, progress.total);
    });

    ipcRenderer.on('update-not-available', () => {
      logger.info('Mise à jour non disponible');
      this.maintenanceCheck();
    });
  }

  getLatestReleaseForOS(osKey, preferredFormat, assets) {
    return assets
      .filter(a => {
        const name = a.name.toLowerCase();
        return name.includes(osKey) && name.endsWith(preferredFormat);
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  }

  async downloadUpdate() {
    try {
      const [owner, repo] = pkg.repository.url
        .replace(/^(git\+)?https:\/\/github\.com\//, '')
        .replace(/\.git$/, '')
        .split('/');

      const apiRoot     = await fetchWithLogging('https://api.github.com', { timeoutMs: 20000 });
      const repoApi     = apiRoot.repository_url
                              .replace('{owner}', owner)
                              .replace('{repo}',  repo);
      const repoInfo    = await fetchWithLogging(repoApi, { timeoutMs: 20000 });
      const releasesApi = repoInfo.releases_url.replace('{/id}', '');
      const releasesList = await fetchWithLogging(releasesApi, { timeoutMs: 20000 });

      const assets = releasesList[0]?.assets || [];
      const osKey  = os.platform() === 'darwin' ? 'mac' : 'linux';
      const ext    = os.platform() === 'darwin' ? '.dmg' : '.appimage';
      const latest = this.getLatestReleaseForOS(osKey, ext, assets);

      if (!latest) {
        throw new Error('Aucun asset trouvé pour votre OS');
      }

      this.setStatus(
        'Mise à jour prête à télécharger<br>' +
        '<div class="download-update">Télécharger</div>'
      );
      document
        .querySelector('.download-update')
        .addEventListener('click', () => {
          shell.openExternal(latest.browser_download_url);
          this.shutdown('Téléchargement en cours…');
        });
    } catch (err) {
      logger.error('downloadUpdate erreur :', err);
      this.shutdown(`Erreur téléchargement :<br>${err.message}`);
    }
  }

  async maintenanceCheck() {
    try {
      const conf = await config.GetConfig();
      if (conf.maintenance) {
        this.shutdown(conf.maintenance_message);
        return;
      }
      this.startLauncher();
    } catch (err) {
      logger.error('maintenanceCheck failed (renderer) :', err);
      this.shutdown('Pas de connexion internet détectée.');
    }
  }

  startLauncher() {
    this.setStatus('Démarrage du launcher');
    ipcRenderer.send('main-window-open');
    ipcRenderer.send('update-window-close');
  }

  shutdown(text) {
    this.setStatus(`${text}<br>Arrêt dans 5s`);
    let i = 4;
    const timer = setInterval(() => {
      this.setStatus(`${text}<br>Arrêt dans ${i--}s`);
      if (i < 0) {
        clearInterval(timer);
        ipcRenderer.send('update-window-close');
      }
    }, 1000);
  }

  setStatus(html) {
    this.message.innerHTML = html;
  }

  toggleProgress() {
    if (this.progress.classList.toggle('show')) {
      this.setProgress(0, 1);
    }
  }

  setProgress(value, max) {
    this.progress.value = value;
    this.progress.max   = max;
  }
}

// Wrapper fetch universel avec AbortController + log
async function fetchWithLogging(url, options = {}) {
  const { timeoutMs = 20000, ...fetchOpts } = options;
  const start = Date.now();
  logger.info(`[FETCH-START] ${url}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal });
    logger.info(`[FETCH-STATUS] ${url} → ${res.status}`);
    const ct   = res.headers.get('content-type') || '';
    const data = ct.includes('application/json')
      ? await res.json()
      : await res.text();
    logger.debug(`[FETCH-DATA]   ${url} → ${JSON.stringify(data).slice(0,200)}`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error(`[FETCH-TIMEOUT] ${url} > ${timeoutMs}ms`);
    } else {
      logger.error(`[FETCH-ERROR]   ${url}`, err);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    logger.info(`[FETCH-END] ${url} (${Date.now() - start} ms)`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Raccourci DevTools
document.addEventListener('keydown', e => {
  if ((e.ctrlKey && e.shiftKey && e.key === 'I') || e.key === 'F12') {
    ipcRenderer.send('update-window-dev-tools');
  }
});

// Démarrage du splash
new Splash();
