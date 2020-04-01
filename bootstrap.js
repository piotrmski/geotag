const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

module.exports = function(dev) {
  app.on('ready', () => {
    let window = new BrowserWindow({width: 800, height: 600});
    if (dev) {
      window.loadURL('http://localhost:8081/');
      window.webContents.openDevTools();
    } else {
      window.setMenu(null);
      window.loadFile('dist/index.html');
    }
  });
};
