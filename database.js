const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "support.db");
const db = new sqlite3.Database(dbPath);

// ========================================
// DATABASE INITIALIZATION
// ========================================

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

            const columnNames =
                columns.map(
                    (column) =>
                        column.name
                );

            const migrations = [];

            if (
                !columnNames.includes(
                    "category"
                )
            ) {
                migrations.push(`
                    ALTER TABLE tickets
                    ADD COLUMN category TEXT DEFAULT 'general'
                `);
            }

            if (
                !columnNames.includes(
                    "priority"
                )
            ) {
                migrations.push(`
                    ALTER TABLE tickets
                    ADD COLUMN priority TEXT DEFAULT 'medium'
                `);
            }

            if (
                !columnNames.includes(
                    "assigned_operator_id"
                )
            ) {
                migrations.push(`
                    ALTER TABLE tickets
                    ADD COLUMN assigned_operator_id INTEGER
                `);
            }

            if (
                !columnNames.includes(
                    "assigned_operator_name"
                )
            ) {
                migrations.push(`
                    ALTER TABLE tickets
                    ADD COLUMN assigned_operator_name TEXT
                `);
            }

            if (
                !columnNames.includes(
                    "first_response_at"
                )
            ) {
                migrations.push(`
                    ALTER TABLE tickets
                    ADD COLUMN first_response_at DATETIME
                `);
            }

            if (
                !columnNames.includes(
                    "last_activity_at"
                )
            ) {
                migrations.push(`
                    ALTER TABLE tickets
                    ADD COLUMN last_activity_at DATETIME
                `);
            }

            function runMigration(
                index
            ) {
                if (
                    index >=
                    migrations.length
                ) {
                    db.run(`
                        UPDATE tickets
                        SET last_activity_at = created_at
                        WHERE last_activity_at IS NULL
                    `);

                    return;
                }

                db.run(
                    migrations[index],
                    (migrationErr) => {
                        if (
                            migrationErr
                        ) {
                            console.error(
                                "❌ Migration error:",
                                migrationErr
                            );
                        }

                        runMigration(
                            index + 1
                        );
                    }
                );
            }

            runMigration(0);
        }
    );

    db.run(
        `
        CREATE TABLE IF NOT EXISTS ticket_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket_id INTEGER NOT NULL,
            sender_type TEXT NOT NULL,
            telegram_id INTEGER,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (ticket_id)
            REFERENCES tickets(id)
            ON DELETE CASCADE
        )
        `,
        (err) => {
            if (err) {
                console.error(
                    "❌ Failed to create ticket_messages:",
                    err
                );

                return;
            }

            db.run(
                `
                INSERT INTO ticket_messages (
                    ticket_id,
                    sender_type,
                    telegram_id,
                    message,
                    created_at
                )

                SELECT
                    tickets.id,
                    'user',
                    tickets.telegram_id,
                    tickets.message,
                    tickets.created_at

                FROM tickets

                WHERE NOT EXISTS (
                    SELECT 1
                    FROM ticket_messages
                    WHERE ticket_messages.ticket_id =
                          tickets.id
                )
                `,
                (backfillErr) => {
                    if (
                        backfillErr
                    ) {
                        console.error(
                            "❌ Ticket history migration error:",
                            backfillErr
                        );
                    }
                }
            );
        }
    );

    db.run(`
        CREATE INDEX IF NOT EXISTS
        idx_tickets_telegram_id
        ON tickets(telegram_id)
    `);

    db.run(`
        CREATE INDEX IF NOT EXISTS
        idx_tickets_status
        ON tickets(status)
    `);

    db.run(`
        CREATE INDEX IF NOT EXISTS
        idx_ticket_messages_ticket_id
        ON ticket_messages(ticket_id)
    `);
});

// ========================================
// USERS
// ========================================

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

// ========================================
// CREATE TICKET
// ========================================

function createTicket(
    telegramId,
    message,
    category,
    priority,
    callback
) {
    db.run(
        `
        INSERT INTO tickets (
            telegram_id,
            message,
            category,
            priority,
            last_activity_at
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP
        )
        `,
        [
            telegramId,
            message,
            category,
            priority
        ],
        function (err) {
            if (err) {
                callback?.(
                    err
                );

                return;
            }

            const ticketId =
                this.lastID;

            db.run(
                `
                INSERT INTO ticket_messages (
                    ticket_id,
                    sender_type,
                    telegram_id,
                    message
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    ticketId,
                    "user",
                    telegramId,
                    message
                ],
                (messageErr) => {
                    if (
                        messageErr
                    ) {
                        callback?.(
                            messageErr
                        );

                        return;
                    }

                    callback?.(
                        null,
                        ticketId
                    );
                }
            );
        }
    );
}

// ========================================
// TICKET MESSAGES
// ========================================

function addTicketMessage(
    ticketId,
    senderType,
    telegramId,
    message,
    callback
) {
    db.run(
        `
        INSERT INTO ticket_messages (
            ticket_id,
            sender_type,
            telegram_id,
            message
        )
        VALUES (?, ?, ?, ?)
        `,
        [
            ticketId,
            senderType,
            telegramId || null,
            message
        ],
        function (err) {
            if (err) {
                callback?.(
                    err
                );

                return;
            }

            db.run(
                `
                UPDATE tickets
                SET last_activity_at =
                    CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [ticketId],
                (activityErr) => {
                    callback?.(
                        activityErr,
                        this?.lastID
                    );
                }
            );
        }
    );
}

function getTicketMessages(
    ticketId,
    callback
) {
    db.all(
        `
        SELECT *
        FROM ticket_messages

        WHERE ticket_id = ?

        ORDER BY
            created_at ASC,
            id ASC
        `,
        [ticketId],
        callback
    );
}

// ========================================
// GET TICKETS
// ========================================

function getUserTickets(
    telegramId,
    callback
) {
    db.all(
        `
        SELECT *
        FROM tickets

        WHERE telegram_id = ?

        ORDER BY
            COALESCE(
                last_activity_at,
                created_at
            ) DESC,
            id DESC
        `,
        [telegramId],
        callback
    );
}

function getAllTickets(
    callback
) {
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

        ORDER BY
            CASE tickets.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
            END,

            COALESCE(
                tickets.last_activity_at,
                tickets.created_at
            ) DESC
        `,
        [],
        callback
    );
}

function getFilteredTickets(
    filter,
    callback
) {
    let whereClause = "";
    let params = [];

    if (
        filter === "open" ||
        filter === "in_progress" ||
        filter === "closed"
    ) {
        whereClause =
            `WHERE tickets.status = ?`;

        params = [
            filter
        ];
    }

    if (
        filter === "important"
    ) {
        whereClause = `
            WHERE tickets.priority
            IN ('high', 'urgent')
        `;
    }

    if (
        filter === "unassigned"
    ) {
        whereClause = `
            WHERE tickets.assigned_operator_id
            IS NULL
        `;
    }

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

        ${whereClause}

        ORDER BY
            CASE tickets.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
                ELSE 5
            END,

            COALESCE(
                tickets.last_activity_at,
                tickets.created_at
            ) DESC
        `,
        params,
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

// ========================================
// STATUS
// ========================================

function updateTicketStatus(
    ticketId,
    status,
    callback
) {
    db.run(
        `
        UPDATE tickets

        SET
            status = ?,
            last_activity_at =
                CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            status,
            ticketId
        ],
        callback
    );
}

// ========================================
// PRIORITY
// ========================================

function updateTicketPriority(
    ticketId,
    priority,
    callback
) {
    db.run(
        `
        UPDATE tickets

        SET
            priority = ?,
            last_activity_at =
                CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            priority,
            ticketId
        ],
        callback
    );
}

// ========================================
// ASSIGNED OPERATOR
// ========================================

function assignTicket(
    ticketId,
    operatorId,
    operatorName,
    callback
) {
    db.run(
        `
        UPDATE tickets

        SET
            assigned_operator_id = ?,
            assigned_operator_name = ?,
            status =
                CASE
                    WHEN status = 'open'
                    THEN 'in_progress'
                    ELSE status
                END,
            last_activity_at =
                CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            operatorId,
            operatorName,
            ticketId
        ],
        callback
    );
}

// ========================================
// FIRST RESPONSE
// ========================================

function registerFirstResponse(
    ticketId,
    operatorId,
    operatorName,
    callback
) {
    db.run(
        `
        UPDATE tickets

        SET
            assigned_operator_id =
                COALESCE(
                    assigned_operator_id,
                    ?
                ),

            assigned_operator_name =
                COALESCE(
                    assigned_operator_name,
                    ?
                ),

            first_response_at =
                COALESCE(
                    first_response_at,
                    CURRENT_TIMESTAMP
                ),

            status =
                CASE
                    WHEN status = 'open'
                    THEN 'in_progress'
                    ELSE status
                END,

            last_activity_at =
                CURRENT_TIMESTAMP

        WHERE id = ?
        `,
        [
            operatorId,
            operatorName,
            ticketId
        ],
        callback
    );
}

// ========================================
// STATS
// ========================================

function getStats(
    callback
) {
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
            ) AS closed,

            SUM(
                CASE
                    WHEN priority = 'low'
                    THEN 1
                    ELSE 0
                END
            ) AS low,

            SUM(
                CASE
                    WHEN priority = 'medium'
                    THEN 1
                    ELSE 0
                END
            ) AS medium,

            SUM(
                CASE
                    WHEN priority = 'high'
                    THEN 1
                    ELSE 0
                END
            ) AS high,

            SUM(
                CASE
                    WHEN priority = 'urgent'
                    THEN 1
                    ELSE 0
                END
            ) AS urgent,

            SUM(
                CASE
                    WHEN category = 'technical'
                    THEN 1
                    ELSE 0
                END
            ) AS technical,

            SUM(
                CASE
                    WHEN category = 'billing'
                    THEN 1
                    ELSE 0
                END
            ) AS billing,

            SUM(
                CASE
                    WHEN category = 'general'
                    THEN 1
                    ELSE 0
                END
            ) AS general,

            SUM(
                CASE
                    WHEN assigned_operator_id
                    IS NULL
                    THEN 1
                    ELSE 0
                END
            ) AS unassigned,

            ROUND(
                AVG(
                    CASE
                        WHEN first_response_at
                        IS NOT NULL
                        THEN (
                            julianday(
                                first_response_at
                            ) -
                            julianday(
                                created_at
                            )
                        ) * 86400
                    END
                ),
                0
            ) AS avg_first_response_seconds

        FROM tickets
        `,
        [],
        callback
    );
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
    addUser,

    createTicket,

    addTicketMessage,
    getTicketMessages,

    getUserTickets,
    getAllTickets,
    getFilteredTickets,
    getTicket,

    updateTicketStatus,
    updateTicketPriority,

    assignTicket,
    registerFirstResponse,

    getStats
};