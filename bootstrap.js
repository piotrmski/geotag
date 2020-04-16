const {ipcMain, app, BrowserWindow, dialog, shell} = require('electron');
const fs = require('fs');
const pathManager = require('path');
const Jimp = require('jimp');
const ExifTool = require("exiftool-vendored").ExifTool;

module.exports = function(dev) {
  let window;
  const exiftool = new ExifTool();

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

    app.on('before-quit', () => exiftool.end());

    window.webContents.on('will-navigate', handleRedirect);
    window.webContents.on('new-window', handleRedirect);

    function handleRedirect(e, url) {
      if(url !== window.webContents.getURL()) {
        e.preventDefault();
        shell.openExternal(url);
      }
    }
  });

  ipcMain.on('get-argv-images', (event) => {
    const executableName = getFileNameFromPath(process.argv[0]);
    const isAppStandalone = executableName !== 'electron' && executableName !== 'electron.exe';
    const paths = [];
    for (const path of process.argv.slice(isAppStandalone ? 1 : 2)) {
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
    processPaths(paths).then(result => event.returnValue = result);
  });

  ipcMain.on('set-gps-exif', (event, args) => {
    // args: Image
    // args.latLng = null -> clear exif gps data

    const tags = { GPSLatitude: null, GPSLongitude: null, GPSLatitudeRef: null, GPSLongitudeRef: null };
    if (args.latLng != null) {
      let lat = args.latLng.lat;
      let long = args.latLng.lng;

      if (lat === 0 && long === 0) { // Geotag (0, 0) is considered invalid
        lat = 0.001;
      }

      let latHemisphere = 'N';
      let longHemisphere = 'E';

      if (lat < 0.0) {
        lat *= -1.0;
        latHemisphere = 'S';
      }

      if (long < 0.0) {
        long *= -1.0;
        longHemisphere = 'W';
      }

      tags.GPSLatitudeRef = latHemisphere;
      tags.GPSLongitudeRef = longHemisphere;
      tags.GPSLatitude = lat;
      tags.GPSLongitude = long;
    }
    exiftool.write(args.path, tags, ['-overwrite_original']).catch(() => showError(`Błąd zapisu pliku "${args.path}"`));
  });

  ipcMain.on('open-files', (event, args) => {
    // args: string[] - [path1, path2, ...]
    processPaths(args).then(result => event.returnValue = result);
  });

  ipcMain.on('show-overwrite-warning', (event, args) => {
    // args: string[] - [filename1, filename2, ...]
    dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Ostrzeżenie',
      buttons: ['OK', 'Cancel'],
      message: args.length === 1
        ? `Plik "${args[0]}" posiada już zapisane położenie geograficzne.`
        : `Pliki "${args.join('", "')}" posiadają już zapisane położenie geograficzne.`,
      detail: 'Upuszczenie zdjęcia na mapie spowoduje nadpisanie położenia. Aby zobaczyć aktualne położenie zdjęcia i edytować je, upuść je w obszarze wyboru pliku.',
      checkboxLabel: 'Nie pokazuj tego ostrzeżenia ponownie'
    }).then(r => event.returnValue = r);
  });


  ipcMain.on('open-dialog', (event) => {
    const paths = dialog.showOpenDialogSync(window, {
      filters: [
        {name: 'Zdjęcia', extensions: ['jpg', 'jpeg', 'tif', 'tiff']},
        {name: 'Wszystkie pliki', extensions: ['*']}
      ],
      properties: ['openFile', 'multiSelections']
    });
    processPaths(paths).then(result => event.returnValue = result);
  });

  async function processPaths(paths) {
    const images = [];
    const wrongFilesNames = [];
    if (paths) {
      for (const filePath of paths) {
        const fileName = getFileNameFromPath(filePath);
        const fileType = getFileTypeFromName(fileName).toLowerCase();
        if (['tif', 'tiff', 'jpg', 'jpeg'].includes(fileType)) {
          let base64ImageData;
          try {
            if (fileType === 'tif' || fileType === 'tiff') { // tiff requires conversion to a format displayable by browser
              const image = await Jimp.read(filePath);
              const file = await image.getBufferAsync(Jimp.MIME_PNG);
              base64ImageData = 'data:image/png;base64,' + file.toString('base64');
            } else { // jpeg does not need conversion
              const file = fs.readFileSync(filePath);
              base64ImageData = 'data:image/jpeg;base64,' + file.toString('base64');
            }
            const latLong = await getLatLongFromImage(filePath);
            const image = {
              filename: fileName,
              path: filePath,
              data: base64ImageData,
              latLng: latLong
            };
            images.push(image);
          } catch {
            wrongFilesNames.push(fileName);
          }
        } else {
          wrongFilesNames.push(fileName);
        }
      }
    }
    if (wrongFilesNames.length > 0) {
      showError(getErrorMessageFromFilesNames(wrongFilesNames));
    }
    return images;
  }

  function getFileNameFromPath(path) {
    // C:\folder\folder\file.ext -> file.ext
    let startIndex = path.lastIndexOf(pathManager.sep);
    return path.substring(startIndex + 1);
  }

  function getFileTypeFromName(name) {
    // file.ext -> ext
    let startIndex = name.lastIndexOf('.');
    return name.substring(startIndex + 1);
  }

  function getErrorMessageFromFilesNames(names) {
    let message = '';
    if (names.length === 1) {
      message = 'Plik ' + names[0] + ' nie przechowuje danych EXIF.'
    } else { // > 1
      message = 'Pliki ';
      names.forEach((item, index) => {
        message += item + (index !== names.length - 1 ? ', ' : '');
      });
      message += ' nie przechowują danych EXIF.'
    }
    return message;
  }

  function showError(message) {
    dialog.showMessageBoxSync(window, {
      type: 'error',
      title: 'Błąd',
      buttons: ['OK'],
      message: message
    });
  }

  async function getLatLongFromImage(path) {
    const tags = await exiftool.read(path);
    if (tags && tags.GPSLatitude && tags.GPSLongitude) {
      return {
        lat: tags.GPSLatitude,
        lng: tags.GPSLongitude
      }
    } else {
      return null;
    }
  }
};
