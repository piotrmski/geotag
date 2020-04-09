const {ipcMain, app, BrowserWindow, dialog} = require('electron');
const fs = require('fs');
const exif = require('piexifjs');
const pathManager = require('path');

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

  ipcMain.on('get-argv-images', (event) => {
    const executableName = getFileNameFromPath(process.argv[0]);
    const isAppStandalone = executableName !== 'electron' && executableName !== 'electron.exe';
    event.returnValue = processPaths(process.argv.slice(isAppStandalone ? 1 : 2));
  });

  ipcMain.on('set-gps-exif', (event, args) => {
    // args: Image
    // args.latLng = null -> clear exif gps data
    const gps = {};
    if (args.latLng != null) {
      let lat = args.latLng.lat;
      let long = args.latLng.lng;

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

      gps[exif.GPSIFD.GPSLatitudeRef] = latHemisphere;
      gps[exif.GPSIFD.GPSLongitudeRef] = longHemisphere;
      gps[exif.GPSIFD.GPSLatitude] = exif.GPSHelper.degToDmsRational(lat);
      gps[exif.GPSIFD.GPSLongitude] = exif.GPSHelper.degToDmsRational(long);
    }
    const exifObj = {'GPS': gps};
    const exifStr = exif.dump(exifObj);
    const newImageBase64 = exif.insert(exifStr, args.data);
    try {
      fs.writeFileSync(args.path, removeBase64Prefix(newImageBase64), 'base64');
    } catch {
      showError(`Błąd zapisu pliku "${args.path}"`)
    }
  });

  ipcMain.on('open-files', (event, args) => {
    // args: string[] - [path1, path2, ...]
    event.returnValue = processPaths(args);
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
    event.returnValue = processPaths(paths);
  });

  function processPaths(paths) {
    const images = [];
    const wrongFilesNames = [];
    if (paths) {
      paths.forEach(filePath => {
        const file = fs.readFileSync(filePath);
        const fileName = getFileNameFromPath(filePath);
        const fileType = getFileTypeFromName(fileName);
        try {
          const base64ImageData = getBase64PrefixFromType(fileType) + file.toString('base64');
          const latLong = getLatLongFromImage(base64ImageData);
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
      });
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

  function removeBase64Prefix(data) {
    return data.split(',')[1];
  }

  function getBase64PrefixFromType(type) {
    type = type.toLowerCase();
    let prefix = 'data:image/';
    if (type === 'tiff' || type === 'tif') {
      prefix += 'tiff';
    } else { // jpeg || jpg
      prefix += 'jpeg';
    }
    return prefix + ';base64,';
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

  function getLatLongFromImage(base64ImageData) {
    const exifObj = exif.load(base64ImageData);
    if (exifObj && exifObj.GPS) {
      const latHemisphere = exifObj.GPS[exif.GPSIFD.GPSLatitudeRef];
      const longHemisphere = exifObj.GPS[exif.GPSIFD.GPSLongitudeRef];
      const latData = exifObj.GPS[exif.GPSIFD.GPSLatitude];
      const longData = exifObj.GPS[exif.GPSIFD.GPSLongitude];
      if (latHemisphere && Array.isArray(latData) && latData.length === 3 &&
          longHemisphere && Array.isArray(longData) && longData.length === 3) {
        if (isGpsDataCorrect(latData) && isGpsDataCorrect(longData)) {
          let lat = exif.GPSHelper.dmsRationalToDeg(latData, 'N');
          let lng = exif.GPSHelper.dmsRationalToDeg(longData, 'E');
          if (latHemisphere === 'S') {
            lat *= -1.0;
          }
          if (longHemisphere === 'W') {
            lng *= -1.0;
          }
          return {lat, lng};
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    function isGpsDataCorrect(data) {
      data.forEach(item => {
        if (Array.isArray(item)) {
          if (item.length !== 2) {
            return false;
          }
        } else {
          return false;
        }
      });
      return true;
    }
  }
};
