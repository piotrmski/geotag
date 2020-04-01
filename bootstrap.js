const {ipcMain, app, BrowserWindow, dialog} = require('electron');

module.exports = function(dev) {
  let window;

  app.on('ready', () => {
    window = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 350,
      minHeight: 500,
      webPreferences: {
        nodeIntegration: true
      }
    });
    if (dev) {
      window.loadURL('http://localhost:8081/');
      window.webContents.openDevTools();
    } else {
      window.setMenu(null);
      window.loadFile('dist/index.html');
    }
  });


  ipcMain.on('open-file', (event) => {
    dialog.showOpenDialogSync(window, {
      filters: [
        {name: 'Zdjęcia', extensions: ['jpg', 'jpeg', 'tif', 'tiff']},
        {name: 'Wszystkie pliki', extensions: ['*']}
      ]
    });
    event.returnValue = 'TODO implement';
  })
};
