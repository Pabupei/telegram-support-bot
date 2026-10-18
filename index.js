require("dotenv").config();

const TelegramBot =
    require("node-telegram-bot-api");

const {
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
} = require("./database");

const TOKEN =
    process.env.BOT_TOKEN;

const ADMIN_ID =
    Number(
        process.env.ADMIN_ID
    );

if (!TOKEN) {
    console.error(
        "❌ BOT_TOKEN not found in .env"
    );

    process.exit(1);
}

const bot =
    new TelegramBot(
        TOKEN,
        {
            polling: true
        }
    );

const userStates = {};

// ========================================
// HELPERS
// ========================================

function getStatusText(
    status
) {
    if (
        status === "open"
    ) {
        return "🟢 Open";
    }

    if (
        status ===
        "in_progress"
    ) {
        return "🟡 In Progress";
    }

    if (
        status ===
        "closed"
    ) {
        return "🔴 Closed";
    }

    return status;
}

function getCategoryText(
    category
) {
    if (
        category ===
        "technical"
    ) {
        return "🛠 Technical";
    }

    if (
        category ===
        "billing"
    ) {
        return "💳 Billing";
    }

    return "💬 General";
}

function getPriorityText(
    priority
) {
    if (
        priority ===
        "low"
    ) {
        return "🟢 Low";
    }

    if (
        priority ===
        "medium"
    ) {
        return "🟡 Medium";
    }

    if (
        priority ===
        "high"
    ) {
        return "🟠 High";
    }

    if (
        priority ===
        "urgent"
    ) {
        return "🔴 Urgent";
    }

    return "🟡 Medium";
}

function getSenderText(
    senderType
) {
    if (
        senderType ===
        "admin"
    ) {
        return "👨‍💼 Support";
    }

    return "👤 User";
}

function getOperatorText(
    ticket
) {
    if (
        !ticket
            .assigned_operator_id
    ) {
        return "⚪ Unassigned";
    }

    return (
        "👨‍💼 " +
        (
            ticket
                .assigned_operator_name ||
            `Operator ${ticket.assigned_operator_id}`
        )
    );
}

function formatDate(
    dateString
) {
    if (
        !dateString
    ) {
        return "—";
    }

    const date =
        new Date(
            dateString.replace(
                " ",
                "T"
            ) + "Z"
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateString;
    }

    return date
        .toLocaleString(
            "en-GB",
            {
                year:
                    "numeric",
                month:
                    "2-digit",
                day:
                    "2-digit",
                hour:
                    "2-digit",
                minute:
                    "2-digit"
            }
        );
}

function formatDuration(
    totalSeconds
) {
    const seconds =
        Number(
            totalSeconds
        );

    if (
        !Number.isFinite(
            seconds
        )
    ) {
        return "—";
    }

    if (
        seconds <
        60
    ) {
        return `${Math.max(
            0,
            Math.round(
                seconds
            )
        )} sec`;
    }

    if (
        seconds <
        3600
    ) {
        return `${Math.round(
            seconds / 60
        )} min`;
    }

    if (
        seconds <
        86400
    ) {
        const hours =
            Math.floor(
                seconds /
                    3600
            );

        const minutes =
            Math.round(
                (
                    seconds %
                    3600
                ) / 60
            );

        return `${hours}h ${minutes}m`;
    }

    const days =
        Math.floor(
            seconds /
                86400
        );

    const hours =
        Math.round(
            (
                seconds %
                86400
            ) / 3600
        );

    return `${days}d ${hours}h`;
}

function getOperatorName(
    telegramUser
) {
    if (
        telegramUser
            .username
    ) {
        return `@${telegramUser.username}`;
    }

    if (
        telegramUser
            .first_name
    ) {
        return telegramUser
            .first_name;
    }

    return "Support";
}

// ========================================
// SEND LONG MESSAGE
// ========================================

async function sendLongMessage(
    chatId,
    text,
    options = {}
) {
    const maxLength =
        3800;

    if (
        text.length <=
        maxLength
    ) {
        return bot.sendMessage(
            chatId,
            text,
            options
        );
    }

    const parts = [];

    let remaining =
        text;

    while (
        remaining.length >
        maxLength
    ) {
        let cutIndex =
            remaining
                .lastIndexOf(
                    "\n",
                    maxLength
                );

        if (
            cutIndex <
            1000
        ) {
            cutIndex =
                maxLength;
        }

        parts.push(
            remaining.slice(
                0,
                cutIndex
            )
        );

        remaining =
            remaining
                .slice(
                    cutIndex
                )
                .trim();
    }

    if (
        remaining
    ) {
        parts.push(
            remaining
        );
    }

    for (
        let i = 0;
        i <
        parts.length;
        i++
    ) {
        await bot.sendMessage(
            chatId,
            parts[i],
            i ===
                parts.length -
                    1
                ? options
                : {}
        );
    }
}

// ========================================
// MAIN MENU
// ========================================

function showMainMenu(
    chatId
) {
    bot.sendMessage(
        chatId,
        "👋 Welcome to Support Bot!\n\n" +
            "How can I help you today?",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text:
                                "🎫 Create Ticket",
                            callback_data:
                                "create_ticket"
                        }
                    ],
                    [
                        {
                            text:
                                "📋 My Tickets",
                            callback_data:
                                "my_tickets"
                        }
                    ],
                    [
                        {
                            text:
                                "ℹ️ About",
                            callback_data:
                                "about"
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

function showAdminPanel(
    chatId
) {
    bot.sendMessage(
        chatId,
        "🛠 Admin Panel\n\n" +
            "Manage support tickets and view statistics.",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text:
                                "🎫 All Tickets",
                            callback_data:
                                "admin_tickets"
                        }
                    ],
                    [
                        {
                            text:
                                "🔎 Filters",
                            callback_data:
                                "admin_filters"
                        }
                    ],
                    [
                        {
                            text:
                                "📊 Statistics",
                            callback_data:
                                "admin_stats"
                        }
                    ],
                    [
                        {
                            text:
                                "🏠 Main Menu",
                            callback_data:
                                "main_menu"
                        }
                    ]
                ]
            }
        }
    );
}

// ========================================
// FILTER MENU
// ========================================

function showAdminFilters(
    chatId
) {
    bot.sendMessage(
        chatId,
        "🔎 Ticket Filters\n\n" +
            "Choose which tickets you want to display:",
        {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text:
                                "📋 All",
                            callback_data:
                                "filter_all"
                        }
                    ],
                    [
                        {
                            text:
                                "🟢 Open",
                            callback_data:
                                "filter_open"
                        },

                        {
                            text:
                                "🟡 In Progress",
                            callback_data:
                                "filter_in_progress"
                        }
                    ],
                    [
                        {
                            text:
                                "🔴 Closed",
                            callback_data:
                                "filter_closed"
                        }
                    ],
                    [
                        {
                            text:
                                "🔥 High & Urgent",
                            callback_data:
                                "filter_important"
                        }
                    ],
                    [
                        {
                            text:
                                "⚪ Unassigned",
                            callback_data:
                                "filter_unassigned"
                        }
                    ],
                    [
                        {
                            text:
                                "🔙 Admin Panel",
                            callback_data:
                                "admin_panel"
                        }
                    ]
                ]
            }
        }
    );
}

// ========================================
// CONVERSATION
// ========================================

function showConversation(
    chatId,
    ticketId,
    viewerId
) {
    getTicket(
        ticketId,
        (
            ticketErr,
            ticket
        ) => {
            if (
                ticketErr ||
                !ticket
            ) {
                console.error(
                    ticketErr
                );

                bot.sendMessage(
                    chatId,
                    "❌ Ticket not found."
                );

                return;
            }

            const isAdmin =
                viewerId ===
                ADMIN_ID;

            const isOwner =
                viewerId ===
                ticket
                    .telegram_id;

            if (
                !isAdmin &&
                !isOwner
            ) {
                bot.sendMessage(
                    chatId,
                    "❌ You don't have access to this ticket."
                );

                return;
            }

            getTicketMessages(
                ticketId,
                async (
                    messagesErr,
                    messages
                ) => {
                    if (
                        messagesErr
                    ) {
                        console.error(
                            messagesErr
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to load conversation."
                        );

                        return;
                    }

                    let text =
                        `💬 Conversation — Ticket #${ticket.id}\n\n` +
                        `🗂 Category: ${getCategoryText(ticket.category)}\n` +
                        `⚡ Priority: ${getPriorityText(ticket.priority)}\n` +
                        `📌 Status: ${getStatusText(ticket.status)}\n` +
                        `👨‍💼 Operator: ${getOperatorText(ticket)}\n` +
                        `🕒 Last activity: ${formatDate(ticket.last_activity_at || ticket.created_at)}\n\n`;

                    if (
                        !messages ||
                        !messages.length
                    ) {
                        text +=
                            "📭 No messages found.";
                    } else {
                        messages.forEach(
                            (
                                message,
                                index
                            ) => {
                                text +=
                                    `${index + 1}. ${getSenderText(message.sender_type)}\n` +
                                    `${message.message}\n` +
                                    `🕒 ${formatDate(message.created_at)}\n\n`;
                            }
                        );
                    }

                    const buttons =
                        [];

                    if (
                        !isAdmin &&
                        ticket.status !==
                            "closed"
                    ) {
                        buttons.push([
                            {
                                text:
                                    "✍️ Reply",
                                callback_data:
                                    `user_reply_ticket_${ticket.id}`
                            }
                        ]);
                    }

                    if (
                        isAdmin
                    ) {
                        if (
                            !ticket
                                .assigned_operator_id
                        ) {
                            buttons.push([
                                {
                                    text:
                                        "👨‍💼 Assign to Me",
                                    callback_data:
                                        `assign_ticket_${ticket.id}`
                                }
                            ]);
                        }

                        if (
                            ticket.status !==
                            "closed"
                        ) {
                            buttons.push([
                                {
                                    text:
                                        "💬 Reply",
                                    callback_data:
                                        `reply_ticket_${ticket.id}`
                                }
                            ]);
                        }

                        buttons.push([
                            {
                                text:
                                    "⚡ Change Priority",
                                callback_data:
                                    `change_priority_${ticket.id}`
                            }
                        ]);

                        buttons.push([
                            {
                                text:
                                    "🔙 Admin Panel",
                                callback_data:
                                    "admin_panel"
                            }
                        ]);
                    } else {
                        buttons.push([
                            {
                                text:
                                    "📋 My Tickets",
                                callback_data:
                                    "my_tickets"
                            }
                        ]);

                        buttons.push([
                            {
                                text:
                                    "🏠 Main Menu",
                                callback_data:
                                    "main_menu"
                            }
                        ]);
                    }

                    await sendLongMessage(
                        chatId,
                        text,
                        {
                            reply_markup: {
                                inline_keyboard:
                                    buttons
                            }
                        }
                    );
                }
            );
        }
    );
}

// ========================================
// /START
// ========================================

bot.onText(
    /\/start/,
    (msg) => {
        addUser(
            msg.from
        );

        delete userStates[
            msg.chat.id
        ];

        showMainMenu(
            msg.chat.id
        );
    }
);

// ========================================
// /ADMIN
// ========================================

bot.onText(
    /\/admin/,
    (msg) => {
        if (
            msg.from.id !==
            ADMIN_ID
        ) {
            bot.sendMessage(
                msg.chat.id,
                "❌ You don't have permission to use this command."
            );

            return;
        }

        delete userStates[
            msg.chat.id
        ];

        showAdminPanel(
            msg.chat.id
        );
    }
);

// ========================================
// CALLBACKS
// ========================================

bot.on(
    "callback_query",
    (query) => {
        const chatId =
            query.message.chat.id;

        const userId =
            query.from.id;

        const data =
            query.data;

        bot.answerCallbackQuery(
            query.id
        ).catch(
            () => {}
        );

        // ====================================
        // MAIN MENU
        // ====================================

        if (
            data ===
            "main_menu"
        ) {
            delete userStates[
                chatId
            ];

            showMainMenu(
                chatId
            );

            return;
        }

        // ====================================
        // ADMIN PANEL
        // ====================================

        if (
            data ===
            "admin_panel"
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            delete userStates[
                chatId
            ];

            showAdminPanel(
                chatId
            );

            return;
        }

        // ====================================
        // CREATE TICKET
        // ====================================

        if (
            data ===
            "create_ticket"
        ) {
            delete userStates[
                chatId
            ];

            bot.sendMessage(
                chatId,
                "🗂 Choose a category:",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
                                        "🛠 Technical",
                                    callback_data:
                                        "category_technical"
                                }
                            ],
                            [
                                {
                                    text:
                                        "💳 Billing",
                                    callback_data:
                                        "category_billing"
                                }
                            ],
                            [
                                {
                                    text:
                                        "💬 General",
                                    callback_data:
                                        "category_general"
                                }
                            ],
                            [
                                {
                                    text:
                                        "🔙 Back",
                                    callback_data:
                                        "main_menu"
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

        if (
            data.startsWith(
                "category_"
            )
        ) {
            const category =
                data.replace(
                    "category_",
                    ""
                );

            userStates[
                chatId
            ] = {
                action:
                    "waiting_for_priority",

                category
            };

            bot.sendMessage(
                chatId,
                `${getCategoryText(category)}\n\n` +
                    "⚡ Choose ticket priority:",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
                                        "🟢 Low",
                                    callback_data:
                                        "priority_low"
                                },

                                {
                                    text:
                                        "🟡 Medium",
                                    callback_data:
                                        "priority_medium"
                                }
                            ],
                            [
                                {
                                    text:
                                        "🟠 High",
                                    callback_data:
                                        "priority_high"
                                },

                                {
                                    text:
                                        "🔴 Urgent",
                                    callback_data:
                                        "priority_urgent"
                                }
                            ],
                            [
                                {
                                    text:
                                        "❌ Cancel",
                                    callback_data:
                                        "main_menu"
                                }
                            ]
                        ]
                    }
                }
            );

            return;
        }

        // ====================================
        // PRIORITY
        // ====================================

        if (
            data.startsWith(
                "priority_"
            )
        ) {
            const state =
                userStates[
                    chatId
                ];

            if (
                !state ||
                state.action !==
                    "waiting_for_priority"
            ) {
                return;
            }

            const priority =
                data.replace(
                    "priority_",
                    ""
                );

            userStates[
                chatId
            ] = {
                action:
                    "waiting_for_ticket",

                category:
                    state.category,

                priority
            };

            bot.sendMessage(
                chatId,
                `${getCategoryText(state.category)}\n` +
                    `⚡ Priority: ${getPriorityText(priority)}\n\n` +
                    "📝 Please describe your problem in detail:",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
                                        "❌ Cancel",
                                    callback_data:
                                        "main_menu"
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

        if (
            data ===
            "my_tickets"
        ) {
            getUserTickets(
                userId,
                (
                    err,
                    tickets
                ) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to load tickets."
                        );

                        return;
                    }

                    if (
                        !tickets.length
                    ) {
                        bot.sendMessage(
                            chatId,
                            "📭 You don't have any tickets yet.",
                            {
                                reply_markup: {
                                    inline_keyboard: [
                                        [
                                            {
                                                text:
                                                    "🎫 Create Ticket",
                                                callback_data:
                                                    "create_ticket"
                                            }
                                        ],
                                        [
                                            {
                                                text:
                                                    "🔙 Back",
                                                callback_data:
                                                    "main_menu"
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
                        `📋 Your Tickets: ${tickets.length}`
                    );

                    tickets.forEach(
                        (ticket) => {
                            const buttons =
                                [
                                    [
                                        {
                                            text:
                                                "💬 Conversation",
                                            callback_data:
                                                `conversation_ticket_${ticket.id}`
                                        }
                                    ]
                                ];

                            if (
                                ticket.status !==
                                "closed"
                            ) {
                                buttons.push([
                                    {
                                        text:
                                            "✍️ Reply",
                                        callback_data:
                                            `user_reply_ticket_${ticket.id}`
                                    }
                                ]);
                            }

                            bot.sendMessage(
                                chatId,
                                `🎫 Ticket #${ticket.id}\n\n` +
                                    `🗂 Category: ${getCategoryText(ticket.category)}\n` +
                                    `⚡ Priority: ${getPriorityText(ticket.priority)}\n` +
                                    `📌 Status: ${getStatusText(ticket.status)}\n` +
                                    `👨‍💼 Operator: ${getOperatorText(ticket)}\n\n` +
                                    `💬 ${ticket.message}\n\n` +
                                    `🕒 Last activity: ${formatDate(ticket.last_activity_at || ticket.created_at)}`,
                                {
                                    reply_markup: {
                                        inline_keyboard:
                                            buttons
                                    }
                                }
                            );
                        }
                    );
                }
            );

            return;
        }

        // ====================================
        // CONVERSATION
        // ====================================

        if (
            data.startsWith(
                "conversation_ticket_"
            )
        ) {
            const ticketId =
                Number(
                    data.replace(
                        "conversation_ticket_",
                        ""
                    )
                );

            showConversation(
                chatId,
                ticketId,
                userId
            );

            return;
        }

        // ====================================
        // USER REPLY
        // ====================================

        if (
            data.startsWith(
                "user_reply_ticket_"
            )
        ) {
            const ticketId =
                Number(
                    data.replace(
                        "user_reply_ticket_",
                        ""
                    )
                );

            getTicket(
                ticketId,
                (
                    err,
                    ticket
                ) => {
                    if (
                        err ||
                        !ticket
                    ) {
                        bot.sendMessage(
                            chatId,
                            "❌ Ticket not found."
                        );

                        return;
                    }

                    if (
                        ticket
                            .telegram_id !==
                        userId
                    ) {
                        bot.sendMessage(
                            chatId,
                            "❌ You don't have access to this ticket."
                        );

                        return;
                    }

                    if (
                        ticket.status ===
                        "closed"
                    ) {
                        bot.sendMessage(
                            chatId,
                            "🔒 This ticket is closed."
                        );

                        return;
                    }

                    userStates[
                        chatId
                    ] = {
                        action:
                            "user_ticket_reply",

                        ticketId
                    };

                    bot.sendMessage(
                        chatId,
                        `✍️ Reply to Ticket #${ticketId}\n\n` +
                            "Type your message:",
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text:
                                                "❌ Cancel",
                                            callback_data:
                                                "my_tickets"
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

        if (
            data ===
            "about"
        ) {
            bot.sendMessage(
                chatId,
                "🤖 Support Management Bot\n\n" +
                    "Built with JavaScript, Node.js, Telegram Bot API and SQLite.\n\n" +

                    "Features:\n" +
                    "• Support tickets\n" +
                    "• Categories & priorities\n" +
                    "• Ticket statuses\n" +
                    "• Conversation history\n" +
                    "• User follow-up messages\n" +
                    "• Assigned operators\n" +
                    "• Ticket filters\n" +
                    "• Response-time tracking\n" +
                    "• Support statistics\n" +
                    "• Admin dashboard",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
                                        "🔙 Back",
                                    callback_data:
                                        "main_menu"
                                }
                            ]
                        ]
                    }
                }
            );

            return;
        }

        // ====================================
        // ADMIN TICKETS
        // ====================================

        if (
            data ===
            "admin_tickets"
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            showAllTickets(
                chatId,
                "all"
            );

            return;
        }

        // ====================================
        // FILTER MENU
        // ====================================

        if (
            data ===
            "admin_filters"
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            showAdminFilters(
                chatId
            );

            return;
        }

        // ====================================
        // FILTER CALLBACK
        // ====================================

        if (
            data.startsWith(
                "filter_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const filter =
                data.replace(
                    "filter_",
                    ""
                );

            showAllTickets(
                chatId,
                filter
            );

            return;
        }

        // ====================================
        // ASSIGN TO ME
        // ====================================

        if (
            data.startsWith(
                "assign_ticket_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const ticketId =
                Number(
                    data.replace(
                        "assign_ticket_",
                        ""
                    )
                );

            const operatorName =
                getOperatorName(
                    query.from
                );

            assignTicket(
                ticketId,
                userId,
                operatorName,
                (err) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to assign ticket."
                        );

                        return;
                    }

                    bot.sendMessage(
                        chatId,
                        `✅ Ticket #${ticketId} assigned to ${operatorName}.`
                    );

                    getTicket(
                        ticketId,
                        (
                            ticketErr,
                            ticket
                        ) => {
                            if (
                                !ticketErr &&
                                ticket
                            ) {
                                bot.sendMessage(
                                    ticket.telegram_id,
                                    `👨‍💼 Support started working on Ticket #${ticketId}.`
                                );
                            }
                        }
                    );
                }
            );

            return;
        }

        // ====================================
        // CHANGE PRIORITY
        // ====================================

        if (
            data.startsWith(
                "change_priority_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const ticketId =
                Number(
                    data.replace(
                        "change_priority_",
                        ""
                    )
                );

            bot.sendMessage(
                chatId,
                `⚡ Change Priority — Ticket #${ticketId}`,
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
                                        "🟢 Low",
                                    callback_data:
                                        `set_priority_low_${ticketId}`
                                },

                                {
                                    text:
                                        "🟡 Medium",
                                    callback_data:
                                        `set_priority_medium_${ticketId}`
                                }
                            ],
                            [
                                {
                                    text:
                                        "🟠 High",
                                    callback_data:
                                        `set_priority_high_${ticketId}`
                                },

                                {
                                    text:
                                        "🔴 Urgent",
                                    callback_data:
                                        `set_priority_urgent_${ticketId}`
                                }
                            ],
                            [
                                {
                                    text:
                                        "🔙 Admin Panel",
                                    callback_data:
                                        "admin_panel"
                                }
                            ]
                        ]
                    }
                }
            );

            return;
        }

        // ====================================
        // SET PRIORITY
        // ====================================

        if (
            data.startsWith(
                "set_priority_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const match =
                data.match(
                    /^set_priority_(low|medium|high|urgent)_(\d+)$/
                );

            if (
                !match
            ) {
                return;
            }

            const priority =
                match[1];

            const ticketId =
                Number(
                    match[2]
                );

            updateTicketPriority(
                ticketId,
                priority,
                (err) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to update priority."
                        );

                        return;
                    }

                    bot.sendMessage(
                        chatId,
                        `✅ Ticket #${ticketId}\n` +
                            `⚡ Priority → ${getPriorityText(priority)}`
                    );
                }
            );

            return;
        }

        // ====================================
        // IN PROGRESS
        // ====================================

        if (
            data.startsWith(
                "progress_ticket_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const ticketId =
                Number(
                    data.replace(
                        "progress_ticket_",
                        ""
                    )
                );

            updateTicketStatus(
                ticketId,
                "in_progress",
                (err) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        return;
                    }

                    getTicket(
                        ticketId,
                        (
                            ticketErr,
                            ticket
                        ) => {
                            if (
                                !ticketErr &&
                                ticket
                            ) {
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
        // CLOSE
        // ====================================

        if (
            data.startsWith(
                "close_ticket_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const ticketId =
                Number(
                    data.replace(
                        "close_ticket_",
                        ""
                    )
                );

            updateTicketStatus(
                ticketId,
                "closed",
                (err) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        return;
                    }

                    getTicket(
                        ticketId,
                        (
                            ticketErr,
                            ticket
                        ) => {
                            if (
                                !ticketErr &&
                                ticket
                            ) {
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
        // REOPEN
        // ====================================

        if (
            data.startsWith(
                "open_ticket_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const ticketId =
                Number(
                    data.replace(
                        "open_ticket_",
                        ""
                    )
                );

            updateTicketStatus(
                ticketId,
                "open",
                (err) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        return;
                    }

                    getTicket(
                        ticketId,
                        (
                            ticketErr,
                            ticket
                        ) => {
                            if (
                                !ticketErr &&
                                ticket
                            ) {
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
        // ADMIN REPLY
        // ====================================

        if (
            data.startsWith(
                "reply_ticket_"
            )
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            const ticketId =
                Number(
                    data.replace(
                        "reply_ticket_",
                        ""
                    )
                );

            getTicket(
                ticketId,
                (
                    err,
                    ticket
                ) => {
                    if (
                        err ||
                        !ticket
                    ) {
                        bot.sendMessage(
                            chatId,
                            "❌ Ticket not found."
                        );

                        return;
                    }

                    if (
                        ticket.status ===
                        "closed"
                    ) {
                        bot.sendMessage(
                            chatId,
                            "🔒 Reopen the ticket before replying."
                        );

                        return;
                    }

                    userStates[
                        chatId
                    ] = {
                        action:
                            "admin_reply",

                        ticketId,

                        telegramId:
                            ticket
                                .telegram_id,

                        operatorName:
                            getOperatorName(
                                query.from
                            )
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
                                            text:
                                                "❌ Cancel",
                                            callback_data:
                                                "admin_panel"
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
        // STATISTICS
        // ====================================

        if (
            data ===
            "admin_stats"
        ) {
            if (
                userId !==
                ADMIN_ID
            ) {
                return;
            }

            getStats(
                (
                    err,
                    stats
                ) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to load statistics."
                        );

                        return;
                    }

                    bot.sendMessage(
                        chatId,
                        "📊 Support Statistics\n\n" +

                            "📌 Status\n" +
                            `🎫 Total: ${stats.total || 0}\n` +
                            `🟢 Open: ${stats.open || 0}\n` +
                            `🟡 In Progress: ${stats.in_progress || 0}\n` +
                            `🔴 Closed: ${stats.closed || 0}\n\n` +

                            "⚡ Priority\n" +
                            `🟢 Low: ${stats.low || 0}\n` +
                            `🟡 Medium: ${stats.medium || 0}\n` +
                            `🟠 High: ${stats.high || 0}\n` +
                            `🔴 Urgent: ${stats.urgent || 0}\n\n` +

                            "🗂 Categories\n" +
                            `🛠 Technical: ${stats.technical || 0}\n` +
                            `💳 Billing: ${stats.billing || 0}\n` +
                            `💬 General: ${stats.general || 0}\n\n` +

                            "👨‍💼 Support Team\n" +
                            `⚪ Unassigned: ${stats.unassigned || 0}\n` +
                            `⏱ Avg. first response: ${formatDuration(stats.avg_first_response_seconds)}`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text:
                                                "🔙 Admin Panel",
                                            callback_data:
                                                "admin_panel"
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
    }
);

// ========================================
// TEXT MESSAGES
// ========================================

bot.on(
    "message",
    (msg) => {
        if (
            !msg.text ||
            msg.text.startsWith(
                "/"
            )
        ) {
            return;
        }

        const chatId =
            msg.chat.id;

        const state =
            userStates[
                chatId
            ];

        if (
            !state
        ) {
            return;
        }

        // ====================================
        // CREATE TICKET
        // ====================================

        if (
            state.action ===
            "waiting_for_ticket"
        ) {
            const ticketMessage =
                msg.text.trim();

            if (
                ticketMessage.length <
                5
            ) {
                bot.sendMessage(
                    chatId,
                    "⚠️ Please describe your problem in more detail."
                );

                return;
            }

            addUser(
                msg.from
            );

            const category =
                state.category;

            const priority =
                state.priority;

            createTicket(
                msg.from.id,
                ticketMessage,
                category,
                priority,
                (
                    err,
                    ticketId
                ) => {
                    if (
                        err
                    ) {
                        console.error(
                            err
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to create ticket."
                        );

                        return;
                    }

                    delete userStates[
                        chatId
                    ];

                    bot.sendMessage(
                        chatId,
                        "✅ Ticket created successfully!\n\n" +
                            `🎫 Ticket: #${ticketId}\n` +
                            `🗂 Category: ${getCategoryText(category)}\n` +
                            `⚡ Priority: ${getPriorityText(priority)}\n` +
                            "📌 Status: 🟢 Open"
                    );

                    const username =
                        msg.from
                            .username
                            ? `@${msg.from.username}`
                            : "No username";

                    bot.sendMessage(
                        ADMIN_ID,
                        "🚨 New Support Ticket\n\n" +
                            `🎫 Ticket: #${ticketId}\n` +
                            `🗂 Category: ${getCategoryText(category)}\n` +
                            `⚡ Priority: ${getPriorityText(priority)}\n` +
                            `👤 User: ${username}\n` +
                            `🆔 ID: ${msg.from.id}\n\n` +
                            `💬 ${ticketMessage}`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text:
                                                "👨‍💼 Assign to Me",
                                            callback_data:
                                                `assign_ticket_${ticketId}`
                                        }
                                    ],
                                    [
                                        {
                                            text:
                                                "💬 Conversation",
                                            callback_data:
                                                `conversation_ticket_${ticketId}`
                                        }
                                    ],
                                    [
                                        {
                                            text:
                                                "⚡ Change Priority",
                                            callback_data:
                                                `change_priority_${ticketId}`
                                        }
                                    ],
                                    [
                                        {
                                            text:
                                                "💬 Reply",
                                            callback_data:
                                                `reply_ticket_${ticketId}`
                                        }
                                    ],
                                    [
                                        {
                                            text:
                                                "✅ Close",
                                            callback_data:
                                                `close_ticket_${ticketId}`
                                        }
                                    ]
                                ]
                            }
                        }
                    );

                    showMainMenu(
                        chatId
                    );
                }
            );

            return;
        }

        // ====================================
        // USER REPLY
        // ====================================

        if (
            state.action ===
            "user_ticket_reply"
        ) {
            const reply =
                msg.text.trim();

            if (
                !reply
            ) {
                return;
            }

            getTicket(
                state.ticketId,
                (
                    err,
                    ticket
                ) => {
                    if (
                        err ||
                        !ticket
                    ) {
                        delete userStates[
                            chatId
                        ];

                        return;
                    }

                    if (
                        ticket
                            .telegram_id !==
                        msg.from.id
                    ) {
                        delete userStates[
                            chatId
                        ];

                        return;
                    }

                    if (
                        ticket.status ===
                        "closed"
                    ) {
                        bot.sendMessage(
                            chatId,
                            "🔒 This ticket is closed."
                        );

                        delete userStates[
                            chatId
                        ];

                        return;
                    }

                    const ticketId =
                        state.ticketId;

                    addTicketMessage(
                        ticketId,
                        "user",
                        msg.from.id,
                        reply,
                        (
                            saveErr
                        ) => {
                            if (
                                saveErr
                            ) {
                                console.error(
                                    saveErr
                                );

                                return;
                            }

                            delete userStates[
                                chatId
                            ];

                            bot.sendMessage(
                                chatId,
                                `✅ Message added to Ticket #${ticketId}.`
                            );

                            bot.sendMessage(
                                ADMIN_ID,
                                "📩 New message in Support Ticket\n\n" +
                                    `🎫 Ticket: #${ticketId}\n` +
                                    `⚡ Priority: ${getPriorityText(ticket.priority)}\n\n` +
                                    `💬 ${reply}`,
                                {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                {
                                                    text:
                                                        "💬 Conversation",
                                                    callback_data:
                                                        `conversation_ticket_${ticketId}`
                                                }
                                            ],
                                            [
                                                {
                                                    text:
                                                        "💬 Reply",
                                                    callback_data:
                                                        `reply_ticket_${ticketId}`
                                                }
                                            ]
                                        ]
                                    }
                                }
                            );
                        }
                    );
                }
            );

            return;
        }

        // ====================================
        // ADMIN REPLY
        // ====================================

        if (
            state.action ===
                "admin_reply" &&
            msg.from.id ===
                ADMIN_ID
        ) {
            const reply =
                msg.text.trim();

            if (
                !reply
            ) {
                return;
            }

            const ticketId =
                state.ticketId;

            registerFirstResponse(
                ticketId,
                ADMIN_ID,
                state.operatorName,
                (
                    responseErr
                ) => {
                    if (
                        responseErr
                    ) {
                        console.error(
                            responseErr
                        );

                        bot.sendMessage(
                            chatId,
                            "❌ Failed to register support response."
                        );

                        return;
                    }

                    addTicketMessage(
                        ticketId,
                        "admin",
                        ADMIN_ID,
                        reply,
                        (
                            saveErr
                        ) => {
                            if (
                                saveErr
                            ) {
                                console.error(
                                    saveErr
                                );

                                return;
                            }

                            const userTelegramId =
                                state.telegramId;

                            delete userStates[
                                chatId
                            ];

                            bot.sendMessage(
                                userTelegramId,
                                `💬 Support reply — Ticket #${ticketId}\n\n` +
                                    reply,
                                {
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                {
                                                    text:
                                                        "💬 Conversation",
                                                    callback_data:
                                                        `conversation_ticket_${ticketId}`
                                                }
                                            ],
                                            [
                                                {
                                                    text:
                                                        "✍️ Reply",
                                                    callback_data:
                                                        `user_reply_ticket_${ticketId}`
                                                }
                                            ]
                                        ]
                                    }
                                }
                            );

                            bot.sendMessage(
                                chatId,
                                `✅ Reply sent to Ticket #${ticketId}.`
                            );
                        }
                    );
                }
            );

            return;
        }
    }
);

// ========================================
// SHOW TICKETS
// ========================================

function showAllTickets(
    chatId,
    filter =
        "all"
) {
    const loader =
        filter ===
        "all"
            ? getAllTickets
            : (
                  callback
              ) =>
                  getFilteredTickets(
                      filter,
                      callback
                  );

    loader(
        (
            err,
            tickets
        ) => {
            if (
                err
            ) {
                console.error(
                    err
                );

                bot.sendMessage(
                    chatId,
                    "❌ Failed to load tickets."
                );

                return;
            }

            const filterNames = {
                all:
                    "All Tickets",

                open:
                    "Open Tickets",

                in_progress:
                    "In Progress",

                closed:
                    "Closed Tickets",

                important:
                    "High & Urgent",

                unassigned:
                    "Unassigned"
            };

            if (
                !tickets.length
            ) {
                bot.sendMessage(
                    chatId,
                    `📭 No tickets found.\n\nFilter: ${filterNames[filter] || filter}`
                );

                return;
            }

            bot.sendMessage(
                chatId,
                `🎫 ${filterNames[filter] || "Tickets"}: ${tickets.length}`
            );

            tickets.forEach(
                (
                    ticket
                ) => {
                    const username =
                        ticket
                            .username
                            ? `@${ticket.username}`
                            : "No username";

                    const buttons =
                        [];

                    buttons.push([
                        {
                            text:
                                "💬 Conversation",
                            callback_data:
                                `conversation_ticket_${ticket.id}`
                        }
                    ]);

                    if (
                        !ticket
                            .assigned_operator_id
                    ) {
                        buttons.push([
                            {
                                text:
                                    "👨‍💼 Assign to Me",
                                callback_data:
                                    `assign_ticket_${ticket.id}`
                            }
                        ]);
                    }

                    buttons.push([
                        {
                            text:
                                "⚡ Change Priority",
                            callback_data:
                                `change_priority_${ticket.id}`
                        }
                    ]);

                    if (
                        ticket.status ===
                        "open"
                    ) {
                        buttons.push([
                            {
                                text:
                                    "🟡 In Progress",
                                callback_data:
                                    `progress_ticket_${ticket.id}`
                            }
                        ]);
                    }

                    if (
                        ticket.status !==
                        "closed"
                    ) {
                        buttons.push([
                            {
                                text:
                                    "💬 Reply",
                                callback_data:
                                    `reply_ticket_${ticket.id}`
                            }
                        ]);

                        buttons.push([
                            {
                                text:
                                    "✅ Close",
                                callback_data:
                                    `close_ticket_${ticket.id}`
                            }
                        ]);
                    }

                    if (
                        ticket.status ===
                        "closed"
                    ) {
                        buttons.push([
                            {
                                text:
                                    "♻️ Reopen",
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
                            `⚡ ${getPriorityText(ticket.priority)}\n` +
                            `📌 ${getStatusText(ticket.status)}\n` +
                            `👨‍💼 ${getOperatorText(ticket)}\n\n` +
                            `💬 ${ticket.message}\n\n` +
                            `🕒 Last activity: ${formatDate(ticket.last_activity_at || ticket.created_at)}`,
                        {
                            reply_markup: {
                                inline_keyboard:
                                    buttons
                            }
                        }
                    );
                }
            );

            bot.sendMessage(
                chatId,
                "🛠 Ticket management",
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text:
                                        "🔎 Filters",
                                    callback_data:
                                        "admin_filters"
                                }
                            ],
                            [
                                {
                                    text:
                                        "📊 Statistics",
                                    callback_data:
                                        "admin_stats"
                                }
                            ],
                            [
                                {
                                    text:
                                        "🔙 Admin Panel",
                                    callback_data:
                                        "admin_panel"
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
    "🤖 Support Bot v2.2 is running..."
);