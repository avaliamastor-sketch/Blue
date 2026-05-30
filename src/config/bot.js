import discord
from discord.ext import commands
import json
import os

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix=",", intents=intents, help_command=None)

# Changed file name to start a fresh, 100% separated database
JSON_FILE = "server_reactions.json"

def load_reactions():
    if not os.path.exists(JSON_FILE):
        return {}
    with open(JSON_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_reactions(data):
    with open(JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


@bot.event
async def on_ready():
    print("-----------------------------------")
    print(f"Bot is now ONLINE successfully!")
    print(f"Logged in as: {bot.user.name}")
    print("-----------------------------------")


@bot.event
async def on_message(message):
    if message.author == bot.user or not message.guild:
        return

    reactions_data = load_reactions()
    guild_id = str(message.guild.id)
    
    if guild_id in reactions_data and isinstance(reactions_data[guild_id], dict):
        content_lower = message.content.lower()
        for keyword, emojis in reactions_data[guild_id].items():
            if keyword in content_lower:
                if isinstance(emojis, list):
                    for emoji in emojis:
                        try:
                            await message.add_reaction(emoji)
                        except Exception as e:
                            print(f"Error adding reaction: {e}")
                else:
                    try:
                        await message.add_reaction(emojis)
                    except Exception as e:
                        print(f"Error adding reaction: {e}")

    await bot.process_commands(message)


class HelpDropdown(discord.ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="Main Page", description="Overview of the bot", emoji="🏠"),
            discord.SelectOption(label="Auto-Reaction", description="Commands for managing reactions", emoji="🎭"),
            discord.SelectOption(label="Utility & Fun", description="General bot commands", emoji="⚙️")
        ]
        super().__init__(placeholder="Select a category to explore...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        if self.values[0] == "Main Page":
            embed = discord.Embed(
                title="✨ Blue Bot Help Menu",
                description="Welcome to the help panel! Use the dropdown menu below to see available commands.\n\n**Prefix:** `,`",
                color=discord.Color.blue()
            )
            embed.add_field(name="🔗 Links", value="[Support Server](https://discord.gg/) • [Invite Bot](https://discord.com/)", inline=False)
            await interaction.response.edit_message(embed=embed, view=self.view)

        elif self.values[0] == "Auto-Reaction":
            embed = discord.Embed(
                title="🎭 Auto-Reaction Configuration",
                description="Manage keywords and emojis that the bot will automatically react to.",
                color=discord.Color.green()
            )
            embed.add_field(name="`,autoreact add [keyword/emoji] [emojis...]`", value="Adds emojis to a trigger (Max 6 emojis per trigger).\n*Example:* `,autoreact add hello 🫡`", inline=False)
            embed.add_field(name="`,autoreact removeall [keyword/emoji]`", value="Removes ALL auto-reactions linked to a word or emoji.", inline=False)
            embed.add_field(name="`,autoreact removeone [keyword/emoji] [emoji]`", value="Removes only ONE specific emoji from a word's list.\n*Example:* `,autoreact removeone hello 🫡`", inline=False)
            embed.add_field(name="`,autoreact list`", value="Displays a list of all active auto-reaction triggers and their emojis.", inline=False)
            await interaction.response.edit_message(embed=embed, view=self.view)

        elif self.values[0] == "Utility & Fun":
            embed = discord.Embed(
                title="⚙️ Utility & Fun Commands",
                description="General features available for all members.",
                color=discord.Color.purple()
            )
            embed.add_field(name="`,help`", value="Displays this interactive help menu.", inline=False)
            embed.add_field(name="`,quote`", value="*(Coming Soon)* Stay tuned!", inline=False)
            await interaction.response.edit_message(embed=embed, view=self.view)

class HelpView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=60)
        self.add_item(HelpDropdown())


@bot.command(name="help")
async def help_command(ctx):
    embed = discord.Embed(
        title="✨ Blue Bot Help Menu",
        description="Welcome to the help panel! Use the dropdown menu below to see available commands.\n\n**Prefix:** `,`",
        color=discord.Color.blue()
    )
    embed.add_field(name="🔗 Links", value="[Support Server](https://discord.gg/) • [Invite Bot](https://discord.com/)", inline=False)
    
    view = HelpView()
    await ctx.send(embed=embed, view=view)


@bot.group(name="autoreact", invoke_without_command=True)
async def autoreact(ctx):
    await ctx.send("Usage: `,autoreact add`, `,autoreact removeall`, `,autoreact removeone`, or `,autoreact list`")

@autoreact.command(name="add")
async def autoreact_add(ctx, keyword: str, *new_emojis: str):
    if not ctx.guild:
        return
    if not new_emojis:
        await ctx.send("❌ Please provide at least one emoji to react with.")
        return

    keyword = keyword.lower()
    data = load_reactions()
    guild_id = str(ctx.guild.id)
    
    if guild_id not in data or not isinstance(data[guild_id], dict):
        data[guild_id] = {}
        
    current_emojis = data[guild_id].get(keyword, [])
    if not isinstance(current_emojis, list):
        current_emojis = [current_emojis]

    combined_emojis = list(current_emojis)
    for emoji in new_emojis:
        if emoji not in combined_emojis:
            combined_emojis.append(emoji)

    if len(combined_emojis) > 6:
        embed = discord.Embed(
            description=f"❌ **{ctx.author.mention}: Limit reached!** You can only add up to **6 emojis** per trigger.\n\n*Current emojis for `{keyword}`:* {' '.join(current_emojis)}",
            color=discord.Color.red()
        )
        await ctx.send(embed=embed)
        return

    data[guild_id][keyword] = combined_emojis
    save_reactions(data)
    
    all_emojis_str = " ".join(data[guild_id][keyword])
    embed = discord.Embed(
        description=f"✅ **{ctx.author.mention}: Current emojis for** `{keyword}` ({len(data[guild_id][keyword])}/6) ➔ {all_emojis_str}",
        color=discord.Color.green()
    )
    await ctx.send(embed=embed)

@autoreact.command(name="removeall")
async def autoreact_removeall(ctx, keyword: str):
    if not ctx.guild:
        return
        
    keyword = keyword.lower()
    data = load_reactions()
    guild_id = str(ctx.guild.id)
    
    if guild_id in data and isinstance(data[guild_id], dict) and keyword in data[guild_id]:
        del data[guild_id][keyword]
        save_reactions(data)
        embed = discord.Embed(
            description=f"✅ **{ctx.author.mention}: Removed all reactions for** `{keyword}`",
            color=discord.Color.red()
        )
        await ctx.send(embed=embed)
    else:
        await ctx.send(f"❌ Trigger `{keyword}` not found in this server's auto-reactions.")

@autoreact.command(name="removeone")
async def autoreact_removeone(ctx, keyword: str, emoji_to_remove: str):
    if not ctx.guild:
        return
        
    keyword = keyword.lower()
    data = load_reactions()
    guild_id = str(ctx.guild.id)
    
    if guild_id in data and isinstance(data[guild_id], dict) and keyword in data[guild_id]:
        current_emojis = data[guild_id][keyword]
        if not isinstance(current_emojis, list):
            current_emojis = [current_emojis]
            
        if emoji_to_remove in current_emojis:
            current_emojis.remove(emoji_to_remove)
            
            if not current_emojis:
                del data[guild_id][keyword]
                msg_text = f"✅ **{ctx.author.mention}: Removed** {emoji_to_remove}. No emojis left, trigger `{keyword}` cleared entirely."
            else:
                data[guild_id][keyword] = current_emojis
                all_emojis_str = " ".join(current_emojis)
                msg_text = f"✅ **{ctx.author.mention}: Removed** {emoji_to_remove} from `{keyword}`.\n*Remaining emojis ({len(current_emojis)}/6):* {all_emojis_str}"
                
            save_reactions(data)
            embed = discord.Embed(description=msg_text, color=discord.Color.red())
            await ctx.send(embed=embed)
        else:
            await ctx.send(f"❌ The emoji {emoji_to_remove} is not part of the active reactions for `{keyword}`.")
    else:
        await ctx.send(f"❌ Trigger `{keyword}` not found in this server's auto-reactions.")

@autoreact.command(name="list")
async def autoreact_list(ctx):
    if not ctx.guild:
        return
        
    data = load_reactions()
    guild_id = str(ctx.guild.id)
    
    if guild_id not in data or not isinstance(data[guild_id], dict) or not data[guild_id]:
        embed = discord.Embed(
            description="📂 No auto-reactions setup yet for this server.",
            color=discord.Color.orange()
        )
        await ctx.send(embed=embed)
        return

    description_text = ""
    for keyword, emojis in data[guild_id].items():
        emojis_str = " ".join(emojis) if isinstance(emojis, list) else emojis
        description_text += f"• `{keyword}` ➔ {emojis_str}\n"

    embed = discord.Embed(
        title="🎭 Active Auto-Reactions List",
        description=description_text,
        color=discord.Color.blue()
    )
    await ctx.send(embed=embed)


bot.run("YOUR_BOT_TOKEN")
