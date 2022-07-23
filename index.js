import WorldTemplate from "./world.js";

function main() {
  const container = document.getElementById("app");
  let world = new WorldTemplate(container);
  world.start();
}
main();
