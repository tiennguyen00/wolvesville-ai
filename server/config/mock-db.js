/**
 * Mock Database Service
 * This is a memory-based mock implementation of the database layer
 * for development and demonstration purposes.
 */

// In-memory storage
const db = {
  users: [],
  profiles: [],
  roles: [],
  game_sessions: [],
  game_players: [],
  game_events: [],
  chat_messages: [],
  votes: [],
};

// Utility function to generate UUIDs
const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Query executor that simulates PostgreSQL behavior
const pool = {
  query: async (text, params = []) => {
    // Handle SELECT NOW() query directly
    if (text.trim().toUpperCase() === "SELECT NOW()") {
      return {
        rows: [{ now: new Date().toISOString() }],
        rowCount: 1,
      };
    }

    // Parse the query to determine operation type and table
    const operation = text.trim().split(" ")[0].toLowerCase();
    let table = "";
    let result = { rows: [], rowCount: 0 };

    // Extract table name from query
    if (operation === "select") {
      table = text.match(/from\s+([a-z_]+)/i)?.[1];
    } else if (operation === "insert") {
      table = text.match(/into\s+([a-z_]+)/i)?.[1];
    } else if (operation === "update") {
      table = text.match(/update\s+([a-z_]+)/i)?.[1];
    } else if (operation === "delete") {
      table = text.match(/from\s+([a-z_]+)/i)?.[1];
    }

    // Simulate database operations based on the query
    try {
      if (!table || !db[table]) {
        throw new Error(`Table '${table}' not found`);
      }

      // SELECT operation
      if (operation === "select") {
        if (text.includes("COUNT(*)")) {
          // Handle count query
          result.rows = [{ count: db[table].length }];
        } else if (text.includes("SELECT NOW()")) {
          // Handle timestamp query
          result.rows = [{ now: new Date().toISOString() }];
        } else {
          // Regular select - this is a simplified implementation
          // In a real implementation, we would parse the WHERE clause and filter records
          result.rows = [...db[table]];

          // Basic WHERE clause handling (very simplified)
          if (text.includes("WHERE") && params.length > 0) {
            // Extract column from WHERE clause (simplified)
            const whereMatch = text.match(/where\s+([a-z_.]+)\s*=\s*\$/i);
            if (whereMatch) {
              const column = whereMatch[1];
              result.rows = result.rows.filter(
                (row) => row[column] === params[0]
              );
            }
          }
        }
      }
      // INSERT operation
      else if (operation === "insert") {
        // Parse column names and values placeholders
        const columnsMatch = text.match(/\(([^)]+)\)\s+VALUES\s+\(([^)]+)\)/i);
        if (columnsMatch) {
          const columns = columnsMatch[1].split(",").map((col) => col.trim());
          const placeholders = columnsMatch[2]
            .split(",")
            .map((ph) => ph.trim());

          // Create new record
          const newRecord = {};

          // Add primary key if not provided
          if (columns.includes("user_id") && !params.includes("user_id")) {
            newRecord.user_id = generateUUID();
          } else if (
            columns.includes("session_id") &&
            !params.includes("session_id")
          ) {
            newRecord.session_id = generateUUID();
          } else if (
            columns.includes("role_id") &&
            !params.includes("role_id")
          ) {
            newRecord.role_id = generateUUID();
          } else if (
            columns.includes("player_id") &&
            !params.includes("player_id")
          ) {
            newRecord.player_id = generateUUID();
          } else if (
            columns.includes("message_id") &&
            !params.includes("message_id")
          ) {
            newRecord.message_id = generateUUID();
          } else if (
            columns.includes("vote_id") &&
            !params.includes("vote_id")
          ) {
            newRecord.vote_id = generateUUID();
          } else if (
            columns.includes("event_id") &&
            !params.includes("event_id")
          ) {
            newRecord.event_id = generateUUID();
          } else if (
            columns.includes("profile_id") &&
            !params.includes("profile_id")
          ) {
            newRecord.profile_id = generateUUID();
          }

          // Set current timestamp for created_at if needed
          if (
            columns.includes("created_at") &&
            !params.includes("created_at")
          ) {
            newRecord.created_at = new Date().toISOString();
          }

          // Assign values to columns
          columns.forEach((col, index) => {
            if (placeholders[index].startsWith("$")) {
              const paramIndex = parseInt(placeholders[index].substring(1)) - 1;
              if (paramIndex < params.length) {
                newRecord[col] = params[paramIndex];
              }
            } else if (placeholders[index].toLowerCase() === "now()") {
              newRecord[col] = new Date().toISOString();
            } else if (placeholders[index] === "DEFAULT") {
              // Handle defaults
              if (col.includes("_id")) {
                newRecord[col] = generateUUID();
              } else if (col === "created_at") {
                newRecord[col] = new Date().toISOString();
              }
            }
          });

          // Add record to the table
          db[table].push(newRecord);

          // Return the new record for RETURNING clause
          if (text.includes("RETURNING")) {
            const returningColumns = text
              .match(/RETURNING\s+(.+)$/i)[1]
              .split(",")
              .map((col) => col.trim());
            const returnedRecord = {};
            returningColumns.forEach((col) => {
              returnedRecord[col] = newRecord[col];
            });
            result.rows = [returnedRecord];
          }

          result.rowCount = 1;
        }
      }
      // UPDATE operation
      else if (operation === "update") {
        // Parse SET clause and WHERE clause
        const setMatch = text.match(/SET\s+(.+?)\s+WHERE/i);
        const whereMatch = text.match(/WHERE\s+(.+)$/i);

        if (setMatch && whereMatch) {
          const setClauses = setMatch[1]
            .split(",")
            .map((clause) => clause.trim());
          // Very simplified WHERE parsing - only handles single condition
          const whereClause = whereMatch[1].trim();
          const whereCol = whereClause.split("=")[0].trim();
          const wherePlaceholder = whereClause.split("=")[1].trim();

          // Find the parameter index for the WHERE condition
          let whereParamIndex = 0;
          if (wherePlaceholder.startsWith("$")) {
            whereParamIndex = parseInt(wherePlaceholder.substring(1)) - 1;
          }

          // Find records to update
          const recordsToUpdate = db[table].filter(
            (record) => record[whereCol] === params[whereParamIndex]
          );

          // Update records
          recordsToUpdate.forEach((record) => {
            setClauses.forEach((clause) => {
              const [col, placeholder] = clause
                .split("=")
                .map((part) => part.trim());

              if (placeholder.startsWith("$")) {
                const paramIndex = parseInt(placeholder.substring(1)) - 1;
                if (paramIndex < params.length) {
                  record[col] = params[paramIndex];
                }
              } else if (placeholder.toLowerCase() === "now()") {
                record[col] = new Date().toISOString();
              }
            });
          });

          // Return updated record if RETURNING clause exists
          if (text.includes("RETURNING")) {
            const returningColumns = text
              .match(/RETURNING\s+(.+)$/i)[1]
              .split(",")
              .map((col) => col.trim());

            if (recordsToUpdate.length > 0) {
              const returnedRecord = {};
              returningColumns.forEach((col) => {
                returnedRecord[col] = recordsToUpdate[0][col];
              });
              result.rows = [returnedRecord];
            }
          }

          result.rowCount = recordsToUpdate.length;
        }
      }
      // DELETE operation
      else if (operation === "delete") {
        // Parse WHERE clause
        const whereMatch = text.match(/WHERE\s+(.+)$/i);

        if (whereMatch) {
          // Very simplified WHERE parsing - only handles single condition
          const whereClause = whereMatch[1].trim();
          const whereCol = whereClause.split("=")[0].trim();
          const wherePlaceholder = whereClause.split("=")[1].trim();

          // Find the parameter index for the WHERE condition
          let whereParamIndex = 0;
          if (wherePlaceholder.startsWith("$")) {
            whereParamIndex = parseInt(wherePlaceholder.substring(1)) - 1;
          }

          // Count records before deletion
          const initialCount = db[table].length;

          // Filter out records to be deleted
          db[table] = db[table].filter(
            (record) => record[whereCol] !== params[whereParamIndex]
          );

          // Calculate number of deleted records
          result.rowCount = initialCount - db[table].length;
        }
      }

      return result;
    } catch (error) {
      console.error("Mock DB error:", error);
      throw error;
    }
  },
  connect: async () => {
    return {
      query: async (text, params) => pool.query(text, params),
      release: () => {
        /* No-op for mock */
      },
    };
  },
};

// Utility to reset the database (useful for testing)
const resetDatabase = () => {
  Object.keys(db).forEach((table) => {
    db[table] = [];
  });
};

// Populate database with initial data
const initializeDatabase = async () => {
  console.log("Initializing mock database...");

  // Add default roles
  db.roles = [
    {
      role_id: generateUUID(),
      name: "Villager",
      description:
        "A regular villager with no special abilities. Win by eliminating all werewolves.",
      team: "villager",
      category: "vanilla",
      ability_type: null,
      ability_target: null,
      enabled: true,
    },
    {
      role_id: generateUUID(),
      name: "Werewolf",
      description:
        "A werewolf who can eliminate one villager each night. Win by outnumbering the villagers.",
      team: "werewolf",
      category: "killer",
      ability_type: "kill",
      ability_target: "single",
      enabled: true,
    },
    {
      role_id: generateUUID(),
      name: "Seer",
      description:
        "A villager who can check one player each night to learn if they are a werewolf or not.",
      team: "villager",
      category: "investigative",
      ability_type: "investigate",
      ability_target: "single",
      enabled: true,
    },
  ];

  console.log("Mock database initialized successfully");
  return true;
};

module.exports = {
  pool,
  initializeDatabase,
  resetDatabase,
};
