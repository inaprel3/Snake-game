<script>
  import Snake from "./Snake.svelte";
  import Fruit from "./Fruit.svelte";
  let bodiesSnake = [];
  let fruitLeft = 0;
  let fruitTop = 0;
  let direction = "right";
  $: score = bodiesSnake.length - 3;
  function isCollide(a, b) {
    return !(
      a.top < b.top ||
      a.top > b.top ||
      a.left < b.left ||
      a.left > b.left
    );
  }
  function moveFruit() {
    fruitTop = Math.floor(Math.random() * 12) * 50;
    fruitLeft = Math.floor(Math.random() * 26) * 50;
  }
  function resetGame() {
    moveFruit();
    direction = "right";
    bodiesSnake = [ { left: 100, top: 0 }, 
      { left: 50, top: 0 },
      { left: 0, top: 0 }
    ];
  }
  function getDirectionFromKeyCode(keyCode) {
    if (keyCode === 38) { return "up"; }
    else if (keyCode === 39) { return "right"; }
    else if (keyCode === 37) { return "left"; }
    else if (keyCode === 40) { return "down"; }
    return false;
  }
  function onKeyDown(e) {
  const newDirection = getDirectionFromKeyCode(e.keyCode);
  if (newDirection) {
    direction = newDirection;
    }
  }
  function isGameOver() {
    const bodiesSnakeNoHead = bodiesSnake.slice(1);
    const snakeCollisions = bodiesSnakeNoHead.filter(bs =>
      isCollide(bs, bodiesSnake[0])
    );
    if (snakeCollisions.length > 0) { return true; }
    const { top, left } = bodiesSnake[0];
    if (top >= 600 || top < 0 || left < 0 || left >= 1300) { return true; }
    return false;
  }
  setInterval(() => { 
    bodiesSnake.pop();
    let { left, top } = bodiesSnake[0];
    if (direction === "up") { top -= 50; } 
    else if (direction === "right") { left += 50; }
    else if (direction === "down") { top += 50; }
    else if (direction === "left") { left -= 50; }
    const newHead = { left, top };
    bodiesSnake = [newHead, ... bodiesSnake];
    if (isCollide(newHead, { left: fruitLeft, top: fruitTop })) {
      moveFruit();
      bodiesSnake = [...bodiesSnake, bodiesSnake [bodiesSnake.length - 1]];
    }
    if (isGameOver()) { resetGame(); }
  }, 200);
  resetGame();
</script>
<style>
  main {
    background-image: url("../cursova.jpg");
    background-size: cover;
    width: 1300px;
    height: 600px;
    border: solid rgb(15, 69, 0) 5px;
    position: relative;
    margin: 20px auto;
  }
  h1 {
    text-align: center;
  }
</style>
<h1>SNAKE GAME, Score: {score}</h1>
<main>
  <Snake {direction} {bodiesSnake} />
  <Fruit {fruitLeft} {fruitTop} />
</main>
<svelte:window on:keydown={onKeyDown} />
