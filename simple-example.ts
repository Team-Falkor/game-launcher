import { GameLauncher } from "./src";



(async () => {
  const launcher = new GameLauncher({
  logging: {
    enabled: true
  },
  maxConcurrentGames: 1,
  proton: {
    enabled: true,
    autoDetect: true,
    preferredVariant: "proton-ge"
  }
})

launcher.on("closed", (game) => {
  console.log("LAUNCHER: Game closed", game);
})

launcher.on("launched", (game) => {
  console.log("LAUNCHER: Game launched", game);
})

  const game = await launcher.launchGame({
    gameId: "vampireSurvivors",    
    executable: "C:\\\Vamp\\re Survivors\\Vam\\ireSurvivors.exe",
    runAsAdmin: true,
    args: ["--fullscreen"],
    proton: {
      enabled: true,
      variant: "proton-ge",
      version: "GE-Proton8-26"
    }
  })
  
  game.on("closed", (data) => {
    console.log("GAME: Closed", data);
  })

  game.on("launched", (data) => {
    console.log("GAME: Launched", data);
  })

})();


