<script>
  export let fruitTop;
  export let fruitLeft;
</script>
<style>
  .fruit {
    position: absolute;
    border: solid black 2px;
    background-color: rgb(255, 0, 85);
    width: 50px;
    height: 50px;
    z-index: 0;
  }
</style>
<div class="fruit" style="left: {fruitLeft}px; top: {fruitTop}px" />