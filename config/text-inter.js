let USER_NOT_IN_VC_TEXT = (user) => (`${user} **join** a voice channel *and I might play!*`);

let AUDIO_NOT_FOUND_TEXT = (user) => (`${user} I couldn't find this video, **try again?!**`);

let PLAY_NEXT_AUDIO_TEXT = (title, duration) => (`⭐ Now playing **${title} (${duration})** !`)

let NO_SERVER_Q_TEXT = () => (`There doesn't exist a queue yet!`);

let SKIPPING_SONG_TEXT = (user, song_title) => (`${user} I'm skipping ${song_title}, Playing next! (...)`);

let SKIPPING_LAST_SONG = () => ('This was the last song in the queue.. disconnecting! 🧙🏼‍♂️');

let LOOP_TOGGLE_TEXT = (bool) => (bool ? `Looping is now **enabled** ✅` : `Looping is now **disabled** 🛑`);

let QUEUE_LOOP_TOGGLE_TEXT = (bool) => (bool ? `Queue looping is now enabled 🟢` : `Queue looping is now disabled 🟥`);

let DISCONNECT_BOT_TEXT = () => (`Resetting the queue and disconnecting... ⚰️`);

module.exports = {
  USER_NOT_IN_VC_TEXT,
  AUDIO_NOT_FOUND_TEXT,
  PLAY_NEXT_AUDIO_TEXT,
  NO_SERVER_Q_TEXT,
  SKIPPING_SONG_TEXT,
  SKIPPING_LAST_SONG,
  LOOP_TOGGLE_TEXT,
  QUEUE_LOOP_TOGGLE_TEXT,
  DISCONNECT_BOT_TEXT,
};