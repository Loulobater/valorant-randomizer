require("dotenv").config();

const { Client, GatewayIntentBits, Events } = require("discord.js");

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error("Erreur : DISCORD_TOKEN est absent. Vérifiez votre fichier .env.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecté à Discord en tant que ${readyClient.user.tag}`);
});

client.login(token).catch((error) => {
  console.error("Impossible de connecter le bot à Discord :", error.message);
  process.exit(1);
});
