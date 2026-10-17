import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// Vorerst temporäre Speicherung
const users = new Map();

function getUser(userId) {
  if (!users.has(userId)) {
    users.set(userId, {
      miles: 0,
      wallet: 0,
      bank: 0,
      lastDaily: 0
    });
  }

  return users.get(userId);
}

function getStatus(miles) {
  if (miles >= 15000) return "💎 Elite Plus";
  if (miles >= 7500) return "🥇 Elite";
  if (miles >= 3000) return "🥈 Classic Plus";
  return "✈️ Classic";
}

const commands = [
  new SlashCommandBuilder()
    .setName("miles")
    .setDescription("Zeigt deine TK Miles an."),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Zeigt deinen Miles & Smiles Status an."),

  new SlashCommandBuilder()
    .setName("bank")
    .setDescription("Zeigt dein TK Bankkonto an."),

  new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Hole deine tägliche TK-Credits-Belohnung."),

  new SlashCommandBuilder()
    .setName("addmiles")
    .setDescription("Vergibt Miles an ein Mitglied.")
    .addUserOption(option =>
      option
        .setName("mitglied")
        .setDescription("Mitglied")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("anzahl")
        .setDescription("Anzahl der Miles")
        .setMinValue(1)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("transfer")
    .setDescription("Überweise TK Credits an ein Mitglied.")
    .addUserOption(option =>
      option
        .setName("mitglied")
        .setDescription("Empfänger")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("anzahl")
        .setDescription("Anzahl der TK Credits")
        .setMinValue(1)
        .setRequired(true)
    )
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} ist online!`);

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN
  );

  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log("✅ Slash-Commands wurden registriert.");
  } catch (error) {
    console.error(error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const account = getUser(interaction.user.id);

  if (interaction.commandName === "miles") {
    const embed = new EmbedBuilder()
      .setTitle("✈️ TK Miles & Smiles")
      .setDescription(`Willkommen, ${interaction.user}!`)
      .addFields(
        {
          name: "Miles",
          value: `**${account.miles.toLocaleString("de-DE")} Miles**`
        },
        {
          name: "Status",
          value: getStatus(account.miles)
        }
      )
      .setFooter({
        text: "TK Miles & Smiles • Official Discord Assistant"
      });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "status") {
    return interaction.reply(
      `✈️ Dein Status: **${getStatus(account.miles)}**\n` +
      `Du besitzt **${account.miles.toLocaleString("de-DE")} Miles**.`
    );
  }

  if (interaction.commandName === "bank") {
    const embed = new EmbedBuilder()
      .setTitle("🏦 TK Bank")
      .addFields(
        {
          name: "👛 Wallet",
          value: `${account.wallet.toLocaleString("de-DE")} TK Credits`,
          inline: true
        },
        {
          name: "🏦 Bank",
          value: `${account.bank.toLocaleString("de-DE")} TK Credits`,
          inline: true
        }
      )
      .setFooter({
        text: "Virtuelle Währung • Kein Echtgeldwert"
      });

    return interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "daily") {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;

    if (now - account.lastDaily < cooldown) {
      const remaining = cooldown - (now - account.lastDaily);
      const hours = Math.ceil(remaining / 3600000);

      return interaction.reply({
        content:
          `⏳ Deine nächste Daily-Belohnung ist in ungefähr **${hours} Stunden** verfügbar.`,
        ephemeral: true
      });
    }

    const reward = 250;

    account.wallet += reward;
    account.lastDaily = now;

    return interaction.reply(
      `🎁 Du hast **${reward} TK Credits** erhalten!`
    );
  }

  if (interaction.commandName === "addmiles") {
    const member = interaction.options.getUser("mitglied");
    const amount = interaction.options.getInteger("anzahl");

    const target = getUser(member.id);
    target.miles += amount;

    return interaction.reply(
      `✅ ${member} hat **${amount.toLocaleString("de-DE")} Miles** erhalten.\n` +
      `Neuer Kontostand: **${target.miles.toLocaleString("de-DE")} Miles**`
    );
  }

  if (interaction.commandName === "transfer") {
    const member = interaction.options.getUser("mitglied");
    const amount = interaction.options.getInteger("anzahl");

    if (member.bot) {
      return interaction.reply({
        content: "❌ Du kannst keine TK Credits an einen Bot überweisen.",
        ephemeral: true
      });
    }

    if (member.id === interaction.user.id) {
      return interaction.reply({
        content: "❌ Du kannst dir nicht selbst TK Credits überweisen.",
        ephemeral: true
      });
    }

    if (account.wallet < amount) {
      return interaction.reply({
        content: "❌ Du hast nicht genügend TK Credits in deinem Wallet.",
        ephemeral: true
      });
    }

    const receiver = getUser(member.id);

    account.wallet -= amount;
    receiver.wallet += amount;

    return interaction.reply(
      `💸 ${interaction.user} hat **${amount} TK Credits** an ${member} überwiesen.`
    );
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN fehlt.");
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
