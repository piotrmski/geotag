<template>
  <div id="app" :class="{'default-cursor': draggedImage != null}">
    <img src="@/assets/pin-temp.svg" id="pinTemp" :style="pinTempStyle">
    <l-map
      :zoom="map.zoom"
      :center="map.center"
      :options="{zoomControl: false}"
      :maxBounds="map.bounds"
      id="map"
      ref="map"
      @mousemove="handleMapMouseMove($event)"
    >
      <l-tile-layer id="map-tiles" :url="map.url" :attribution="map.attribution"></l-tile-layer>
      <l-control-zoom position="bottomright"></l-control-zoom>
      <l-marker
        :lat-lng="image.latLng"
        v-for="image in images.filter(img => img.latLng)"
        :key="image.path"
        :icon="selectedImage && selectedImage.path === image.path ? pinSelected : pinDefault"
        @click="handlePinClick(image)"
        :draggable="true"
        @drag="handlePinDrag(image, $event)"
        @dragend="handlePinDragEnd(image)"
      ></l-marker>
    </l-map>
    <div id="sidebar" @mousemove="handleSidebarMouseMove($event)">
      <div id="sidebar-scrollable-area">
        <div id="image-list">
          <div
            class="image-list-item"
            v-for="image in images"
            :key="image.path"
            :class="{active: selectedImage && selectedImage.path === image.path}"
            :title="image.latLng ? '' : 'Przeciągnij i upuść na mapę, aby zapisać położenie'"
            @click="handleImageClick(image)"
            @mousedown="handleImgFromListDragStart(image, $event)"
          >
            <img :src="image.data" class="thumbnail">
            <div class="name">{{ image.filename }}</div>
            <div
              class="button"
              :class="{disabled: !image.latLng}"
              @click="handleImagePinRemoveClick($event, image)"
              :title="image.latLng ? 'Usuń położenie geograficzne' : ''"
            >
              <svg class="icon"><use href="@/assets/icons.svg#pin-remove"></use></svg>
            </div>
            <div class="button" @click="handleImageRemoveClick($event, image)" title="Zakończ edycję">
              <svg class="icon"><use href="@/assets/icons.svg#remove"></use></svg>
            </div>
          </div>
        </div>
        <div id="open-button" @click="handleOpenFileClick">
          <svg class="icon"><use href="@/assets/icons.svg#load"></use></svg>
          Upuść tu zdjęcia, aby je edytować, albo kliknij, aby wybrać z dysku.
        </div>
      </div>
      <div id="sidebar-preview" v-if="selectedImage">
        <div id="sidebar-preview-background">
          <img :src="selectedImage.data">
        </div>
        <img :src="selectedImage.data" id="sidebar-preview-image">
        <div class="sidebar-preview-text sidebar-preview-text-top">
          {{ selectedImage.filename }}
        </div>
        <div class="sidebar-preview-text sidebar-preview-text-bottom">
          Położenie geograficzne: {{ selectedImage.latLng ? selectedImage.latLng.lat.toString().substr(0, 10) + ', ' + selectedImage.latLng.lng.toString().substr(0, 10) : 'nieokreślone' }}<br>
          Lokalizacja: {{ selectedImage.path.substr(0, selectedImage.path.length - selectedImage.filename.length - 1) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import L from "leaflet";
import { LMap, LTileLayer, LMarker, LControlZoom } from "vue2-leaflet";
const {ipcRenderer} = window.require('electron');

export default {
  name: 'App',
  components: {
    LMap,
    LTileLayer,
    LMarker,
    LControlZoom
  },
  mounted() {
    window.addEventListener('mouseup', () => {
      if (this.draggedImage) {
        ipcRenderer.send('set-gps-exif', this.draggedImage);
        this.draggedImage = null;
        this.pinTempStyle = {display: 'none'};
      }
    });

    document.body.ondragover = () => false;
    document.body.ondrop = (e) => {
      const paths = this.getPathsArrayFromFileList(e.dataTransfer.files);
      const images = ipcRenderer.sendSync('open-files', paths);
      let latLng = null;
      if (e.target.id === 'map') {
        latLng = this.$refs.map.mapObject.containerPointToLatLng([e.clientX, e.clientY]);
      }
      this.openImages(images, latLng);
    };

    this.openImages(ipcRenderer.sendSync('get-argv-images'));
  },
  data() {
    return {
      images: [
        // {
        //   filename: string, (arbitrary name of the file, preferably name with extension in file system)
        //   path: string, (absolute path to file in file system)
        //   data: string, (data URI of file)
        //   latLng: LatLng
        // }
      ],
      selectedImage: null,
      draggedImage: null,
      map: {
        zoom: 2,
        center: L.latLng(10, 0),
        url: "https://{s}.tile.osm.org/{z}/{x}/{y}.png",
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        bounds: L.latLngBounds(L.latLng(-85, -180), L.latLng(85, 180))
      },
      pinDefault: L.icon({
        iconUrl: require('@/assets/pin-default.svg'),
        iconSize: [23, 32],
        iconAnchor: [12, 32],
        shadowUrl: require('@/assets/pin-shadow.svg'),
        shadowSize: [23, 32],
        shadowAnchor: [12, 32]
      }),
      pinSelected: L.icon({
        iconUrl: require('@/assets/pin-selected.svg'),
        iconSize: [23, 32],
        iconAnchor: [12, 32],
        shadowUrl: require('@/assets/pin-shadow.svg'),
        shadowSize: [23, 32],
        shadowAnchor: [12, 32]
      }),
      pinTempStyle: {display: 'none'},
      dragFromListEventOrigin: null,
      showOverwriteWarning: true
    }
  },
  methods: {
    getPathsArrayFromFileList: function(fileList) {
      const paths = [];
      for (let f of fileList) {
        paths.push(f.path);
      }
      return paths;
    },

    handleImageClick: function(image) {
      if (this.selectedImage && this.selectedImage.path === image.path) {
        this.selectedImage = null;
      } else {
        this.selectedImage = image;
        if (image.latLng) {
          this.map.center = image.latLng;
        }
      }
    },

    handlePinClick: function(image) {
      if (this.selectedImage && this.selectedImage.path === image.path) {
        this.selectedImage = null
      } else {
        this.selectedImage = image;
      }
    },

    handleImagePinRemoveClick: function(event, image) {
      event.stopPropagation();
      if (image.latLng) {
        image.latLng = null;
        ipcRenderer.send('set-gps-exif', image);
      }
    },

    handleImageRemoveClick: function(event, image) {
      event.stopPropagation();
      this.images = this.images.filter(img => img.path !== image.path);
      if (this.selectedImage && this.selectedImage.path === image.path) {
        this.selectedImage = null;
      }
    },

    handleOpenFileClick: function() {
      const images = ipcRenderer.sendSync('open-dialog');
      this.openImages(images);
    },

    openImages: function(images, latLng) {
      // Discard images which are already opened
      images = images.filter(image => this.images.filter(i => i.path === image.path).length === 0);

      // Show warning for images which already have latLng and discard them if user decides to do so
      if (latLng && this.showOverwriteWarning) {
        const imagesWithLatLng = images.filter(i => i.latLng != null);
        const imagesWithoutLatLng = images.filter(i => i.latLng == null);
        if (imagesWithoutLatLng.length !== images.length) {
          const response = ipcRenderer.sendSync('show-overwrite-warning', imagesWithLatLng.map(i => i.filename));
          if (response.response === 1) { // If user clicked 'Cancel', discard images which already have latLng
            images = imagesWithoutLatLng;
          } else { // If user clicked OK, overwrite latLng and check if user checked the "do not show again" checkbox. If so, don't ask in the future and always overwrite.
            this.showOverwriteWarning = !response.checkboxChecked;
          }
        }
      }

      for (let image of images) {
        if (latLng) {
          image.latLng = latLng;
          ipcRenderer.send('set-gps-exif', image);
        }
        this.images.push(image);
      }
    },

    handlePinDrag: function(image, event) {
      if (this.isLatLngOutOfBounds(event.target.getLatLng())) {
        event.target.setLatLng(this.clampLatLngToBounds(event.target.getLatLng()))
      }
      image.latLng = event.target.getLatLng();
    },

    handlePinDragEnd: function(image) {
      ipcRenderer.send('set-gps-exif', image);
    },

    handleImgFromListDragStart: function(image, event) {
      if (!image.latLng) {
        this.draggedImage = image;
        this.dragFromListEventOrigin = {x: event.clientX, y: event.clientY};
      }
    },

    handleSidebarMouseMove: function(event) {
      if (this.draggedImage) {
        this.draggedImage.latLng = null;

        // Fake pin will only start showing after user drags further than 5px
        const distanceFromOriginSquared = this.dragFromListEventOrigin
          ? Math.pow(event.clientX - this.dragFromListEventOrigin.x, 2) + Math.pow(event.clientY - this.dragFromListEventOrigin.y, 2)
          : Infinity;

        if (distanceFromOriginSquared > 25) {
          this.dragFromListEventOrigin = null;

          this.pinTempStyle = {
            display: 'block',
            top: event.clientY - 32 + 'px',
            left: event.clientX - 12 + 'px'
          };
        }
      }
    },

    handleMapMouseMove: function(event) {
      if (this.draggedImage) {
        this.pinTempStyle = {display: 'none'};
        this.draggedImage.latLng = this.clampLatLngToBounds(event.latlng);
      }
    },

    isLatLngOutOfBounds: function(latLng) {
      return Math.abs(latLng.lat) > 85 || Math.abs(latLng.lng) > 180;
    },

    clampLatLngToBounds: function(latLng) {
      return L.latLng(
        latLng.lat < -85 ? -85 : (latLng.lat > 85 ? 85 : latLng.lat),
        latLng.lng < -180 ? -180 : (latLng.lng > 180 ? 180 : latLng.lng)
      )
    }
  }
}
</script>

<style>
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    font-family: Avenir, Helvetica, Arial, sans-serif;
    color: #111;
    font-size: 12px;
    line-height: 1.35;
    user-select: none;
  }
  img {
    -webkit-user-drag: none;
  }
  .default-cursor * {
    cursor: default!important;
  }
  #map {
    height: 100vh;
  }
  #sidebar {
    position: absolute;
    left: 25px;
    top: 25px;
    width: 300px;
    max-height: calc(100vh - 50px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.25);
    border-radius: 20px;
    background: #fff;
    z-index: 400;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  #sidebar-scrollable-area {
    min-height: 0;
    overflow: hidden;
  }
  #sidebar-scrollable-area:hover {
    overflow: overlay;
  }
  #sidebar-scrollable-area::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }
  #sidebar-scrollable-area::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.5);
  }
  #open-button {
    margin: 0 20px 20px;
    border: 1px dashed #707070;
    color: #505050;
    border-radius: 5px;
    padding: 10px 15px 10px 53px;
    transition: 0.1s background-color;
    position: relative;
  }
  #open-button:hover {
    background: rgba(0, 0, 0, 0.025);
    border: 1px solid #a0a0a0;
  }
  #open-button:active {
    background: rgba(0, 0, 0, 0.05);
  }
  #open-button .icon {
    width: 25px;
    height: 20px;
    position: absolute;
    top: calc(50% - 10px);
    left: 15px;
  }
  #image-list {
    padding: 10px 0;
  }
  .image-list-item {
    display: flex;
    align-items: center;
    height: 60px;
    padding: 0 20px;
    transition: 0.1s background-color;
  }
  .image-list-item:hover {
    background: rgba(0, 0, 0, 0.05);
  }
  .image-list-item.active {
    background: #bef2ff;
  }
  .image-list-item .name {
    flex: 1;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .image-list-item .thumbnail {
    width: 40px;
    height: 40px;
    object-fit: contain;
    background: rgba(0, 0, 0, 0.05);
  }
  .image-list-item .icon {
    width: 15px;
    height: 15px;
    display: block;
    color: rgba(0, 0, 0, 0.7);
  }
  .image-list-item .button {
    transition: 0.1s background-color;
    padding: 5px;
    border-radius: 100%;
  }
  .image-list-item .button.disabled .icon {
    color: rgba(0, 0, 0, 0.1);
  }
  .image-list-item .button:not(.disabled):hover {
    background: rgba(0, 0, 0, 0.05);
  }
  .image-list-item .button:not(.disabled):active {
    background: rgba(0, 0, 0, 0.15);
  }
  #sidebar-preview {
    width: 300px;
    height: 300px;
    min-height: 300px;
    position: relative;
    word-break: break-all;
  }
  #sidebar-preview-background {
    width: 300px;
    height: 300px;
    overflow: hidden;
    position: absolute;
    top: 0;
    left: 0;
  }
  #sidebar-preview-background img {
    width: 300px;
    height: 300px;
    object-fit: cover;
    transform: scale(1.1);
    filter: blur(10px);
    opacity: 0.8;
  }
  #sidebar-preview-image {
    width: 300px;
    height: 300px;
    object-fit: contain;
    position: absolute;
    top: 0;
    left: 0;
  }
  .sidebar-preview-text {
    position: absolute;
    left: 0;
    width: 100%;
    color: #fff;
    text-shadow: 0 1px 3px #000;
    padding: 10px;
  }
  .sidebar-preview-text-top {
    top: 0;
  }
  .sidebar-preview-text-bottom {
    bottom: 0;
  }
  #pinTemp {
    pointer-events: none;
    z-index: 401;
    position: fixed;
  }
</style>
