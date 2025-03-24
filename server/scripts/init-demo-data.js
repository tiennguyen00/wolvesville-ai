const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function main() {
  try {
    // Create a connection pool
    const pool = new Pool({
      user: process.env.DB_USER || "admin",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "wolvesville",
      password: process.env.DB_PASSWORD || "",
      port: process.env.DB_PORT || 5432,
    });

    console.log("Connected to PostgreSQL database");

    // First execute the schema SQL file
    // const schemaFile = path.join(__dirname, "db-setup.sql");
    // const schemaSql = fs.readFileSync(schemaFile, "utf8");
    // console.log("Executing schema SQL...");
    // await pool.query(schemaSql);
    // console.log("Schema created successfully");

    // Create demo data
    // 1. Create a demo user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const insertUserResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, bio, avatar, gold_coins, gems) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (email) DO UPDATE 
       SET username = EXCLUDED.username, 
           bio = EXCLUDED.bio,
           avatar = EXCLUDED.avatar
       RETURNING user_id`,
      [
        "demouser",
        "demo@example.com",
        hashedPassword,
        "I am a demo user for the Wolvesville app!",
        "https://via.placeholder.com/150",
        1000,
        50,
      ]
    );

    console.log("Demo user created");
    const demoUserId = insertUserResult.rows[0].user_id;

    // 2. Insert game roles
    const roles = [
      {
        name: "Villager",
        faction: "Village",
        description:
          "A simple villager trying to survive and eliminate the werewolves.",
        ability_description:
          "No special abilities, but can vote during the day.",
        icon: "/icons/roles/villager.png",
      },
      {
        name: "Werewolf",
        faction: "Werewolves",
        description:
          "A werewolf hiding among the villagers, trying to eliminate them one by one.",
        ability_description:
          "Can vote with other werewolves to kill a villager each night.",
        icon: "/icons/roles/werewolf.png",
      },
      {
        name: "Seer",
        faction: "Village",
        description:
          "A villager with the ability to see the true nature of other players.",
        ability_description:
          "Can check one player each night to learn if they are a werewolf or not.",
        icon: "/icons/roles/seer.png",
      },
      {
        name: "Doctor",
        faction: "Village",
        description:
          "A medical professional who can protect others from werewolf attacks.",
        ability_description:
          "Can protect one player each night from being killed.",
        icon: "/icons/roles/doctor.png",
      },
      {
        name: "Hunter",
        faction: "Village",
        description: "A skilled hunter who can take revenge even in death.",
        ability_description:
          "When killed, can immediately eliminate another player.",
        icon: "/icons/roles/hunter.png",
      },
    ];

    const roleIds = {};
    for (const role of roles) {
      const result = await pool.query(
        `INSERT INTO roles (role_name, faction, description, ability_description, icon) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (role_name) DO UPDATE 
         SET faction = EXCLUDED.faction,
             description = EXCLUDED.description,
             ability_description = EXCLUDED.ability_description,
             icon = EXCLUDED.icon
         RETURNING role_id`,
        [
          role.name,
          role.faction,
          role.description,
          role.ability_description,
          role.icon,
        ]
      );
      roleIds[role.name] = result.rows[0].role_id;
    }
    console.log("Game roles created");

    // 3. Insert some achievements
    const achievements = [
      {
        name: "First Win",
        description: "Win your first game",
        icon: "/icons/achievements/first-win.png",
        points: 10,
        difficulty: "easy",
      },
      {
        name: "Wolf Pack",
        description: "Win 5 games as a Werewolf",
        icon: "/icons/achievements/wolf-pack.png",
        points: 25,
        difficulty: "medium",
      },
      {
        name: "Village Hero",
        description: "Save a villager from the werewolves",
        icon: "/icons/achievements/village-hero.png",
        points: 15,
        difficulty: "easy",
      },
      {
        name: "Perfect Detective",
        description: "Correctly identify 3 werewolves in one game",
        icon: "/icons/achievements/detective.png",
        points: 30,
        difficulty: "hard",
      },
      {
        name: "Mastermind",
        description: "Win 10 games in a row",
        icon: "/icons/achievements/mastermind.png",
        points: 50,
        difficulty: "legendary",
      },
    ];

    for (const achievement of achievements) {
      await pool.query(
        `INSERT INTO achievements (name, description, icon, points, difficulty) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (name) DO NOTHING`,
        [
          achievement.name,
          achievement.description,
          achievement.icon,
          achievement.points,
          achievement.difficulty,
        ]
      );
    }
    console.log("Achievements created");

    // 4. Create some items
    const items = [
      {
        name: "Golden Wolf Skin",
        description: "A special golden skin for werewolf players",
        price_coins: 1000,
        price_gems: 10,
        item_type: "skin",
        rarity: "rare",
        icon: "/icons/items/golden-wolf.png",
      },
      {
        name: "Special Chat Emotes",
        description: "Exclusive chat emotes to use in game",
        price_coins: 500,
        price_gems: 5,
        item_type: "emote",
        rarity: "common",
        icon: "/icons/items/emotes.png",
      },
      {
        name: "Mystic Aura",
        description: "A special effect showing around your avatar",
        price_coins: null,
        price_gems: 25,
        item_type: "effect",
        rarity: "epic",
        icon: "/icons/items/mystic-aura.png",
      },
    ];

    const itemIds = [];
    for (const item of items) {
      const result = await pool.query(
        `INSERT INTO items (name, description, price_coins, price_gems, item_type, rarity, icon) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         ON CONFLICT (name) DO NOTHING
         RETURNING item_id`,
        [
          item.name,
          item.description,
          item.price_coins,
          item.price_gems,
          item.item_type,
          item.rarity,
          item.icon,
        ]
      );
      if (result.rows.length > 0) {
        itemIds.push(result.rows[0].item_id);
      }
    }
    console.log("Items created");

    // 5. Assign some items to the demo user
    if (itemIds.length > 0) {
      await pool.query(
        `INSERT INTO user_items (user_id, item_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, item_id) DO NOTHING`,
        [demoUserId, itemIds[0]]
      );
    }
    console.log("Items assigned to demo user");

    // 6. Create some game sessions
    const gameModes = ["classic", "quick", "custom", "ranked", "custom"];
    const gameStatuses = [
      "completed",
      "completed",
      "completed",
      "completed",
      "completed",
    ];
    const gamePhases = ["results", "results", "results", "results", "results"];
    const winnerFactions = [
      "Village",
      "Werewolves",
      "Village",
      "Village",
      "Werewolves",
    ];
    const gameIds = [];

    for (let i = 0; i < 5; i++) {
      const result = await pool.query(
        `INSERT INTO games (game_mode, host_id, status, max_players, current_phase, 
                          created_at, started_at, ended_at, winner_faction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING game_id`,
        [
          gameModes[i % gameModes.length],
          demoUserId,
          gameStatuses[i % gameStatuses.length],
          12,
          gamePhases[i % gamePhases.length],
          new Date(Date.now() - (10 - i) * 86400000), // Different dates in the past
          new Date(Date.now() - (10 - i) * 86400000 + 3600000), // Start time
          new Date(Date.now() - (10 - i) * 86400000 + 7200000), // End time
          winnerFactions[i % winnerFactions.length],
        ]
      );
      gameIds.push(result.rows[0].game_id);
    }
    console.log("Game sessions created");

    // 7. Create player games (participation records)
    const roleNames = ["Villager", "Werewolf", "Seer", "Doctor", "Hunter"];
    const gameResults = ["victory", "defeat", "victory", "victory", "defeat"];
    const isAliveStates = [true, false, true, false, true];

    for (let i = 0; i < gameIds.length; i++) {
      const roleName = roleNames[i % roleNames.length];
      const roleId = roleIds[roleName];

      await pool.query(
        `INSERT INTO player_games (user_id, game_id, role_id, is_alive, result, 
                                  eliminations, xp_earned, coins_earned)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, game_id) DO NOTHING`,
        [
          demoUserId,
          gameIds[i],
          roleId,
          isAliveStates[i % isAliveStates.length],
          gameResults[i % gameResults.length],
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 100) + 50,
          Math.floor(Math.random() * 50) + 20,
        ]
      );
    }
    console.log("Player game records created");

    // 8. Create some chat messages
    const chatTypes = ["public", "public", "werewolf", "dead", "private"];

    for (let i = 0; i < gameIds.length; i++) {
      await pool.query(
        `INSERT INTO chat_messages (game_id, user_id, message, chat_type)
         VALUES ($1, $2, $3, $4)`,
        [
          gameIds[i],
          demoUserId,
          `This is a test message in game ${i + 1}`,
          chatTypes[i % chatTypes.length],
        ]
      );
    }
    console.log("Chat messages created");

    // 9. Create some game events
    for (let i = 0; i < gameIds.length; i++) {
      const eventType = i % 2 === 0 ? "kill" : "vote";
      const eventData =
        i % 2 === 0
          ? JSON.stringify({
              killer: demoUserId,
              target: "00000000-0000-0000-0000-000000000000",
              phase: "night",
            })
          : JSON.stringify({
              voter: demoUserId,
              target: "00000000-0000-0000-0000-000000000000",
              phase: "day",
            });

      await pool.query(
        `INSERT INTO game_events (game_id, event_type, event_data)
         VALUES ($1, $2, $3)`,
        [gameIds[i], eventType, eventData]
      );
    }
    console.log("Game events created");

    // 10. Create game votes
    for (let i = 0; i < gameIds.length; i++) {
      await pool.query(
        `INSERT INTO game_votes (game_id, voter_id, target_id, vote_type, phase_number)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          gameIds[i],
          demoUserId,
          demoUserId, // Self-vote for demo purposes
          "day_vote",
          i + 1,
        ]
      );
    }
    console.log("Game votes created");

    // 11. Assign achievements to the demo user
    const achievementResults = await pool.query(
      "SELECT achievement_id FROM achievements LIMIT 3"
    );

    for (const achievement of achievementResults.rows) {
      await pool.query(
        `INSERT INTO user_achievements (user_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, achievement_id) DO NOTHING`,
        [demoUserId, achievement.achievement_id]
      );
    }
    console.log("Achievements assigned to demo user");

    // 12. Create a friend for demo user
    const friend1Password = await bcrypt.hash("friend123", 10);
    const insertFriendResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, bio, avatar)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE
       SET username = EXCLUDED.username
       RETURNING user_id`,
      [
        "frienduser",
        "friend@example.com",
        friend1Password,
        "I am a friend of the demo user!",
        "https://via.placeholder.com/150",
      ]
    );
    const friendId = insertFriendResult.rows[0].user_id;

    // 13. Create friendship
    await pool.query(
      `INSERT INTO friends (user_id, friend_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, friend_id) DO UPDATE
       SET status = EXCLUDED.status`,
      [demoUserId, friendId, "accepted"]
    );
    console.log("Friend relationship created");

    console.log("Demo data setup complete!");
    console.log("You can now login with:");
    console.log("Email: demo@example.com");
    console.log("Password: password123");
    console.log("Or friend account:");
    console.log("Email: friend@example.com");
    console.log("Password: friend123");

    await pool.end();
  } catch (error) {
    console.error("Error setting up demo data:", error);
    process.exit(1);
  }
}

main();
