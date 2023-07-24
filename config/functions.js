const { MessageEmbed } = require("discord.js");

// fast log
let log = (...msg) => { msg.forEach(x => console.log(x))};

// Random hex color
let getRandomHex = () => {
  let hex = "0123456789ABCDEF".split("");
  let hexColor = "#";
  let getRandomNum = () => Math.floor(Math.random() * hex.length);
  for (let i = 0; i < 6; i++) {
    hexColor += hex[getRandomNum()];
  }
  return hexColor;
}

// validate interaction
let isValidInteraction = (action) => {
  if (!action.isCommand() || !action.guildId || action.user.bot) {
    return false;
  }
  return true;
}

// hexColor, name, thumbnail, field1, field2, user
let createEmbedded = (obj) => {
  let emb = new MessageEmbed();
  
  obj.user ??= "",
  obj.name && emb.setTitle(obj.name);
  obj.hexColor && emb.setColor(obj.hexColor);
  obj.thumbnail && emb.setThumbnail(obj.thumbnail);
  // If field1 exists, add it, of field2 is null add the user and if user is null too let it empty
  obj.field1 && emb.addField(`${obj.field1}`, `${obj.field2 ??= obj.user}`)
  emb.setTimestamp();
  return emb;
}

module.exports = { log, getRandomHex, isValidInteraction, createEmbedded };