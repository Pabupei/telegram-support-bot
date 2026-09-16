require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");

const {
    addUser,
    createTicket,
    getUserTickets,
    getAllTickets,
    getTicket,
    updateTicketStatus,
    getStats
} = require("./database");

const TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);

if (!TOKEN) {
    console.error("❌ BOT_TOKEN not found in .env");
    process.exit(1);
}

const bot = new TelegramBot(TOKEN, {
    polling: true
});

const userStates = {};

// ========================================
// HELPERS
// ========================================

function getStatusText(status) {
    if (status === "open") {
        return "🟢 Open";
    }

    if (status === "in_progress") {
        return "🟡 In Progress";
    }

    if (status === "closed") {
        return "🔴 Closed";
    }

    return status;
}

function getCategoryText(category) {
    if (category === "technical") {
        return "🛠 Technical";
    }

    if (category === "billing") {
        return "💳 Billing";
    }

    return "💬 General";
}

// ========================================
// MAIN MENU
// ========================================

function showMainMenu(chatId) {
    bot.sendMessage(
        chatId,
        "👋 Welcome to Support Bot!\n\n" +
        "How can I help you today?",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🎫 Create Ticket",
                            callback_data: "create_ticket"
                        }
                    ],
                    [
                        {
                            text: "📋 My Tickets",
                            callback_data: "my_tickets"
                        }
                    ],
                    [
                        {
                            text: "ℹ️ About",
                            callback_data: "about"
                        }
                    ]
                ]
            }
        }
    );
}

// ========================================
// ADMIN PANEL
// ========================================

function showAdminPanel(chatId) {
    bot.sendMessage(
        chatId,
        "🛠 Admin Panel\n\n" +
        "Manage support tickets and view statistics.",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "🎫 All Tickets",
                            callback_data: "admin_tickets"
                        }
                    ],
                    [
                        {
                            text: "📊 Statistics",
                            callback_data: "admin_stats"
                        }
                    ],
                    [
                        {
                            text: "🏠 Main Menu",
                            callback_data: "main_menu"
                        }
                    ]
                ]
            }
        }
    );
}

// ========================================
// /START
// ========================================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    addUser(msg.from);

    delete userStates[chatId];

    showMainMenu(chatId);
});

// ========================================
// /ADMIN
// ========================================

bot.onText(/\/admin/, (msg) => {
    if (msg.from.id !== ADMIN_ID) {
        bot.sendMessage(
            msg.chat.id,
            "❌ You don't have permission to use this command."
        );

        return;
    }

    delete userStates[msg.chat.id];

    showAdminPanel(msg.chat.id);
});

// ========================================
// CALLBACKS
// ========================================

bot.on("callback_query", (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    bot.answerCallbackQuery(query.id);

    // ====================================
    // CREATE TICKET
    // ====================================

    if (data === "create_ticket") {
        delete userStates[chatId];

        bot.sendMessage(
            chatId,
            "🗂 Choose a category:",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🛠 Technical",
                                callback_data: "category_technical"
                            }
                        ],
                        [
                            {
                                text: "💳 Billing",
                                callback_data: "category_billing"
                            }
                        ],
                        [
                            {
                                text: "💬 General",
                                callback_data: "category_general"
                            }
                        ],
                        [
                            {
                                text: "🔙 Back",
                                callback_data: "main_menu"
                            }
                        ]
                    ]
                }
            }
        );

        return;
    }

    // ====================================
    // CATEGORY
    // ====================================

    if (data.startsWith("category_")) {
        const category = data.replace(
            "category_",
            ""
        );

        userStates[chatId] = {
            action: "waiting_for_ticket",
            category: category
        };

        bot.sendMessage(
            chatId,
            `${getCategoryText(category)}\n\n` +
            "📝 Please describe your problem in detail:",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "❌ Cancel",
                                callback_data: "main_menu"
                            }
                        ]
                    ]
                }
            }
        );

        return;
    }

    // ====================================
    // MY TICKETS
    // ====================================

    if (data === "my_tickets") {
        getUserTickets(
            userId,
            (err, tickets) => {
                if (err) {
                    console.error(err);

                    bot.sendMessage(
                        chatId,
                        "❌ Failed to load tickets."
                    );

                    return;
                }

                if (!tickets.length) {
                    bot.sendMessage(
                        chatId,
                        "📭 You don't have any tickets yet.",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "🎫 Create Ticket",
                                            callback_data: "create_ticket"
                                        }
                                    ],
                                    [
                                        {
                                            text: "🔙 Back",
                                            callback_data: "main_menu"
                                        }
                                    ]
                                ]
                            }
                        }
                    );

                    return;
                }

                tickets.forEach((ticket) => {
                    bot.sendMessage(
                        chatId,
                        `🎫 Ticket #${ticket.id}\n\n` +
                        `🗂 Category: ${getCategoryText(ticket.category)}\n` +
                        `📌 Status: ${getStatusText(ticket.status)}\n\n` +
                        `💬 ${ticket.message}\n\n` +
                        `🕒 ${ticket.created_at}`
                    );
                });

                bot.sendMessage(
                    chatId,
                    "📋 End of your tickets.",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "🎫 Create New Ticket",
                                        callback_data: "create_ticket"
                                    }
                                ],
                                [
                                    {
                                        text: "🔙 Back",
                                        callback_data: "main_menu"
                                    }
                                ]
                            ]
                        }
                    }
                );
            }
        );

        return;
    }

    // ====================================
    // ABOUT
    // ====================================

    if (data === "about") {
        bot.sendMessage(
            chatId,
            "🤖 Support Management Bot\n\n" +
            "Customer support system developed with:\n\n" +
            "• JavaScript\n" +
            "• Node.js\n" +
            "• Telegram Bot API\n" +
            "• SQLite\n\n" +
            "Features:\n" +
            "• Support tickets\n" +
            "• Ticket categories\n" +
            "• Status management\n" +
            "• Admin dashboard\n" +
            "• Direct support replies\n" +
            "• Statistics",
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {
                                text: "🔙 Back",
                                callback_data: "main_menu"
                            }
                        ]
                    ]
                }
            }
        );

        return;
    }

    // ====================================
    // MAIN MENU
    // ====================================

    if (data === "main_menu") {
        delete userStates[chatId];

        showMainMenu(chatId);

        return;
    }

    // ====================================
    // ADMIN TICKETS
    // ====================================

    if (data === "admin_tickets") {
        if (userId !== ADMIN_ID) {
            return;
        }

        showAllTickets(chatId);

        return;
    }

    // ====================================
    // ADMIN STATS
    // ====================================

    if (data === "admin_stats") {
        if (userId !== ADMIN_ID) {
            return;
        }

        getStats(
            (err, stats) => {
                if (err) {
                    console.error(err);

                    bot.sendMessage(
                        chatId,
                        "❌ Failed to load statistics."
                    );

                    return;
                }

                bot.sendMessage(
                    chatId,
                    "📊 Support Statistics\n\n" +
                    `🎫 Total: ${stats.total || 0}\n` +
                    `🟢 Open: ${stats.open || 0}\n` +
                    `🟡 In Progress: ${stats.in_progress || 0}\n` +
                    `🔴 Closed: ${stats.closed || 0}`,
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "🔙 Admin Panel",
                                        callback_data: "admin_panel"
                                    }
                                ]
                            ]
                        }
                    }
                );
            }
        );

        return;
    }

    // ====================================
    // ADMIN PANEL BACK
    // ====================================

    if (data === "admin_panel") {
        if (userId !== ADMIN_ID) {
            return;
        }

        delete userStates[chatId];

        showAdminPanel(chatId);

        return;
    }

    // ====================================
    // SET IN PROGRESS
    // ====================================

    if (data.startsWith("progress_ticket_")) {
        if (userId !== ADMIN_ID) {
            return;
        }

        const ticketId = Number(
            data.replace(
                "progress_ticket_",
                ""
            )
        );

        updateTicketStatus(
            ticketId,
            "in_progress",
            (err) => {
                if (err) {
                    console.error(err);

                    bot.sendMessage(
                        chatId,
                        "❌ Failed to update ticket."
                    );

                    return;
                }

                getTicket(
                    ticketId,
                    (ticketErr, ticket) => {
                        if (!ticketErr && ticket) {
                            bot.sendMessage(
                                ticket.telegram_id,
                                `🟡 Ticket #${ticketId} is now being reviewed by support.`
                            );
                        }
                    }
                );

                bot.sendMessage(
                    chatId,
                    `🟡 Ticket #${ticketId} → In Progress`
                );
            }
        );

        return;
    }

    // ====================================
    // CLOSE TICKET
    // ====================================

    if (data.startsWith("close_ticket_")) {
        if (userId !== ADMIN_ID) {
            return;
        }

        const ticketId = Number(
            data.replace(
                "close_ticket_",
                ""
            )
        );

        updateTicketStatus(
            ticketId,
            "closed",
            (err) => {
                if (err) {
                    console.error(err);

                    bot.sendMessage(
                        chatId,
                        "❌ Failed to close ticket."
                    );

                    return;
                }

                getTicket(
                    ticketId,
                    (ticketErr, ticket) => {
                        if (!ticketErr && ticket) {
                            bot.sendMessage(
                                ticket.telegram_id,
                                `✅ Ticket #${ticketId} has been closed.`
                            );
                        }
                    }
                );

                bot.sendMessage(
                    chatId,
                    `🔴 Ticket #${ticketId} closed.`
                );
            }
        );

        return;
    }

    // ====================================
    // REOPEN TICKET
    // ====================================

    if (data.startsWith("open_ticket_")) {
        if (userId !== ADMIN_ID) {
            return;
        }

        const ticketId = Number(
            data.replace(
                "open_ticket_",
                ""
            )
        );

        updateTicketStatus(
            ticketId,
            "open",
            (err) => {
                if (err) {
                    console.error(err);

                    bot.sendMessage(
                        chatId,
                        "❌ Failed to reopen ticket."
                    );

                    return;
                }

                getTicket(
                    ticketId,
                    (ticketErr, ticket) => {
                        if (!ticketErr && ticket) {
                            bot.sendMessage(
                                ticket.telegram_id,
                                `♻️ Ticket #${ticketId} has been reopened.`
                            );
                        }
                    }
                );

                bot.sendMessage(
                    chatId,
                    `♻️ Ticket #${ticketId} reopened.`
                );
            }
        );

        return;
    }

    // ====================================
    // REPLY TO USER
    // ====================================

    if (data.startsWith("reply_ticket_")) {
        if (userId !== ADMIN_ID) {
            return;
        }

        const ticketId = Number(
            data.replace(
                "reply_ticket_",
                ""
            )
        );

        getTicket(
            ticketId,
            (err, ticket) => {
                if (err || !ticket) {
                    bot.sendMessage(
                        chatId,
                        "❌ Ticket not found."
                    );

                    return;
                }

                userStates[chatId] = {
                    action: "admin_reply",
                    ticketId: ticketId,
                    telegramId: ticket.telegram_id
                };

                bot.sendMessage(
                    chatId,
                    `💬 Reply to Ticket #${ticketId}\n\n` +
                    "Type your response:",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "❌ Cancel",
                                        callback_data: "admin_panel"
                                    }
                                ]
                            ]
                        }
                    }
                );
            }
        );

        return;
    }
});

// ========================================
// TEXT MESSAGES
// ========================================

bot.on("message", (msg) => {
    if (
        !msg.text ||
        msg.text.startsWith("/")
    ) {
        return;
    }

    const chatId = msg.chat.id;
    const state = userStates[chatId];

    if (!state) {
        return;
    }

    // ====================================
    // CREATE TICKET MESSAGE
    // ====================================

    if (state.action === "waiting_for_ticket") {
        const ticketMessage = msg.text.trim();

        if (ticketMessage.length < 5) {
            bot.sendMessage(
                chatId,
                "⚠️ Please describe your problem in more detail."
            );

            return;
        }

        addUser(msg.from);

        createTicket(
            msg.from.id,
            ticketMessage,
            state.category,
            (err, ticketId) => {
                if (err) {
                    console.error(err);

                    bot.sendMessage(
                        chatId,
                        "❌ Failed to create ticket."
                    );

                    return;
                }

                delete userStates[chatId];

                bot.sendMessage(
                    chatId,
                    "✅ Ticket created successfully!\n\n" +
                    `🎫 Ticket: #${ticketId}\n` +
                    `🗂 Category: ${getCategoryText(state.category)}\n` +
                    "📌 Status: 🟢 Open"
                );

                if (ADMIN_ID) {
                    const username =
                        msg.from.username
                            ? `@${msg.from.username}`
                            : "No username";

                    bot.sendMessage(
                        ADMIN_ID,
                        "🚨 New Support Ticket\n\n" +
                        `🎫 Ticket: #${ticketId}\n` +
                        `🗂 Category: ${getCategoryText(state.category)}\n` +
                        `👤 User: ${username}\n` +
                        `🆔 ID: ${msg.from.id}\n\n` +
                        `💬 ${ticketMessage}`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: "🟡 In Progress",
                                            callback_data:
                                                `progress_ticket_${ticketId}`
                                        }
                                    ],
                                    [
                                        {
                                            text: "💬 Reply",
                                            callback_data:
                                                `reply_ticket_${ticketId}`
                                        }
                                    ],
                                    [
                                        {
                                            text: "✅ Close",
                                            callback_data:
                                                `close_ticket_${ticketId}`
                                        }
                                    ]
                                ]
                            }
                        }
                    );
                }

                showMainMenu(chatId);
            }
        );

        return;
    }

    // ====================================
    // ADMIN REPLY
    // ====================================

    if (
        state.action === "admin_reply" &&
        msg.from.id === ADMIN_ID
    ) {
        const reply = msg.text.trim();

        if (!reply) {
            return;
        }

        bot.sendMessage(
            state.telegramId,
            `💬 Support reply — Ticket #${state.ticketId}\n\n` +
            reply
        )
            .then(() => {
                bot.sendMessage(
                    chatId,
                    `✅ Reply sent to Ticket #${state.ticketId}.`
                );

                delete userStates[chatId];
            })
            .catch((err) => {
                console.error(err);

                bot.sendMessage(
                    chatId,
                    "❌ Failed to send reply."
                );
            });

        return;
    }
});

// ========================================
// SHOW ALL TICKETS
// ========================================

function showAllTickets(chatId) {
    getAllTickets(
        (err, tickets) => {
            if (err) {
                console.error(err);

                bot.sendMessage(
                    chatId,
                    "❌ Failed to load tickets."
                );

                return;
            }

            if (!tickets.length) {
                bot.sendMessage(
                    chatId,
                    "📭 No tickets found.",
                    {
                        reply_markup: {
                            inline_keyboard: [
                                [
                                    {
                                        text: "🔙 Admin Panel",
                                        callback_data: "admin_panel"
                                    }
                                ]
                            ]
                        }
                    }
                );

                return;
            }

            bot.sendMessage(
                chatId,
                `🎫 Tickets: ${tickets.length}`
            );

            tickets.forEach((ticket) => {
                const username =
                    ticket.username
                        ? `@${ticket.username}`
                        : "No username";

                const buttons = [];

                if (ticket.status === "open") {
                    buttons.push([
                        {
                            text: "🟡 In Progress",
                            callback_data:
                                `progress_ticket_${ticket.id}`
                        }
                    ]);
                }

                if (ticket.status !== "closed") {
                    buttons.push([
                        {
                            text: "💬 Reply",
                            callback_data:
                                `reply_ticket_${ticket.id}`
                        }
                    ]);

                    buttons.push([
                        {
                            text: "✅ Close",
                            callback_data:
                                `close_ticket_${ticket.id}`
                        }
                    ]);
                }

                if (ticket.status === "closed") {
                    buttons.push([
                        {
                            text: "♻️ Reopen",
                            callback_data:
                                `open_ticket_${ticket.id}`
                        }
                    ]);
                }

                bot.sendMessage(
                    chatId,
                    `🎫 Ticket #${ticket.id}\n\n` +
                    `👤 ${ticket.first_name || "User"}\n` +
                    `🔗 ${username}\n` +
                    `🆔 ${ticket.telegram_id}\n\n` +
                    `🗂 ${getCategoryText(ticket.category)}\n` +
                    `📌 ${getStatusText(ticket.status)}\n\n` +
                    `💬 ${ticket.message}\n\n` +
                    `🕒 ${ticket.created_at}`,
                    {
                        reply_markup: {
                            inline_keyboard: buttons
                        }
                    }
                );
            });

            bot.sendMessage(
                chatId,
                "🛠 Ticket management",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "📊 Statistics",
                                    callback_data: "admin_stats"
                                }
                            ],
                            [
                                {
                                    text: "🔙 Admin Panel",
                                    callback_data: "admin_panel"
                                }
                            ]
                        ]
                    }
                }
            );
        }
    );
}

// ========================================
// POLLING ERROR
// ========================================

bot.on(
    "polling_error",
    (error) => {
        console.error(
            "❌ Polling error:",
            error.message
        );
    }
);

console.log(
    "🤖 Support Bot is running..."
);
