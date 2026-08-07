const TelegramBot = require("node-telegram-bot-api");

const TOKEN = process.env.TELEGRAM_TOKEN;
const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;


if (!TOKEN) {
    console.log("Telegram token missing");
    return;
}


const bot = new TelegramBot(TOKEN, {
    polling: true
});



function isAdmin(id) {

    return String(id) === String(ADMIN_ID);

}



// Start command

bot.onText(/\/start/, (msg)=>{

    if(!isAdmin(msg.from.id)){

        return bot.sendMessage(
            msg.chat.id,
            "No permission"
        );

    }


    bot.sendMessage(
        msg.chat.id,
        "ADMFLIP Admin Bot Online ✅"
    );

});





// Test command

bot.onText(/\/stats/, (msg)=>{


    if(!isAdmin(msg.from.id)){

        return bot.sendMessage(
            msg.chat.id,
            "No permission"
        );

    }


    bot.sendMessage(
        msg.chat.id,
        "ADMFLIP database connected ✅"
    );


});





console.log("Telegram bot started");
