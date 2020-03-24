<template>
  <div id="sidebar">
    <div id="open-button">
      <svg class="icon"><use href="@/assets/icons.svg#load"></use></svg>
      Upuść tu zdjęcia, aby je edytować, albo kliknij, aby wybrać z dysku.
    </div>
  </div>
</template>

<script>
    export default {
        name: 'Main',
        mounted: function () {
            const holder = document.body;

            holder.ondragover = () => {
                return false;
            };

            holder.ondragleave = () => {
                return false;
            };

            holder.ondragend = () => {
                return false;
            };

            holder.ondrop = (e) => {
                e.preventDefault();

                for (let f of e.dataTransfer.files) {
                    console.log('File(s) you dragged here: ', f.path)
                }

                return false;
            };
        }
    };
</script>

<style scoped>
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
  }
  #open-button {
    margin: 20px;
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
</style>
