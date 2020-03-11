const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

app.on('ready', () => {
  let window = new BrowserWindow({width: 1400, height: 800});
  window.loadURL('http://localhost:8080/');
  window.webContents.openDevTools();
});
