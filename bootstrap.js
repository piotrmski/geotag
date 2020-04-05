const {ipcMain, app, BrowserWindow, dialog} = require('electron');
const fs = require('fs');
const exif = require('piexifjs');

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

  ipcMain.on('set-gps-exif', (event, args) => {
    // args -> [lat, long, image obj]
    let lat = args[0];
    let latHemisphere = 'N';
    if (lat < 0.0) {
      lat *= -1.0;
      latHemisphere = 'S';
    }
    let long = args[1];
    let longHemisphere = 'E';
    if (long < 0.0) {
      long *= -1.0;
      longHemisphere = 'W';
    }
    const gps = {};
    gps[exif.GPSIFD.GPSLatitudeRef] = latHemisphere;
    gps[exif.GPSIFD.GPSLongitudeRef] = longHemisphere;
    gps[exif.GPSIFD.GPSLatitude] = exif.GPSHelper.degToDmsRational(lat);
    gps[exif.GPSIFD.GPSLongitude] = exif.GPSHelper.degToDmsRational(long);
    const exifObj = {'GPS': gps};
    const exifStr = exif.dump(exifObj);
    const image = args[2];
    const newImageBase64 = exif.insert(exifStr, image.data);
    fs.writeFileSync(image.path, removeBase64Prefix(newImageBase64), 'base64');
  });

  ipcMain.on('open-files', (event, args) => {
    // args -> [ [path] [path] ... ]
    event.returnValue = processPaths(args);
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
        if (isFileTypeCorrect(fileType)) {
          const base64ImageData = getBase64PrefixFromType(fileType) + file.toString('base64');
          const latLong = getLatLongFromImage(base64ImageData);
          const image = {
            filename: fileName,
            path: filePath,
            data: base64ImageData,
            latLng: latLong
          };
          images.push(image);
        } else {
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
    let startIndex = path.lastIndexOf('\\');
    return path.substring(startIndex + 1);
  }

  function getFileTypeFromName(name) {
    // file.ext -> ext
    let startIndex = name.lastIndexOf('.');
    return name.substring(startIndex + 1);
  }

  function isFileTypeCorrect(type) {
    return type === 'jpeg' || type === 'jpg' || type === 'tiff' || type === 'tif';
  }

  function removeBase64Prefix(data) {
    return data.split(',')[1];
  }

  function getBase64PrefixFromType(type) {
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
    dialog.showMessageBox(window, {
      type: 'error',
      title: 'Błąd',
      buttons: ['OK'],
      message: message
    }).then();
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
          let long = exif.GPSHelper.dmsRationalToDeg(longData, 'E');
          if (latHemisphere === 'S') {
            lat *= -1.0;
          }
          if (longHemisphere === 'W') {
            long *= -1.0;
          }
          return [lat, long];
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