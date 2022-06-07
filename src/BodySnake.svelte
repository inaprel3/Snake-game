<script>
  export let direction = "right";
  export let isHead = false;
  export let top = 50;
  export let left = 50;
</script>
<style>
  .body-snake {
    position: absolute;
    background-color: rgb(128, 20, 178);
    border: rgb(5, 55, 0) 3px solid;
    border-radius: 60%;
    width: 50px;
    height: 50px;
    z-index: 4;
  }
  .eyes {
    position: absolute;
    background-color: rgb(255, 217, 0);
    border-radius: 60%;
    width: 25%;
    height: 25%;
  }
  #rightEye {
    left: 75%;
    bottom: 20%;
  }
  #leftEye {
    left: 75%;
    top: 20%;
  }
  .body-snake.up {
    transform: rotate(250deg);
  }
  .body-snake.right {
    transform: rotate(10deg);
  }
  .body-snake.down {
    transform: rotate(80deg);
  }
  .body-snake.left {
    transform: rotate(150deg);
  }
</style>
<div style="left: {left}px; top: {top}px;" class="body-snake {direction}">
  {#if isHead}
    <div id="rightEye" class="eyes" />
    <div id="leftEye" class="eyes" />
  {/if}
</div>