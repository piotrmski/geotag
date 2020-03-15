const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

app.on('ready', () => {
  let window = new BrowserWindow({width: 1400, height: 800});
  window.loadURL('http://localhost:8081/');
  window.webContents.openDevTools();
});
