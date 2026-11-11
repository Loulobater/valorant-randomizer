require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const { randomUUID } = require("node:crypto");

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Erreur : DISCORD_TOKEN est absent. Vérifiez votre fichier .env.");
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const sessions = new Map();
const SESSION_TIMEOUT_MS = 120 * 60 * 1000;

function sessionEmbed(session) {
  const participants = [...session.participants.values()]
    .sort((a, b) => a.joinedAt - b.joinedAt);
  const participantText = participants.length
    ? participants.map((p, i) => `${i + 1}. <@${p.id}>`).join("\n")
    : "Personne pour le moment. Clique sur **Je participe** pour rejoindre !";

  return new EmbedBuilder()
    .setColor(0xD83C3E)
    .setTitle("🎲 Session Valorant")
    .setDescription(
      `**Responsable :** <@${session.ownerId}>\n\n` +
      `**Participants (${participants.length}/${session.maxPlayers})**\n${participantText}\n\n` +
      "La session se ferme après 120 minutes sans tirage."
    )
    .setFooter({ text: "Les inscriptions restent ouvertes jusqu'à ce que la session soit complète." });
}

function sessionButtons(session) {
  const full = session.participants.size >= session.maxPlayers;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vr_join_${session.id}`)
      .setLabel("Je participe")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success)
      .setDisabled(full),
    new ButtonBuilder()
      .setCustomId(`vr_leave_${session.id}`)
      .setLabel("Je quitte")
      .setEmoji("🚪")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function refreshSession(session) {
  await session.message.edit({
    embeds: [sessionEmbed(session)],
    components: [sessionButtons(session)]
  });
}

async function closeSession(session, reason) {
  clearTimeout(session.timer);
  sessions.delete(session.id);
  await session.message.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(0x777777)
        .setTitle("Session Valorant terminée")
        .setDescription(reason)
    ],
    components: []
  }).catch(() => {});
}

function scheduleAutoClose(session) {
  clearTimeout(session.timer);
  session.timer = setTimeout(() => {
    closeSession(session, "⏰ Fermeture automatique : aucun tirage depuis 120 minutes.")
      .catch(console.error);
  }, SESSION_TIMEOUT_MS);
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecté à Discord en tant que ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "roulette") {
      const existing = [...sessions.values()].find(
        (s) => s.guildId === interaction.guildId && s.channelId === interaction.channelId
      );
      if (existing) {
        await interaction.reply({
          content: "Une session est déjà active dans ce salon.",
          ephemeral: true
        });
        return;
      }

      const maxPlayers = interaction.options.getInteger("places") ?? 10;
      const session = {
        id: randomUUID(),
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        ownerId: interaction.user.id,
        maxPlayers,
        participants: new Map(),
        message: null,
        timer: null
      };

      await interaction.reply({
        embeds: [sessionEmbed(session)],
        components: [sessionButtons(session)],
        fetchReply: true
      });
      session.message = await interaction.fetchReply();
      sessions.set(session.id, session);
      scheduleAutoClose(session);
      return;
    }

    if (interaction.isButton()) {
      const match = interaction.customId.match(/^vr_(join|leave)_(.+)$/);
      if (!match) return;

      const session = sessions.get(match[2]);
      if (!session) {
        await interaction.reply({
          content: "Cette session n'est plus active.",
          ephemeral: true
        });
        return;
      }

      const action = match[1];
      const userId = interaction.user.id;

      if (action === "join") {
        if (session.participants.has(userId)) {
          await interaction.reply({ content: "Tu participes déjà à cette session.", ephemeral: true });
          return;
        }
        if (session.participants.size >= session.maxPlayers) {
          await interaction.reply({ content: "Désolé, la session est complète.", ephemeral: true });
          return;
        }
        session.participants.set(userId, {
          id: userId,
          joinedAt: Date.now()
        });
      } else {
        session.participants.delete(userId);

        if (userId === session.ownerId) {
          const nextOwner = [...session.participants.values()]
            .sort((a, b) => a.joinedAt - b.joinedAt)[0];
          if (nextOwner) {
            session.ownerId = nextOwner.id;
          }
        }
      }

      if (session.participants.size === 0) {
        await interaction.update({
          embeds: [
            new EmbedBuilder()
              .setColor(0x777777)
              .setTitle("Session Valorant terminée")
              .setDescription("La session est fermée car il ne reste aucun participant.")
          ],
          components: []
        });
        clearTimeout(session.timer);
        sessions.delete(session.id);
        return;
      }

      await interaction.deferUpdate();
      await refreshSession(session);
    }
  } catch (error) {
    console.error("Erreur lors du traitement d'une interaction :", error);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "Une erreur est survenue. Réessaie dans un instant.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

client.login(token).catch((error) => {
  console.error("Impossible de connecter le bot à Discord :", error.message);
  process.exit(1);
});
