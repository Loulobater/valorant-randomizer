require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token || !clientId) {
  console.error("Erreur : DISCORD_TOKEN ou CLIENT_ID est absent du fichier .env.");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Créer une session Valorant")
    .addIntegerOption((option) =>
      option
        .setName("places")
        .setDescription("Nombre maximum de participants (2 à 10)")
        .setMinValue(2)
        .setMaxValue(10)
        .setRequired(false)
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("tirage")
    .setDescription("Lancer un tirage aléatoire des équipes")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("fermer")
    .setDescription("Fermer la session Valorant en cours")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("Enregistrement des commandes Discord...");
    await rest.put(Routes.applicationGuildCommands(clientId, "1569459621830201396"), { body: commands });
    console.log("Commandes /roulette, /tirage et /fermer enregistrées sur le serveur de test.");
  } catch (error) {
    console.error("Impossible d'enregistrer les commandes :", error);
    process.exit(1);
  }
})();
