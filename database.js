const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "support.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            telegram_id INTEGER PRIMARY KEY,
            username TEXT,
            first_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Додаємо category до вже існуючої БД
    db.all(
        `PRAGMA table_info(tickets)`,
        (err, columns) => {
            if (err) {
                console.error(
                    "❌ Database check error:",
                    err
                );
                return;
            }

            const hasCategory = columns.some(
                (column) =>
                    column.name === "category"
            );

            if (!hasCategory) {
                db.run(
                    `
                    ALTER TABLE tickets
                    ADD COLUMN category TEXT DEFAULT 'general'
                    `,
                    (alterErr) => {
                        if (alterErr) {
                            console.error(
                                "❌ Failed to add category:",
                                alterErr
                            );
                        } else {
                            console.log(
                                "✅ Category column added"
                            );
                        }
                    }
                );
            }
        }
    );
});

function addUser(user) {
    db.run(
        `
        INSERT INTO users (
            telegram_id,
            username,
            first_name
        )
        VALUES (?, ?, ?)

        ON CONFLICT(telegram_id)
        DO UPDATE SET
            username = excluded.username,
            first_name = excluded.first_name
        `,
        [
            user.id,
            user.username || null,
            user.first_name || null
        ]
    );
}

function createTicket(
    telegramId,
    message,
    category,
    callback
) {
    db.run(
        `
        INSERT INTO tickets (
            telegram_id,
            message,
            category
        )
        VALUES (?, ?, ?)
        `,
        [
            telegramId,
            message,
            category
        ],
        function (err) {
            if (callback) {
                callback(
                    err,
                    this?.lastID
                );
            }
        }
    );
}

function getUserTickets(
    telegramId,
    callback
) {
    db.all(
        `
        SELECT *
        FROM tickets
        WHERE telegram_id = ?
        ORDER BY id DESC
        `,
        [telegramId],
        callback
    );
}

function getAllTickets(callback) {
    db.all(
        `
        SELECT
            tickets.*,
            users.username,
            users.first_name
        FROM tickets

        LEFT JOIN users
        ON users.telegram_id =
           tickets.telegram_id

        ORDER BY tickets.id DESC
        `,
        [],
        callback
    );
}

function getTicket(
    ticketId,
    callback
) {
    db.get(
        `
        SELECT
            tickets.*,
            users.username,
            users.first_name
        FROM tickets

        LEFT JOIN users
        ON users.telegram_id =
           tickets.telegram_id

        WHERE tickets.id = ?
        `,
        [ticketId],
        callback
    );
}

function updateTicketStatus(
    ticketId,
    status,
    callback
) {
    db.run(
        `
        UPDATE tickets
        SET status = ?
        WHERE id = ?
        `,
        [
            status,
            ticketId
        ],
        callback
    );
}

function getStats(callback) {
    db.get(
        `
        SELECT
            COUNT(*) AS total,

            SUM(
                CASE
                    WHEN status = 'open'
                    THEN 1
                    ELSE 0
                END
            ) AS open,

            SUM(
                CASE
                    WHEN status = 'in_progress'
                    THEN 1
                    ELSE 0
                END
            ) AS in_progress,

            SUM(
                CASE
                    WHEN status = 'closed'
                    THEN 1
                    ELSE 0
                END
            ) AS closed

        FROM tickets
        `,
        [],
        callback
    );
}

module.exports = {
    addUser,
    createTicket,
    getUserTickets,
    getAllTickets,
    getTicket,
    updateTicketStatus,
    getStats
};