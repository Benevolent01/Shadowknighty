require("dotenv").config();
let { Client, MessageEmbed, Collection, } = require("discord.js");
let { GatewayIntentBits } = require("discord-api-types/v10");
let client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: ["MESSAGE", "CHANNEL", "REACTION", "USER", "GUILD_MEMBER"],
});
let EventEmitter = require("events");
let emitter = new EventEmitter();
emitter.setMaxListeners(30);
let { SlashCommandBuilder } = require("@discordjs/builders");
let { REST } = require("@discordjs/rest");
let { Routes } = require("discord-api-types/v9");
let { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
let ytdl = require("ytdl-core");
let yt = require("youtube-search-without-api-key");

// ------------------------------------------ //

let { BOT_PRESENCE_STATUS, BOT_ACTIVITY_TYPE, BOT_ACTIVITY_DESC } = require("./config/bot-status");
let { log, isValidInteraction, getRandomHex, createEmbedded } = require("./config/functions");
let { commandsInfo, S_C_PLAY, S_C_LOOP, S_C_QLOOP, S_C_SKIP, S_C_STOP } = require("./config/slash-commands");
const { USER_NOT_IN_VC_TEXT, AUDIO_NOT_FOUND_TEXT, PLAY_NEXT_AUDIO_TEXT, NO_SERVER_Q_TEXT, SKIPPING_SONG_TEXT, SKIPPING_LAST_SONG, LOOP_TOGGLE_TEXT, QUEUE_LOOP_TOGGLE_TEXT, DISCONNECT_BOT_TEXT } = require("./config/text-inter");
let queue = new Map();

client.on("ready", async (inter) => {
  log(`Logged in as ${client.user.tag}!`);

  client.user.setPresence({ status: BOT_PRESENCE_STATUS });
  client.user.setActivity(BOT_ACTIVITY_DESC, { type: BOT_ACTIVITY_TYPE });

  let commands = commandsInfo.map(({ name, description, options }) => {
    let cmd = new SlashCommandBuilder().setName(name).setDescription(description);
    if (options === undefined)
      return cmd;
    return cmd.addStringOption(option => {
      return option.setName(String(options.name)).setDescription(String(options.description)).setRequired(options.required);
    });
  });
  commands = commands.map(x => x.toJSON());

  // apply changes to the server
  let rest = new REST().setToken(process.env.MUSIC_BOT_TOKEN);
  (async () => {
    try {
      let data = await rest.put(
        Routes.applicationGuildCommands(process.env.APPLICATION_ID, process.env.GUILD_ID),
        { body: commands },
      );
    } catch (error) {
      console.error(error);
    }
  })();
});

client.on("interactionCreate", async (interaction) => {

  if (!isValidInteraction(interaction)) {
    return;
  }

  let serverQ = queue.get(interaction.guildId); // [guildId, queueInfo]

  switch (interaction.commandName) {
    case S_C_PLAY:
      handleQ();
      break;
    case S_C_LOOP:
      loop();
      break;
    case S_C_QLOOP:
      qLoop();
      break;
    case S_C_SKIP:
      skip();
      break;
    case S_C_STOP:
      stop();
      break;
  }

  /*
  Briefly explaining the queue logic

  if no Q:
    create a Q
    on Idle is handled
    play the first song
  else
    push the song
    on idle (current song is played and we're ready to decide for the next) (is now handled):
      if looping current song:
        return play the first song again
      if looping the queue:
        shift (javascript) & push back
        play the first song
      if songs now >= 2:
        shift the one that just got played
        play next
      else
        delete the queue and reset everything

  */

  async function handleQ() {
    // Must be in a voice channel
    let voiceChannel = interaction.member.voice.channelId;
    if (!voiceChannel) {
      return await interaction.reply(USER_NOT_IN_VC_TEXT(interaction.member.user));
    }

    // Query guaranteed to be non-empty
    let query = interaction.options;

    // If the input song is not found
    let videos = await yt.search(query.data[0].value);
    if (!videos.length) {
      return await interaction.reply(AUDIO_NOT_FOUND_TEXT(interaction.member.user));
    }

    // Creating the song object
    let { title, url, snippet, duration_raw } = videos[0];

    // Is not a valid video
    if (!duration_raw) {
      return await interaction.reply(AUDIO_NOT_FOUND_TEXT(interaction.member.user));
    }
    let song = {
      title,
      url,
      img: snippet.thumbnails.url,
      duration: snippet.duration,
      publishedAt: snippet.publishedAt,
    };

    let hexColor = getRandomHex();

    if (!serverQ) {
      let queueStruct = {
        vc: voiceChannel,
        connection: null,
        songs: [],
        volume: 10,
        playing: true,
        isLooping: false,
        queueLooping: false,
      };
      queue.set(interaction.guildId, queueStruct);
      serverQ = queue.get(interaction.guildId);

      try {
        let connection = joinVoiceChannel({
          channelId: voiceChannel,
          selfDeaf: false,
          guildId: interaction.guildId,
          adapterCreator: interaction.guild.voiceAdapterCreator
        });

        serverQ.connection = connection;
        serverQ.songs.push(song);
        play(serverQ.songs[0]);

        // hexColor, name, thumbnail, field1, field2, user 
        let embObj = {
          hexColor,
          name: interaction.guild.name,
          thumbnail: song.img,
          field1: `**${song.title} (${song.duration})** ${song.publishedAt ? "- " + song.publishedAt : ""}`,
          field2: interaction.member.user,
        }

        let firstEmbed = createEmbedded(embObj);
        return await interaction.reply({ embeds: [firstEmbed] });
      } catch (e) {
        console.error(e)
        queue.delete(interaction.guildId);
      }
    } else {
      serverQ.songs.push(song);

      // hexColor, name, thumbnail, field1, field2, user 
      let obj = {
        hexColor,
        name: interaction.guild.name,
        thumbnail: song.img,
        field1: `**${song.title} (${song.duration})** ${song.publishedAt ? "- " + song.publishedAt : ""}`,
        field2: `has been aded to the queue (${serverQ.songs.length}) - ${interaction.member.user}`,
      }
      let qEmbed = createEmbedded(obj);
      return await interaction.reply({ embeds: [qEmbed] });
    }
  }

  async function play(song) {
    // Dispatcher -> Subscribes to a connection -> Plays a resource
    let dispatcher = createAudioPlayer();
    let resource = createAudioResource(ytdl(song?.url, { highWaterMark: 1024 * 1024 * 10, quality: "highestaudio" }));
    serverQ.connection.subscribe(dispatcher);
    dispatcher.play(resource);

    // After a song is finished
    dispatcher.on(AudioPlayerStatus.Idle, async () => {

      // If current song to be looped, isLooping > queueLooping
      if (serverQ.isLooping) {
        serverQ.queueLooping = false;
        return play(serverQ.songs[0]);
      }

      // Playlist looping, pop and push the popped to back
      if (serverQ.queueLooping) {
        serverQ.songs.push(serverQ.songs.shift());
        return play(serverQ.songs[0]);
      }

      // Either there's songs left, or not
      if (serverQ.songs.length > 1) {
        serverQ.songs.shift();
        let { songs } = serverQ;
        await interaction.channel.send(PLAY_NEXT_AUDIO_TEXT(songs[0].title, songs[0].duration));
        return play(serverQ.songs[0]);
      } else {
        queue.delete(interaction.guildId);
      }
    });
  }

  async function skip() {
    let voiceChannel = interaction.member.voice.channelId;
    if (!voiceChannel) {
      return await interaction.reply(USER_NOT_IN_VC_TEXT(interaction.member.user));
    }
    if (!serverQ) {
      return await interaction.reply(NO_SERVER_Q_TEXT());
    }

    if (serverQ.songs.length > 1) {
      // Log the skipped one, shift and play
      await interaction.reply(SKIPPING_SONG_TEXT(interaction.member.user.username, serverQ.songs[0].title));
      serverQ.songs.shift();
      return play(serverQ.songs[0]);
    } else {
      // Disconnect, reset the queue
      serverQ.connection.destroy();
      queue.delete(interaction.guildId);
      return await interaction.reply(SKIPPING_LAST_SONG());
    }
  }

  async function loop() {
    let voiceChannel = interaction.member.voice.channelId;
    if (!voiceChannel) {
      return await interaction.reply(USER_NOT_IN_VC_TEXT(interaction.member.user));
    }
    if (!serverQ) {
      return await interaction.reply(NO_SERVER_Q_TEXT());
    }
    serverQ.isLooping = !serverQ.isLooping;
    return await interaction.reply(LOOP_TOGGLE_TEXT(serverQ.isLooping));
  }

  async function qLoop() {
    let voiceChannel = interaction.member.voice.channelId;
    if (!voiceChannel) {
      return await interaction.reply(USER_NOT_IN_VC_TEXT(interaction.member.user));
    }
    if (!serverQ) {
      return await interaction.reply(NO_SERVER_Q_TEXT());
    }
    serverQ.queueLooping = !serverQ.queueLooping;
    return await interaction.reply(QUEUE_LOOP_TOGGLE_TEXT(serverQ.queueLooping));
  }

  async function stop() {
    let voiceChannel = interaction.member.voice.channelId;
    if (!voiceChannel) {
      return await interaction.reply(USER_NOT_IN_VC_TEXT(interaction.member.user));
    }
    await interaction.reply(DISCONNECT_BOT_TEXT());
    serverQ.connection.destroy();
    return queue.delete(interaction.guildId);
  }
});

client.login(process.env.MUSIC_BOT_TOKEN);
