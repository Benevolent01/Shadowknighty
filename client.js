const {
  Client,
  MessageEmbed
} = require("discord.js");

const { GatewayIntentBits } = require("discord-api-types/v10");

const client = new Client({
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

require("dotenv").config();

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const ytdl = require("ytdl-core");
const yt = require("youtube-search-without-api-key");

const queue = new Map();

const EventEmitter = require("events");
const emitter = new EventEmitter();
emitter.setMaxListeners(30);

const { SlashCommandBuilder } = require("@discordjs/builders");
const { REST } = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v9");


//Welcome message console and news
client.on("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setPresence({ status: "online" });
  client.user.setActivity("music for this server", { type: "PLAYING" });

  //setup commands & their description
  const commands = [
    new SlashCommandBuilder()
      .setName("play")
      .setDescription("Play a song!")
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("Song name or URL")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("p")
      .setDescription("Play a song!")
      .addStringOption((option) =>
        option
          .setName("query")
          .setDescription("Song name or URL")
          .setRequired(true)
      ),
      new SlashCommandBuilder()
        .setName("skip")
        .setDescription("Skip the current song!"),
    new SlashCommandBuilder()
      .setName("loop")
      .setDescription("Decide whether to loop or not!"),
    new SlashCommandBuilder()
      .setName("qloop")
      .setDescription("Decide whether to loop the playlist or not!"),
    new SlashCommandBuilder()
      .setName("disconnect")
      .setDescription("Stop the bot from playing!"),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "9" }).setToken(process.env.MUSIC_BOT_TOKEN);

  rest
    .put(
      Routes.applicationGuildCommands(
        client.application.id,
        client.guilds.cache.get("894641408433090650").id ||
          client.guilds.cache.get("822604622111178822").id
      ),
      { body: commands }
    )
    .then()
    .catch(console.error);
});

const TIMEOUT_DURATION = 1000 * 60 * 5;

//Functions

//Music Bot
client.on("interactionCreate", async (interaction) => {
  //Slash commands, we need to await.
  if (!interaction.isCommand()) return;
  if (!interaction.guildId) return;
  if (interaction.user.bot) return;
  let serverQ = queue.get(interaction.guildId);

  const { commandName } = interaction;
  
  switch (commandName) {
    case "play":
      handleQ();
      break;
    case "p":
      handleQ();
      break;
    case "disconnect":
      stop();
      break;
    case "skip":
      skip();
      break;
    case "loop":
      loop();
      break;
    case "qloop":
      qLoop();
      break;
  }

  //Resources

  //First song, we make the map and play the first song, if there is a Q, just push it.
  async function handleQ(){
    let voiceChannel = interaction.member.voice.channelId;
    if(!voiceChannel) return await interaction.reply(`${interaction.member.user.username} join a voice channel and I might play!`);

    //Get the Song details
    let query = interaction.options;
    if(query.data.length == 0) return await interaction.reply(`${interaction.member.user.username} please request a song!`);

    //If the videos array is empty it means the song is invalid
    let videos = await yt.search(query.data[0].value);
    if(videos.length == 0) return await interaction.reply("I couldn't find this song! Please try again?!"); 

    //Creating the song object
    let song = { title: videos[0].title, url: videos[0].url, img: videos[0].snippet.thumbnails.url, duration: videos[0].snippet.duration };

    //Playing resources

    //Get Embedded Random Color
    const hex = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, "A", "B", "C", "D", "E", "F"];
    let hexColor = "#";
    const getRandomNum = () => Math.floor(Math.random() * hex.length);
    for (let i = 0; i < 6; i++) {
      hexColor += hex[getRandomNum()];
    }

    if(!serverQ){
      const queueStruct = { vc: voiceChannel, connection: null, songs: [], volume: 10, playing: true, isLooping: false, queueLooping: false, a: null };
      //setting the object to the map, giving value to serverQ so we can access it with just serverQ
      queue.set(interaction.guildId, queueStruct);
      serverQ = queue.get(interaction.guildId);
      
      try {
        //You can manage here, deaf mute for the bot
        let connection = joinVoiceChannel({ channelId: voiceChannel, selfDeaf: false, guildId: interaction.guildId, adapterCreator: interaction.guild.voiceAdapterCreator });
        serverQ.connection = connection;

        serverQ.songs.push(song);
        play(serverQ.songs[0]);

        //Embed
        const playEmbed = new MessageEmbed()
        .setColor(hexColor)
        .setTitle(interaction.guild.name)
        .setThumbnail(serverQ.songs[0].img)
        .addField(
          `**${serverQ.songs[0].title}** **(${serverQ.songs[0].duration})**`,
          `- <@${interaction.member.user.id}>`
        )
        .setTimestamp();

        return await interaction.reply({ embeds: [playEmbed] });

      } catch (e) {
        console.error(e)
        queue.delete(interaction.guildId); return
      }
    } else {
      serverQ.songs.push(song);
      if(serverQ.a){
        play(serverQ.songs[0]);
      }

      const queueEmbed = new MessageEmbed()
        .setColor(hexColor)
        .setTitle(interaction.guild.name)
        .setThumbnail(song.img)
        .addField(
          `**${song.title}**`,
          `has been added to the queue (${serverQ.songs.length}) - <@${interaction.member.user.id}>`
        )
        .setTimestamp();
      return await interaction.reply({ embeds: [queueEmbed] });
    }
  }
  
  /*If a song changes, we've already called it on handleQ once, so on Idle, if we're not looping it plays the next song, if we're not looping and
  there's only one song, rest
  */
  async function play(song){
    //You create a dispatcher, you subscribe it to the connection, and have it play a resource.
    //Initializing
    if(serverQ.a != null) { clearTimeout(serverQ.a); serverQ.a = null; }
    let dispatcher = createAudioPlayer();
    const resource = createAudioResource(ytdl(song?.url, { highWaterMark: 1024 * 1024 * 10, filter: "audioonly", quality: 'highestaudio' }));
    serverQ.connection.subscribe(dispatcher);
    dispatcher.play(resource);

    //Handle changes on no-skip
    dispatcher.on(AudioPlayerStatus.Idle, async () =>{
      //Play next song
      if(serverQ.songs.length > 1 && !serverQ.isLooping && !serverQ.queueLooping) {
        serverQ.songs.shift();
        play(serverQ.songs[0]);
        return await interaction.channel.send(`⭐ Now playing **${serverQ.songs[0].title}** **(${serverQ.songs[0].duration})** !`);
      }
      //Don't kick the bot if we didn't queue another song, just let it be but delete the q
      if(serverQ.songs.length == 1  && !serverQ.isLooping && !serverQ.queueLooping) {
         serverQ.songs.shift();
        let timeout = setTimeout(stopAll, TIMEOUT_DURATION);
        serverQ.a = timeout;
        function stopAll(){serverQ.connection.destroy(); queue.delete(interaction.guildId);}
      }
      //Play the same song
      if(serverQ.isLooping == true) {
        return play(serverQ.songs[0]);
      }
      //Play the same queue
      if(serverQ.queueLooping == true) {
        serverQ.songs.push(serverQ.songs.shift());
        return play(serverQ.songs[0]);
      }
    })
  }
  //
  async function skip(){
    if (!interaction.member.voice.channel) return await interaction.reply("You need to join the voice channel first!");
    if (!serverQ) return await interaction.reply("There is nothing to skip!");
    if(serverQ.songs.length > 1){
      serverQ.songs.shift();
      play(serverQ.songs[0]);
      return await interaction.reply(`${interaction.member.user.username}, I'm skipping this song! Playing next..`)

    } else {
      //If we have one song and we skip stop the dispatcher, and after some time kick it, if in that meantime we adda song, clear that timeout
      serverQ.songs.shift();
      // play(serverQ.songs[0]);
      const dispatcher = createAudioPlayer();
      serverQ.connection.subscribe(dispatcher);
      dispatcher.stop(); let timeout = setTimeout(stopAll, TIMEOUT_DURATION);
      serverQ.a = timeout;
      function stopAll(){serverQ.connection.destroy(); queue.delete(interaction.guildId);}
      return await interaction.reply(`${interaction.member.user.username} this was the last song in the queue! Cooling down..`)
    }
  
  }
  async function loop() {
    if (!interaction.member.voice.channel) return await interaction.reply("You need to join the voice channel first!");
    if (!serverQ) return await interaction.reply("There is nothing to loop for!");

    serverQ.isLooping = !serverQ.isLooping;
    if (serverQ.isLooping == true) {
      await interaction.reply("⭐ **Looping** is now enabled  ✅");
    } else if (serverQ.isLooping == false) {
      await interaction.reply("⭐ **Looping** is now disabled  ❌");
    }
  }
  async function qLoop(){
    if (!interaction.member.voice.channel) return await interaction.reply("You need to join the voice channel first!");
    if (!serverQ) return await interaction.reply("There is nothing to loop for!");

    serverQ.queueLooping = !serverQ.queueLooping;
    if (serverQ.queueLooping == true) {
      await interaction.reply("⭐ **Queue Looping** is now enabled  ✅");
    } else if (serverQ.queueLooping == false) {
      await interaction.reply("⭐ **Queue Looping** is now disabled  ❌");
    }
  }
  async function stop() {
    if(!serverQ) return await interaction.reply("I'm not currently in a voice chat!")
    await interaction.reply("✅ Quitting the voice channel and shutting down... ");
    serverQ.connection.destroy();
    return queue.delete(interaction.guildId); 
  }
});

client.login(process.env.MUSIC_BOT_TOKEN);
