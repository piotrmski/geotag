<template>
    <div id="mainDiv">
        <p>UPUSC PLIK</p>
    </div>
</template>

<script>
    export default {
        name: 'Main',
        mounted: function () {
            const holder = document.getElementById('mainDiv');

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
    #mainDiv {
        min-height: 100px;
    }
</style>
