<script>
  import BodySnake from "./BodySnake.svelte";
  export let direction;
  export let bodiesSnake = [];
</script>
{#each bodiesSnake as bodySnake, i}
  <BodySnake
    isHead = {i == 0}
    top = {bodySnake.top}
    left = {bodySnake.left}
    {direction} />
{/each}