const electron = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;

app.on('ready', () => {
  Menu.setApplicationMenu(null);
  let window = new BrowserWindow({width: 800, height: 600});
  window.loadFile('dist/index.html');
});
