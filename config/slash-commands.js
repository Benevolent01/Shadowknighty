let S_C_PLAY = "play";
let S_C_LOOP = "loop";
let S_C_QLOOP = "qloop";
let S_C_SKIP = "skip";
let S_C_STOP = "stop";

let commandsInfo = [
  { name: S_C_PLAY, description: "Play a song!", options: { name: "query", description: "Song name or URL", required: true } },
  { name: S_C_SKIP, description: "Skip a song!" },
  { name: S_C_LOOP, description: "Decide whether to loop or not!" },
  { name: S_C_QLOOP, description: "Decide whether to loop the playlist or not!" },
  { name: S_C_STOP, description: "Stop the bot from playing!" },
];

module.exports = { commandsInfo, S_C_PLAY, S_C_LOOP, S_C_QLOOP, S_C_SKIP, S_C_STOP };
