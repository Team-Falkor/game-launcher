import { GameLauncher } from "./src";



(async () => {
  const launcher = new GameLauncher({
  logging: {
    enabled: false
  },
  maxConcurrentGames: 1,
  
})

launcher.on("closed", (game) => {
  console.log("LAUNCHER: Game closed", game);
})

launcher.on("launched", (game) => {
  console.log("LAUNCHER: Game launched", game);
})

  const game = await launcher.launchGame({
    gameId: "vampireSurvivors",    
    executable: "C:\\Games\\Vampire Survivors\\VampireSurvivors.exe",
    runAsAdmin: true,
    args: ["--fullscreen"],
    
  })
  
  game.on("closed", (data) => {
    console.log("GAME: Closed", data);
  })

  game.on("launched", (data) => {
    console.log("GAME: Launched", data);
  })

})();


